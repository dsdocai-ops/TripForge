import crypto from "crypto";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const RECENT_KEY = "faresparks:social:recent";
const MAX_POSTS   = 20;

const PROMPT = `You are the social voice for FareSparks (faresparks.com), an AI travel
planner that builds personalized trip itineraries — and surfaces smart
fares and timing — in seconds. Audience: people planning trips who find
the research tedious, from budget travelers to busy people who want a
great trip without the spreadsheet.

Write ONE X post. Rules:
- Under 280 characters. No hashtags. No emojis used as filler.
- Lead with something concrete and screenshot-worthy — a specific
  mini-itinerary ("3 perfect days in Lisbon: ..."), an underrated
  destination, a booking/timing hack, or a sharp travel observation.
  Specificity beats generic wanderlust every time.
- Sound like a sharp, well-traveled friend who plans the perfect trip
  for you — not a brand account.
- Vary the format each time (mini-itinerary / tip / hot take / "where
  should I send you?" question / underrated-spot reveal).
- Do NOT repeat anything from these recent posts:
{{last_20_posts}}

Return only the post text, nothing else.`;

// ── OAuth 1.0a helpers ───────────────────────────────────────────────────────

function oauthSign(method, url, oauthParams, consumerSecret, tokenSecret) {
  const sorted = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join("&");

  const base = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(sorted)].join("&");
  const key  = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac("sha1", key).update(base).digest("base64");
}

async function postToX(text) {
  const url    = "https://api.twitter.com/2/tweets";
  const params = {
    oauth_consumer_key:     process.env.TWITTER_API_KEY,
    oauth_nonce:            crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_token:            process.env.TWITTER_ACCESS_TOKEN,
    oauth_version:          "1.0",
  };

  params.oauth_signature = oauthSign(
    "POST", url, params,
    process.env.TWITTER_API_SECRET,
    process.env.TWITTER_ACCESS_TOKEN_SECRET,
  );

  const authHeader = "OAuth " + Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
    .join(", ");

  const r = await fetch(url, {
    method:  "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body:    JSON.stringify({ text }),
  });

  if (!r.ok) throw new Error(`X API ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Claude generation ────────────────────────────────────────────────────────

async function generatePost(recent) {
  const filled = PROMPT.replace(
    "{{last_20_posts}}",
    recent.length ? recent.join("\n---\n") : "(none yet)",
  );

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages:   [{ role: "user", content: filled }],
    }),
  });

  if (!r.ok) throw new Error(`Claude API ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.content[0].text.trim();
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Vercel cron sends GET with Authorization: Bearer <CRON_SECRET>
  // Manual trigger: POST with the same header for testing
  const auth = req.headers["authorization"];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const recent = (await redis.lrange(RECENT_KEY, 0, MAX_POSTS - 1)) || [];
    const post   = await generatePost(recent);
    const tweet  = await postToX(post);

    await redis.lpush(RECENT_KEY, post);
    await redis.ltrim(RECENT_KEY, 0, MAX_POSTS - 1);

    return res.status(200).json({ ok: true, post, tweet });
  } catch (err) {
    console.error("[post-tweet]", err);
    return res.status(500).json({ error: err.message });
  }
}
