import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TP_TOKEN = process.env.TRAVELPAYOUTS_TOKEN;

// Travelpayouts returns live economy price; other cabins are estimated multiples
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

  const month = date.slice(0, 7);
  const ck = `tf:flights:tp2:${from}:${to}:${date}`;

  try {
    const cached = await redis.get(ck);
    if (cached) return res.status(200).json(cached);

    const [fromCode, toCode] = await Promise.all([cityToIata(from), cityToIata(to)]);
    if (!fromCode || !toCode) {
      return res.status(200).json({ fallback: true, reason: "IATA lookup failed" });
    }

    let cheapest = null;
    let cheaperDay = null;
    let monthCheapest = null;

    // Try month-matrix for per-day pricing
    const matrixUrl = `https://api.travelpayouts.com/v2/prices/month-matrix?origin=${fromCode}&destination=${toCode}&month=${month}&currency=USD&show_to_affiliates=true&one_way=true&token=${TP_TOKEN}`;
    const matrixRes = await fetch(matrixUrl).catch(() => null);

    if (matrixRes?.ok) {
      const matrixData = await matrixRes.json().catch(() => null);
      if (matrixData?.success && Array.isArray(matrixData.data) && matrixData.data.length) {
        const entries = matrixData.data.filter(e => e.price > 0);
        const targetEntry = entries.find(e => e.departure_at?.slice(0, 10) === date);

        // Cheapest option within ±3 days of the requested date
        const targetMs = new Date(date).getTime();
        const nearby = entries
          .filter(e => e.departure_at && Math.abs(new Date(e.departure_at.slice(0, 10)).getTime() - targetMs) <= 3 * 86400000)
          .sort((a, b) => a.price - b.price);

        cheapest = targetEntry || nearby[0] || entries.sort((a, b) => a.price - b.price)[0];

        // Suggest a cheaper nearby date if it saves >5% and >$15 vs the user's exact date
        if (targetEntry && nearby[0] && nearby[0].departure_at?.slice(0, 10) !== date) {
          const savings = targetEntry.price - nearby[0].price;
          if (savings > 15 && savings / targetEntry.price > 0.05) {
            cheaperDay = {
              date:    nearby[0].departure_at.slice(0, 10),
              price:   Math.round(nearby[0].price * (parseInt(adults, 10) || 1)),
              savings: Math.round(savings * (parseInt(adults, 10) || 1)),
            };
          }
        }

        // Surface the absolute cheapest day in the full month if it's >15% cheaper than target
        const absoluteCheapest = entries.slice().sort((a, b) => a.price - b.price)[0];
        if (targetEntry && absoluteCheapest && absoluteCheapest.departure_at?.slice(0, 10) !== date) {
          const fullSavings = targetEntry.price - absoluteCheapest.price;
          const fullDate = absoluteCheapest.departure_at.slice(0, 10);
          if (fullSavings > 0 && fullSavings / targetEntry.price > 0.15 && (!cheaperDay || fullDate !== cheaperDay.date)) {
            monthCheapest = {
              date:    fullDate,
              price:   Math.round(absoluteCheapest.price * (parseInt(adults, 10) || 1)),
              savings: Math.round(fullSavings * (parseInt(adults, 10) || 1)),
            };
          }
        }
      }
    }

    // Fall back to monthly cheap endpoint if matrix gave no data
    if (!cheapest) {
      const cheapUrl = `https://api.travelpayouts.com/v1/prices/cheap?origin=${fromCode}&destination=${toCode}&depart_date=${month}&one_way=true&currency=usd&token=${TP_TOKEN}`;
      const cheapRes = await fetch(cheapUrl).catch(() => null);
      if (cheapRes?.ok) {
        const cheapData = await cheapRes.json().catch(() => null);
        if (cheapData?.success && cheapData.data) {
          const destKey = cheapData.data[toCode] ? toCode : Object.keys(cheapData.data)[0];
          const destData = cheapData.data[destKey];
          if (destData) {
            for (const [stops, flight] of Object.entries(destData)) {
              if (!cheapest || flight.price < cheapest.price) {
                cheapest = { ...flight, stops: parseInt(stops, 10) };
              }
            }
          }
        }
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
      stops:       cheapest.stops ?? 0,
      fromCode,
      toCode,
    }));

    const result = {
      live: true,
      fromCode,
      toCode,
      cabins,
      fetchedAt: Date.now(),
      ...(cheaperDay    && { cheaperDay }),
      ...(monthCheapest && { monthCheapest }),
    };
    await redis.set(ck, result, { ex: 1800 });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: err.message || "Proxy error" });
  }
}
