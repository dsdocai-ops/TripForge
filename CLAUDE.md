# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

**Always develop directly on `main`.** Do not create feature branches. Commit and push all changes straight to `main`.

## Business Goal

**The website must generate profit at near-zero operating cost.** Every technical decision should support this:
- Minimize Claude API calls (the primary cost driver) through aggressive caching
- Prefer free third-party APIs (Open-Meteo for weather and geocoding)
- Revenue comes from **affiliate links** (Skyscanner, Booking.com, Expedia, Kayak, Viator, RentalCars) and **AdSense ad slots** — protect and expand these
- Use the cheapest capable Claude model (`claude-haiku-4-5-20251001`)

## Commands

```bash
npm run dev      # Start Vite dev server (localhost:5173)
npm run build    # Fix smart-quotes in FareSpark.jsx, then build to dist/
npm run preview  # Preview the production build locally
```

There is no test suite and no linter configured.

## Architecture

**Single-file React SPA** — virtually all UI and logic lives in `src/FareSpark.jsx` (~1600 lines). There is intentionally no component splitting across files.

**Deployment target: Vercel.** The `api/claude.js` file is a Vercel serverless function that acts as a proxy between the browser and the Anthropic API. It keeps `ANTHROPIC_API_KEY` off the client. `VITE_PROXY_URL=/api/claude` in `.env` tells the frontend to route through this proxy.

### Request / caching flow

```
Browser → /api/claude (Vercel function)
            ↓
       Upstash Redis KV (7-day cache, keyed by model + system prompt + user message hash)
            ↓ cache miss
       Anthropic API (Claude Haiku)
```

The frontend also maintains a **sessionStorage cache** (`sGet`/`sSet`/`sCacheKey`) so the same tab never re-fetches data for a destination it already loaded this session.

### Key sections of FareSpark.jsx

| Lines (approx) | Section |
|---|---|
| 1–40 | Model constant, proxy config, affiliate link builders (`AFF` object) |
| 84–98 | `AdSlot` component — replace the placeholder with real AdSense `<ins>` tags |
| 100–165 | Theme system (`useTheme`, `useTokens`) — all design tokens live here |
| 146–193 | `askClaude` (API call with 1 retry) and `parseJSON` (resilient JSON extractor) |
| 416–571 | `HeroSearch` — the main trip search form |
| 574–911 | `ItineraryTab` — day-by-day itinerary display |
| 913–999 | `FlightsTab` — AI flight suggestions + affiliate booking links |
| 1040–1168 | `HotelsTab` — AI hotel suggestions + Booking.com affiliate links |
| 1171–1295 | `CarsTab` — AI car rental suggestions + Kayak/Expedia affiliate links |
| 1250–1377 | `WeatherTab` — real forecast from Open-Meteo (free, no key required) |
| 1380–1520 | `LandingSections` — marketing content shown before first search |
| 1520+ | `App` — root component, `handleSearch`, tab routing, URL share state |

### Affiliate link IDs

All affiliate placeholders use `YOURAFFID`. Search for this string to find every link that needs a real affiliate ID before going live.

### Environment variables

| Variable | Where set | Purpose |
|---|---|---|
| `VITE_PROXY_URL` | `.env` (local) | Routes Claude calls through the Vercel function |
| `ANTHROPIC_API_KEY` | Vercel dashboard (no `VITE_` prefix) | Used server-side only in `api/claude.js` |
| `KV_REST_API_URL` | Vercel KV integration | Upstash Redis URL, injected automatically |
| `KV_REST_API_TOKEN` | Vercel KV integration | Upstash Redis token, injected automatically |
| `STAY22_AID` | hardcoded as `YOURAFFID` in `FareSpark.jsx` | Stay22 affiliate ID — replace every `YOURAFFID` in `AFF.stay22Hotels` and the widget `data-aid` attribute |

### Build quirk

`npm run build` runs a Node script before Vite to replace curly/smart quotes in `FareSpark.jsx` with straight quotes. This prevents JSX parse errors if the file is edited in an editor that auto-converts quotes.
