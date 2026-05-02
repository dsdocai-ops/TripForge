import { Redis } from "@upstash/redis";
import crypto from "crypto";

// KV_REST_API_URL and KV_REST_API_TOKEN are injected by Vercel when the KV store is connected
const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function makeCacheKey(body) {
  const content = JSON.stringify({
    model:  body.model,
    system: body.system,
    msg:    body.messages?.[0]?.content,
  });
  return "tf:" + crypto.createHash("sha256").update(content).digest("hex").slice(0, 40);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const cacheKey = makeCacheKey(req.body);

    // 1. Check KV cache — serves all users who request the same trip
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    // 2. Cache miss — call Claude
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":        "application/json",
        "x-api-key":           process.env.ANTHROPIC_API_KEY,
        "anthropic-version":   "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();

    // 3. Cache successful responses for 7 days (604800 seconds)
    if (upstream.ok) {
      await redis.set(cacheKey, data, { ex: 604800 });
    }

    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: "Proxy error" } });
  }
}
