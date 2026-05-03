import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const AM_ID   = process.env.AMADEUS_CLIENT_ID;
const AM_SEC  = process.env.AMADEUS_CLIENT_SECRET;
const AM_BASE = process.env.AMADEUS_ENV === "test"
  ? "https://test.api.amadeus.com"
  : "https://api.amadeus.com";

const CABINS = {
  ECONOMY:         { label: "Economy",         kayak: "e",  order: 0 },
  PREMIUM_ECONOMY: { label: "Premium Economy", kayak: "pe", order: 1 },
  BUSINESS:        { label: "Business Class",  kayak: "b",  order: 2 },
  FIRST:           { label: "First Class",     kayak: "f",  order: 3 },
};

async function getToken() {
  const cached = await redis.get("tf:amadeus:token");
  if (cached) return cached;

  const r = await fetch(`${AM_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     AM_ID,
      client_secret: AM_SEC,
    }),
  });
  if (!r.ok) throw new Error(`Amadeus token ${r.status}`);
  const d = await r.json();
  const token = d.access_token;
  // cache for 28 min (token lives 30 min)
  await redis.set("tf:amadeus:token", token, { ex: 1680 });
  return token;
}

async function cityToIata(name, token) {
  if (!name) return null;
  const upper = name.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;

  const ck = `tf:iata:${upper}`;
  const hit = await redis.get(ck);
  if (hit) return hit;

  const r = await fetch(
    `${AM_BASE}/v1/reference-data/locations?subType=AIRPORT&keyword=${encodeURIComponent(name)}&page[limit]=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  const code = d?.data?.[0]?.iataCode || null;
  if (code) await redis.set(ck, code, { ex: 86400 });
  return code;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!AM_ID || !AM_SEC) {
    return res.status(200).json({ fallback: true, reason: "Amadeus not configured" });
  }

  const { from, to, date, adults = 1 } = req.body || {};
  if (!from || !to || !date) {
    return res.status(400).json({ error: "from, to, and date are required" });
  }

  const ck = `tf:flights:${from}:${to}:${date}:${adults}`;

  try {
    const cached = await redis.get(ck);
    if (cached) return res.status(200).json(cached);

    const token = await getToken();
    const [fromCode, toCode] = await Promise.all([
      cityToIata(from, token),
      cityToIata(to,   token),
    ]);

    if (!fromCode || !toCode) {
      return res.status(200).json({ fallback: true, reason: "IATA lookup failed" });
    }

    // Fetch up to 50 offers and group by cabin
    const offerRes = await fetch(
      `${AM_BASE}/v2/shopping/flight-offers?originLocationCode=${fromCode}&destinationLocationCode=${toCode}&departureDate=${date}&adults=${adults}&max=50&currencyCode=USD`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!offerRes.ok) {
      const err = await offerRes.json().catch(() => ({}));
      return res.status(200).json({ fallback: true, reason: err?.errors?.[0]?.detail || `Amadeus ${offerRes.status}` });
    }

    const offerData = await offerRes.json();
    const offers = offerData?.data || [];

    if (!offers.length) {
      return res.status(200).json({ fallback: true, reason: "No offers found" });
    }

    // Group cheapest offer per cabin class
    const byClass = {};
    for (const offer of offers) {
      const cabinCode = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || "ECONOMY";
      const price = parseFloat(offer.price?.grandTotal || offer.price?.total || "0");
      if (!byClass[cabinCode] || price < byClass[cabinCode].price) {
        const seg = offer.itineraries?.[0]?.segments?.[0] || {};
        byClass[cabinCode] = {
          cabin:      cabinCode,
          label:      CABINS[cabinCode]?.label || cabinCode,
          kayakCabin: CABINS[cabinCode]?.kayak || "e",
          order:      CABINS[cabinCode]?.order ?? 99,
          price,
          airline:    seg.carrierCode || "",
          flightNum:  `${seg.carrierCode || ""}${seg.number || ""}`,
          depart:     seg.departure?.at?.slice(11, 16) || "",
          arrive:     seg.arrival?.at?.slice(11, 16) || "",
          stops:      (offer.itineraries?.[0]?.segments?.length || 1) - 1,
          fromCode,
          toCode,
        };
      }
    }

    const cabins = Object.values(byClass).sort((a, b) => a.order - b.order);
    if (!cabins.length) {
      return res.status(200).json({ fallback: true, reason: "No cabin data" });
    }

    const result = { live: true, fromCode, toCode, cabins, fetchedAt: Date.now() };
    // cache 30 minutes
    await redis.set(ck, result, { ex: 1800 });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: err.message || "Proxy error" });
  }
}
