import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TP_TOKEN = process.env.TRAVELPAYOUTS_TOKEN;

async function lookupLocation(query) {
  const ck = `tf:hl:loc:${query.toLowerCase().trim()}`;
  const cached = await redis.get(ck);
  if (cached) return cached;

  const r = await fetch(
    `https://engine.hotellook.com/api/v2/lookup.json?query=${encodeURIComponent(query)}&lang=en&lookFor=city&limit=1&token=${TP_TOKEN}`
  );
  if (!r.ok) return null;
  const data = await r.json();
  const loc = data?.results?.locations?.[0];
  if (!loc?.id) return null;

  await redis.set(ck, loc, { ex: 86400 * 30 }); // cache 30 days — location IDs don't change
  return loc;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!TP_TOKEN) return res.status(200).json({ fallback: true, reason: "Travelpayouts not configured" });

  const { destination, checkin, checkout, adults = 2 } = req.body || {};
  if (!destination || !checkin || !checkout) {
    return res.status(400).json({ error: "destination, checkin, and checkout are required" });
  }

  const ck = `tf:hotels:v1:${destination.toLowerCase()}:${checkin}:${checkout}:${adults}`;

  try {
    const cached = await redis.get(ck);
    if (cached) return res.status(200).json(cached);

    const loc = await lookupLocation(destination);
    if (!loc) return res.status(200).json({ fallback: true, reason: "Location not found" });

    const url = `https://engine.hotellook.com/api/v2/cache.json?location=${loc.id}&currency=USD&checkIn=${checkin}&checkOut=${checkout}&adultsCount=${adults}&limit=30&token=${TP_TOKEN}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(200).json({ fallback: true, reason: `Hotellook ${r.status}` });

    const raw = await r.json();
    if (!Array.isArray(raw) || !raw.length) {
      return res.status(200).json({ fallback: true, reason: "No hotels found" });
    }

    // Filter to hotels with a valid price, sort cheapest first
    const valid = raw.filter(h => h.priceFrom > 0).sort((a, b) => a.priceFrom - b.priceFrom);
    if (!valid.length) return res.status(200).json({ fallback: true, reason: "No priced hotels" });

    // Pick a budget + two mid-range + one upscale spread
    const n = valid.length;
    const picks = n <= 4 ? valid : [
      valid[0],
      valid[Math.floor(n * 0.28)],
      valid[Math.floor(n * 0.60)],
      valid[Math.floor(n * 0.88)],
    ];

    const nights = Math.max(1, Math.round((new Date(checkout) - new Date(checkin)) / 864e5));

    const hotels = picks.map(h => {
      // name can be a string or a { en: "...", ru: "..." } object
      const nameRaw = h.name;
      const name = typeof nameRaw === "object"
        ? (nameRaw.en || Object.values(nameRaw)[0] || "")
        : (nameRaw || "");
      return {
        hotelId: h.hotelId,
        name,
        stars: parseInt(h.stars) || 3,
        pricePerNight: Math.round(h.priceFrom), // priceFrom is per-night per Hotellook API
        priceTotal: Math.round(h.priceFrom * nights),
        neighborhood: h.location?.name || loc.name || destination,
        photoUrl: h.photoUrl || null,
      };
    });

    const result = { live: true, cityName: loc.name, hotels, nights, fetchedAt: Date.now() };
    await redis.set(ck, result, { ex: 3600 }); // 1-hour cache for price freshness
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: err.message || "Proxy error" });
  }
}
