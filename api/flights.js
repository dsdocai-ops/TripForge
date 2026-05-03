import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TP_TOKEN = process.env.TRAVELPAYOUTS_TOKEN;

// Travelpayouts returns cheapest economy price; other cabins are estimated from it
const CABIN_CLASSES = [
  { code: "economy",         label: "Economy",         kayak: "e",  mult: 1.0,  live: true  },
  { code: "premium_economy", label: "Premium Economy", kayak: "pe", mult: 1.8,  live: false },
  { code: "business",        label: "Business Class",  kayak: "b",  mult: 4.2,  live: false },
  { code: "first",           label: "First Class",     kayak: "f",  mult: 7.5,  live: false },
];

async function cityToIata(query) {
  if (!query) return null;
  const upper = query.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;

  const ck = `tf:iata:tp:${upper}`;
  const hit = await redis.get(ck);
  if (hit) return hit;

  const r = await fetch(
    `https://autocomplete.travelpayouts.com/places2?query=${encodeURIComponent(query)}&locale=en&types[]=city&types[]=airport`,
    { headers: { Accept: "application/json" } }
  );
  if (!r.ok) return null;
  const data = await r.json();
  const code = Array.isArray(data) ? data[0]?.code : null;
  if (code) await redis.set(ck, code, { ex: 86400 });
  return code;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!TP_TOKEN) {
    return res.status(200).json({ fallback: true, reason: "Travelpayouts not configured" });
  }

  const { from, to, date, adults = 1 } = req.body || {};
  if (!from || !to || !date) {
    return res.status(400).json({ error: "from, to, and date are required" });
  }

  // Cache by route + month (prices don't change day-to-day for this API)
  const month = date.slice(0, 7);
  const ck = `tf:flights:tp:${from}:${to}:${month}`;

  try {
    const cached = await redis.get(ck);
    if (cached) return res.status(200).json(cached);

    const [fromCode, toCode] = await Promise.all([
      cityToIata(from),
      cityToIata(to),
    ]);

    if (!fromCode || !toCode) {
      return res.status(200).json({ fallback: true, reason: "IATA lookup failed" });
    }

    const url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${fromCode}&destination=${toCode}&depart_date=${month}&one_way=true&currency=usd&token=${TP_TOKEN}`;
    const r = await fetch(url);

    if (!r.ok) {
      return res.status(200).json({ fallback: true, reason: `Travelpayouts ${r.status}` });
    }

    const data = await r.json();
    if (!data.success || !data.data) {
      return res.status(200).json({ fallback: true, reason: "No price data" });
    }

    // Response is keyed by destination IATA; grab first available
    const destKey = data.data[toCode] ? toCode : Object.keys(data.data)[0];
    const destData = data.data[destKey];
    if (!destData) {
      return res.status(200).json({ fallback: true, reason: "No flights found" });
    }

    // Pick cheapest option across all stop counts
    let cheapest = null;
    for (const [stops, flight] of Object.entries(destData)) {
      if (!cheapest || flight.price < cheapest.price) {
        cheapest = { ...flight, stops: parseInt(stops, 10) };
      }
    }
    if (!cheapest) {
      return res.status(200).json({ fallback: true, reason: "No flights found" });
    }

    const economyPrice = cheapest.price * (parseInt(adults, 10) || 1);

    const cabins = CABIN_CLASSES.map((cls, i) => ({
      cabin:       cls.code,
      label:       cls.label,
      kayakCabin:  cls.kayak,
      order:       i,
      price:       Math.round(economyPrice * cls.mult),
      isLivePrice: cls.live,
      airline:     cheapest.airline || "",
      depart:      cheapest.departure_at ? cheapest.departure_at.slice(11, 16) : "",
      stops:       cheapest.stops,
      fromCode,
      toCode,
    }));

    const result = { live: true, fromCode, toCode, cabins, fetchedAt: Date.now() };
    await redis.set(ck, result, { ex: 1800 });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: err.message || "Proxy error" });
  }
}
