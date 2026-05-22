import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TP_TOKEN = process.env.TRAVELPAYOUTS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!TP_TOKEN) {
    return res.status(200).json({ fallback: true, reason: "Travelpayouts not configured" });
  }

  const { destination, checkIn, checkOut } = req.body || {};
  if (!destination || !checkIn || !checkOut) {
    return res.status(400).json({ error: "destination, checkIn, and checkOut are required" });
  }

  const ck = `tf:hotels:tp:${destination.toLowerCase().replace(/\s+/g, "_")}:${checkIn}:${checkOut}`;

  try {
    const cached = await redis.get(ck);
    if (cached) return res.status(200).json(cached);

    const url = `https://engine.hotellook.com/api/v2/cache.json?location=${encodeURIComponent(destination)}&checkIn=${checkIn}&checkOut=${checkOut}&currency=usd&limit=20&token=${TP_TOKEN}`;
    const r = await fetch(url);

    if (!r.ok) {
      return res.status(200).json({ fallback: true, reason: `HotelLook ${r.status}` });
    }

    const data = await r.json();
    if (!Array.isArray(data) || !data.length) {
      return res.status(200).json({ fallback: true, reason: "No hotel data" });
    }

    // Find the cheapest starting price per star tier
    const sorted = data.filter(h => h.priceFrom > 0).sort((a, b) => a.priceFrom - b.priceFrom);
    const tiers = {
      budget:  sorted.find(h => h.stars <= 3)?.priceFrom  ?? null,
      mid:     sorted.find(h => h.stars === 3 || h.stars === 4)?.priceFrom ?? null,
      upscale: sorted.find(h => h.stars >= 4)?.priceFrom  ?? null,
    };

    const result = { live: true, tiers };
    await redis.set(ck, result, { ex: 1800 });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: err.message || "Proxy error" });
  }
}
