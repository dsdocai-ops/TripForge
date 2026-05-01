import { useEffect, useState } from "react";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

/**
 * Design system — fonts & colors (all formats used in this file)
 *
 * Fonts
 * - Plus Jakarta Sans (Google Fonts): weights 400, 500, 600, 700 — UI + headings
 * - ui-monospace stack — API key fields only
 *
 * Colors (hex #RRGGBB unless noted)
 * - bg #0b0c0f, bg2 #0f1117, elevated #12151c, surface #171a22, surfaceHover #1e222c
 * - text #e8eaef, textMuted #9aa3b2, textSubtle #5c6473
 * - accent #2dd4bf, accentHi #5eead4, accentLow rgba(45,212,191,0.12), accentBorder rgba(45,212,191,0.35)
 * - border rgba(255,255,255,0.07), borderStrong rgba(255,255,255,0.12)
 * - success #4ade80, danger #fb7185, info #38bdf8
 * - overlay rgba(6,8,12,0.92)
 * - header scrim rgba(11,12,15,0.82)
 * - rating pill rgba(74, 222, 128, 0.14)
 * - scrollbar thumb rgba(45, 212, 191, 0.25)
 *
 * Raster images (https JPEG, Unsplash CDN) — use unsplashPhoto() for fm=jpg + crop
 * - Flights (per airline): see AIRLINE_AIRCRAFT_IMG
 * - Hotels: photo-1566073771259-6a8506099945, photo-1618773928121-c32242e63f39,
 *   photo-1520250497591-112f2f40a3f4, photo-1590490360182-c33d57733427
 * - Cars: photo-1449965408869-eaa3f722e40d, photo-1519641471654-76ce0107ad1b,
 *   photo-1494976388531-d0858494cdd9, photo-1555215695-3004980ad54e
 */
const TF = {
  fontSans: `"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  fontMono: `ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace`,
  c: {
    bg: "#0b0c0f",
    bg2: "#0f1117",
    elevated: "#12151c",
    surface: "#171a22",
    surfaceHover: "#1e222c",
    border: "rgba(255,255,255,0.07)",
    borderStrong: "rgba(255,255,255,0.12)",
    text: "#e8eaef",
    textMuted: "#9aa3b2",
    textSubtle: "#5c6473",
    accent: "#2dd4bf",
    accentHi: "#5eead4",
    accentLow: "rgba(45,212,191,0.12)",
    accentBorder: "rgba(45,212,191,0.35)",
    onAccent: "#061312",
    success: "#4ade80",
    danger: "#fb7185",
    info: "#38bdf8",
    overlay: "rgba(6,8,12,0.92)",
  },
};

// ── Utility ──────────────────────────────────────────────────────────────────

async function askClaude(systemPrompt, userPrompt, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Claude API error");
  }
  const data = await res.json();
  return data.content.map((b) => b.text || "").join("");
}

function parseJSON(raw) {
  const clean = raw.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{") !== -1 ? clean.indexOf("{") : clean.indexOf("[");
  const end = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
  return JSON.parse(clean.slice(start, end + 1));
}

/** Unsplash: explicit jpg + crop improves compatibility vs default negotiation */
function unsplashPhoto(id, w, h) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=82&fm=jpg`;
}

const AIRLINE_AIRCRAFT_IMG = {
  "Delta Airlines": unsplashPhoto("photo-1569154941061-e231b4725ef1", 960, 640),
  "American Airlines": unsplashPhoto("photo-1436491865332-7a61a109cc05", 960, 640),
  "United Airlines": unsplashPhoto("photo-1540962357608-b2e3bba36c18", 960, 640),
  "Lufthansa": unsplashPhoto("photo-1570145007675-901791fe9fdb", 960, 640),
};

function airlineAircraftImage(airline) {
  return AIRLINE_AIRCRAFT_IMG[airline] || unsplashPhoto("photo-1464037866556-abfb2b3b75a3", 960, 640);
}

// ── Icon system (inline SVG as <img/>) ─────────────────────────────────────────
function svgToDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const ImgIcon = ({ name, size = 20, color = TF.c.textMuted, title }) => {
  const stroke = color;
  const fill = color;

  const icons = {
    plane: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`,
    hotel: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>`,
    car: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16V6a2 2 0 012-2h11a2 2 0 012 2v10"/><path d="M3 12h17"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
    map: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15"/><path d="M15 6v15"/></svg>`,
    sun: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/></svg>`,
    cloud: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>`,
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>`,
    pin: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s6-4.35 6-10a6 6 0 10-12 0c0 5.65 6 10 6 10z"/><circle cx="12" cy="11" r="2"/></svg>`,
    home: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z"/></svg>`,
    users: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    dollar: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
    target: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    spark: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>`,
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
    x: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,

    // Hotel amenities / small glyphs
    wifi: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0114 0"/><path d="M8.5 16.1a6 6 0 017 0"/><path d="M12 20h0"/></svg>`,
    coffee: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h11a4 4 0 010 8H7a4 4 0 01-4-4v-4z"/><path d="M14 14h3a3 3 0 010 6h-3"/><path d="M8 2v4"/><path d="M12 2v4"/></svg>`,
    breakfast: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="M6 19c0-7 2-12 6-12s6 5 6 12"/></svg>`,
    pool: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 6h10"/><path d="M7 10h10"/><path d="M7 14h10"/><path d="M4 18c2 2 6 2 8 0s6-2 8 0"/></svg>`,
    parking: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M10 7h4a3 3 0 010 6h-4v4"/></svg>`,
    spa: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-4 7-10a7 7 0 10-14 0c0 6 7 10 7 10z"/><path d="M9 12c1 1 2 1 3 0s2-1 3 0"/></svg>`,
    restaurant: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h2v7a2 2 0 01-2 2H2V3h2z"/><path d="M6 3v7"/><path d="M14 3v9a2 2 0 01-2 2h-1"/><path d="M14 3h2a4 4 0 010 8h-2"/></svg>`,
    bike: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5L9 10h4l3 7.5"/><path d="M10 6h2"/><path d="M9 10L7 6h4"/></svg>`,
    gym: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7v10"/><path d="M18 7v10"/><path d="M8 10h8"/><path d="M8 14h8"/><rect x="2" y="9" width="3" height="6" rx="1"/><rect x="19" y="9" width="3" height="6" rx="1"/></svg>`,
    chevron: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
  };

  const svg = icons[name];
  if (!svg) return null;
  return (
    <img
      src={svgToDataUri(svg)}
      alt={title || name}
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "middle" }}
      draggable={false}
    />
  );
};

// ── Icons (inline SVG as JSX) ─────────────────────────────────────────────────
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const icons = {
    plane: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>,
    hotel: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    car: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    sun: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    map: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
    star: <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    settings: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    sparkle: <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    cloud: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>,
    dollar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    arrow: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    bag: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
    info: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  };
  return icons[name] || null;
};

/** Remote cover with fallback (avoids broken layout when CDN blocks or URL fails) */
function MediaCover({ src, alt = "", height, minHeight = 120, iconName = "plane" }) {
  const [failed, setFailed] = useState(false);
  const h = height ?? minHeight;
  return (
    <div
      key={src}
      style={{
        position: "relative",
        width: "100%",
        height: height != null ? height : undefined,
        minHeight: h,
        background: TF.c.bg2,
        overflow: "hidden",
      }}
    >
      {failed ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(160deg, ${TF.c.surface}, ${TF.c.bg2})`,
            border: `1px solid ${TF.c.border}`,
          }}
        >
          <ImgIcon name={iconName} size={iconName === "car" ? 38 : 40} color={TF.c.accent} title="" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
          }}
        />
      )}
    </div>
  );
}

// ── Skeleton Loader ───────────────────────────────────────────────────────────
const Skeleton = ({ h = "1rem", w = "100%", radius = "8px" }) => (
  <div style={{
    height: h, width: w, borderRadius: radius,
    background: `linear-gradient(90deg, ${TF.c.surface} 25%, ${TF.c.surfaceHover} 50%, ${TF.c.surface} 75%)`,
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
  }} />
);

// ── API Key Modal ─────────────────────────────────────────────────────────────
function ApiKeyModal({ onSave }) {
  const [key, setKey] = useState("");
  return (
    <div style={{
      position:"fixed",inset:0,background:TF.c.overlay,display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:1000,
      fontFamily:TF.fontSans
    }}>
      <div style={{
        background:`linear-gradient(165deg, ${TF.c.elevated}, ${TF.c.surface})`,
        border:`1px solid ${TF.c.borderStrong}`,borderRadius:"16px",
        padding:"48px",maxWidth:"480px",width:"90%",textAlign:"center",
        boxShadow:"0 24px 64px rgba(0,0,0,0.45)"
      }}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:"16px"}}>
          <div style={{width:"56px",height:"56px",borderRadius:"14px",background:TF.c.accentLow,border:`1px solid ${TF.c.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <ImgIcon name="plane" size={28} color={TF.c.accent} title="TripForge" />
          </div>
        </div>
        <h2 style={{fontFamily:TF.fontSans,color:TF.c.text,fontSize:"26px",fontWeight:700,margin:"0 0 12px",letterSpacing:"-0.02em"}}>
          Welcome to TripForge
        </h2>
        <p style={{color:TF.c.textMuted,fontSize:"14px",lineHeight:"1.6",margin:"0 0 32px"}}>
          Enter your Anthropic API key for itineraries, packing lists, and budget ideas. Your key stays in this browser only.
        </p>
        <input
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="sk-ant-api03-..."
          type="password"
          style={{
            width:"100%",padding:"14px 18px",borderRadius:"10px",
            background:TF.c.bg2,border:`1px solid ${TF.c.borderStrong}`,
            color:TF.c.text,fontSize:"14px",outline:"none",boxSizing:"border-box",
            fontFamily:TF.fontMono,marginBottom:"16px"
          }}
        />
        <button
          onClick={() => key.trim() && onSave(key.trim())}
          style={{
            width:"100%",padding:"14px",borderRadius:"10px",border:"none",
            background:`linear-gradient(135deg, ${TF.c.accent}, ${TF.c.accentHi})`,
            color:TF.c.onAccent,fontWeight:700,fontSize:"15px",cursor:"pointer",
            fontFamily:TF.fontSans,letterSpacing:"0.02em"
          }}
        >
          Continue
        </button>
        <p style={{color:TF.c.textSubtle,fontSize:"12px",marginTop:"20px"}}>
          Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{color:TF.c.accentHi}}>console.anthropic.com</a>
        </p>
      </div>
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel({ settings, onChange, onClose, apiKey, onChangeKey }) {
  const [newKey, setNewKey] = useState(apiKey);
  return (
    <div style={{
      position:"fixed",top:0,right:0,bottom:0,width:"340px",
      background:`linear-gradient(180deg, ${TF.c.elevated}, ${TF.c.bg})`,
      borderLeft:`1px solid ${TF.c.border}`,zIndex:900,
      padding:"32px 24px",fontFamily:TF.fontSans,
      overflowY:"auto"
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"32px"}}>
        <h3 style={{color:TF.c.text,fontFamily:TF.fontSans,fontSize:"18px",fontWeight:700,margin:0,letterSpacing:"-0.02em"}}>Settings</h3>
        <button onClick={onClose} style={{background:"none",border:"none",color:TF.c.textMuted,cursor:"pointer"}}>
          <ImgIcon name="x" size={22} color={TF.c.textMuted} title="Close" />
        </button>
      </div>
      {[
        {label:"Currency", key:"currency", options:["USD","EUR","GBP","CAD","AUD","JPY"]},
        {label:"Temperature", key:"units", options:["Fahrenheit","Celsius"]},
        {label:"Distance", key:"distance", options:["Miles","Kilometers"]},
      ].map(({label,key,options}) => (
        <div key={key} style={{marginBottom:"24px"}}>
          <label style={{color:TF.c.textMuted,fontSize:"11px",letterSpacing:"0.06em",textTransform:"uppercase",display:"block",marginBottom:"8px",fontWeight:600}}>{label}</label>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            {options.map(opt => (
              <button key={opt} onClick={() => onChange({...settings,[key]:opt})}
                style={{
                  padding:"8px 14px",borderRadius:"8px",border:"1px solid",cursor:"pointer",fontSize:"13px",
                  borderColor: settings[key]===opt ? TF.c.accentBorder:TF.c.border,
                  background: settings[key]===opt ? TF.c.accentLow:"transparent",
                  color: settings[key]===opt ? TF.c.accentHi:TF.c.textMuted,
                }}>{opt}</button>
            ))}
          </div>
        </div>
      ))}
      <div style={{marginBottom:"24px"}}>
        <label style={{color:TF.c.textMuted,fontSize:"11px",letterSpacing:"0.06em",textTransform:"uppercase",display:"block",marginBottom:"8px",fontWeight:600}}>Filters</label>
        {[
          {label:"Refundable bookings only",key:"refundableOnly"},
          {label:"Direct flights only",key:"directOnly"},
          {label:"Show affiliate links",key:"showAffiliates"},
        ].map(({label,key}) => (
          <div key={key} onClick={() => onChange({...settings,[key]:!settings[key]})}
            style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 0",cursor:"pointer",borderBottom:`1px solid ${TF.c.border}`}}>
            <div style={{
              width:"20px",height:"20px",borderRadius:"6px",border:"1px solid",
              borderColor: settings[key] ? TF.c.accentBorder:TF.c.borderStrong,
              background: settings[key] ? TF.c.accentLow:"transparent",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              {settings[key] && <Icon name="check" size={12} color={TF.c.accent} />}
            </div>
            <span style={{color:TF.c.text,fontSize:"14px"}}>{label}</span>
          </div>
        ))}
      </div>
      <div>
        <label style={{color:TF.c.textMuted,fontSize:"11px",letterSpacing:"0.06em",textTransform:"uppercase",display:"block",marginBottom:"8px",fontWeight:600}}>API Key</label>
        <input value={newKey} onChange={e=>setNewKey(e.target.value)} type="password"
          style={{width:"100%",padding:"10px 14px",background:TF.c.bg2,border:`1px solid ${TF.c.borderStrong}`,borderRadius:"8px",color:TF.c.text,fontSize:"13px",fontFamily:TF.fontMono,outline:"none",boxSizing:"border-box",marginBottom:"8px"}}/>
        <button onClick={() => onChangeKey(newKey)}
          style={{width:"100%",padding:"10px",background:TF.c.accentLow,border:`1px solid ${TF.c.accentBorder}`,borderRadius:"8px",color:TF.c.accentHi,cursor:"pointer",fontSize:"13px",fontWeight:600}}>
          Update Key
        </button>
      </div>
    </div>
  );
}

// ── Hero Search ───────────────────────────────────────────────────────────────
function HeroSearch({ onSearch, loading }) {
  const [form, setForm] = useState({
    destination:"",from:"",dateFrom:"",dateTo:"",travelers:"2",budget:"3000",style:"relaxation"
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  return (
    <div style={{
      background:`linear-gradient(180deg, ${TF.c.accentLow} 0%, transparent 55%)`,
      border:`1px solid ${TF.c.border}`,borderRadius:"16px",padding:"32px 36px",
      marginBottom:"40px"
    }}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"16px",marginBottom:"20px"}}>
        {[
          {label:"Destination",icon:"pin",key:"destination",placeholder:"Paris, Tokyo, Bali…"},
          {label:"Departing from",icon:"home",key:"from",placeholder:"New York, London…"},
          {label:"Check-in",icon:"calendar",key:"dateFrom",type:"date"},
          {label:"Check-out",icon:"calendar",key:"dateTo",type:"date"},
        ].map(({label,key,placeholder,type="text"}) => (
          <div key={key}>
            <label style={{color:TF.c.textMuted,fontSize:"11px",letterSpacing:"0.06em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",fontWeight:600}}>
              <ImgIcon name={key === "destination" ? "pin" : key === "from" ? "home" : "calendar"} size={14} color={TF.c.textMuted} title={label} />
              <span>{label}</span>
            </label>
            <input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder} type={type}
              style={{
                width:"100%",padding:"12px 14px",background:TF.c.bg2,
                border:`1px solid ${TF.c.borderStrong}`,borderRadius:"10px",color:TF.c.text,
                fontSize:"14px",outline:"none",boxSizing:"border-box",colorScheme:"dark"
              }}/>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:"16px",alignItems:"end"}}>
        <div>
          <label style={{color:TF.c.textMuted,fontSize:"11px",letterSpacing:"0.06em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",fontWeight:600}}>
            <ImgIcon name="users" size={14} color={TF.c.textMuted} title="Travelers" />
            <span>Travelers</span>
          </label>
          <input value={form.travelers} onChange={e=>set("travelers",e.target.value)} type="number" min="1" max="20"
            style={{width:"100%",padding:"12px 14px",background:TF.c.bg2,border:`1px solid ${TF.c.borderStrong}`,borderRadius:"10px",color:TF.c.text,fontSize:"14px",outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div>
          <label style={{color:TF.c.textMuted,fontSize:"11px",letterSpacing:"0.06em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",fontWeight:600}}>
            <ImgIcon name="dollar" size={14} color={TF.c.textMuted} title="Budget" />
            <span>Budget (USD)</span>
          </label>
          <input value={form.budget} onChange={e=>set("budget",e.target.value)} type="number"
            style={{width:"100%",padding:"12px 14px",background:TF.c.bg2,border:`1px solid ${TF.c.borderStrong}`,borderRadius:"10px",color:TF.c.text,fontSize:"14px",outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div>
          <label style={{color:TF.c.textMuted,fontSize:"11px",letterSpacing:"0.06em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",fontWeight:600}}>
            <ImgIcon name="target" size={14} color={TF.c.textMuted} title="Trip style" />
            <span>Trip style</span>
          </label>
          <select value={form.style} onChange={e=>set("style",e.target.value)}
            style={{width:"100%",padding:"12px 14px",background:TF.c.bg2,border:`1px solid ${TF.c.borderStrong}`,borderRadius:"10px",color:TF.c.text,fontSize:"14px",outline:"none",boxSizing:"border-box"}}>
            {["relaxation","adventure","culture","family","romance","food & wine","backpacking"].map(s=>(
              <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
            ))}
          </select>
        </div>
        <button onClick={() => onSearch(form)} disabled={loading || !form.destination}
          style={{
            padding:"12px 28px",background:loading?TF.c.surfaceHover:`linear-gradient(135deg, ${TF.c.accent}, ${TF.c.accentHi})`,
            border:"none",borderRadius:"10px",color:loading?TF.c.textSubtle:TF.c.onAccent,fontWeight:700,fontSize:"15px",
            cursor:loading?"not-allowed":"pointer",fontFamily:TF.fontSans,
            whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"8px"
          }}>
          {loading ? "Planning…" : <><ImgIcon name="spark" size={16} color={TF.c.onAccent} title="Plan" />Plan trip</>}
        </button>
      </div>
      <button onClick={() => onSearch({...form, destination: "Surprise me!", surpriseMode: true})}
        style={{marginTop:"16px",background:"transparent",border:`1px dashed ${TF.c.borderStrong}`,borderRadius:"10px",
          padding:"10px 20px",color:TF.c.accentHi,cursor:"pointer",fontSize:"13px",width:"100%",fontWeight:500}}>
        Surprise me — pick a destination within budget
      </button>
    </div>
  );
}

// ── Itinerary Tab ─────────────────────────────────────────────────────────────
function ItineraryTab({ tripData, loading, form, apiKey }) {
  const [cheaperLoading, setCheaperLoading] = useState(false);
  const [cheaperTip, setCheaperTip] = useState("");
  const [packingLoading, setPackingLoading] = useState(false);
  const [packingList, setPackingList] = useState(null);

  async function getCheaper() {
    setCheaperLoading(true); setCheaperTip("");
    try {
      const res = await askClaude(
        "You are a budget travel expert. Respond in 3–4 concise bullet points.",
        `How can someone save money on a ${form.style} trip to ${form.destination} with a $${form.budget} budget for ${form.travelers} travelers?`,
        apiKey
      );
      setCheaperTip(res);
    } catch(e) { setCheaperTip("Error: "+e.message); }
    setCheaperLoading(false);
  }

  async function getPacking() {
    setPackingLoading(true); setPackingList(null);
    try {
      const raw = await askClaude(
        `You are a packing list expert. Return ONLY a JSON object: {"categories":[{"name":"string","items":["string"]}]}. No markdown.`,
        `Packing list for a ${form.style} trip to ${form.destination} from ${form.dateFrom} to ${form.dateTo} for ${form.travelers} travelers.`,
        apiKey
      );
      setPackingList(parseJSON(raw));
    } catch(e) { setPackingList({error: e.message}); }
    setPackingLoading(false);
  }

  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
      {[1,2,3].map(i=>(
        <div key={i} style={{background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"14px",padding:"24px",display:"flex",flexDirection:"column",gap:"12px"}}>
          <Skeleton h="24px" w="40%" />
          <Skeleton h="16px" /><Skeleton h="16px" w="80%" /><Skeleton h="16px" w="60%" />
        </div>
      ))}
    </div>
  );

  if (!tripData) return (
    <div style={{textAlign:"center",padding:"80px 20px",color:TF.c.textSubtle}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:"16px"}}>
        <div style={{width:"64px",height:"64px",borderRadius:"16px",background:TF.c.surface,border:`1px solid ${TF.c.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <ImgIcon name="map" size={28} color={TF.c.textMuted} title="Map" />
        </div>
      </div>
      <p style={{fontSize:"17px",color:TF.c.textMuted}}>Enter your trip details above to build an itinerary</p>
    </div>
  );

  const { destination, summary, days, budgetBreakdown, tips } = tripData;

  return (
    <div>
      {summary && (
        <div style={{background:`linear-gradient(145deg, ${TF.c.accentLow}, transparent)`,border:`1px solid ${TF.c.border}`,borderRadius:"14px",padding:"24px",marginBottom:"28px"}}>
          <h2 style={{fontFamily:TF.fontSans,color:TF.c.text,fontSize:"24px",fontWeight:700,margin:"0 0 8px",letterSpacing:"-0.02em"}}>{destination}</h2>
          <p style={{color:TF.c.textMuted,lineHeight:"1.7",margin:0}}>{summary}</p>
        </div>
      )}

      {budgetBreakdown && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:"12px",marginBottom:"28px"}}>
          {Object.entries(budgetBreakdown).map(([k,v]) => (
            <div key={k} style={{background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"12px",padding:"16px",textAlign:"center"}}>
              <div style={{color:TF.c.accentHi,fontSize:"18px",fontWeight:700}}>{v}</div>
              <div style={{color:TF.c.textMuted,fontSize:"12px",textTransform:"capitalize",marginTop:"4px"}}>{k}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:"12px",marginBottom:"28px",flexWrap:"wrap"}}>
        <button onClick={getCheaper} disabled={cheaperLoading}
          style={{padding:"10px 20px",background:TF.c.accentLow,border:`1px solid ${TF.c.accentBorder}`,borderRadius:"10px",color:TF.c.accentHi,cursor:"pointer",fontSize:"13px",display:"flex",alignItems:"center",gap:"8px",fontWeight:600}}>
          <Icon name="dollar" size={14} color={TF.c.accent}/>
          {cheaperLoading ? "Thinking…" : "Can I do this cheaper?"}
        </button>
        <button onClick={getPacking} disabled={packingLoading}
          style={{padding:"10px 20px",background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"10px",color:TF.c.text,cursor:"pointer",fontSize:"13px",display:"flex",alignItems:"center",gap:"8px",fontWeight:500}}>
          <Icon name="bag" size={14} color={TF.c.textMuted}/>
          {packingLoading ? "Generating…" : "Generate packing list"}
        </button>
      </div>

      {cheaperTip && (
        <div style={{background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"12px",padding:"20px",marginBottom:"24px",color:TF.c.text,lineHeight:"1.7",whiteSpace:"pre-wrap",fontSize:"14px"}}>
          {cheaperTip}
        </div>
      )}

      {packingList && !packingList.error && (
        <div style={{background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"14px",padding:"24px",marginBottom:"24px"}}>
          <h3 style={{color:TF.c.text,fontFamily:TF.fontSans,fontWeight:700,marginTop:0,fontSize:"17px",letterSpacing:"-0.02em"}}>Packing list</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"20px"}}>
            {packingList.categories?.map(cat => (
              <div key={cat.name}>
                <div style={{color:TF.c.text,fontWeight:600,marginBottom:"8px",fontSize:"14px"}}>{cat.name}</div>
                <ul style={{margin:0,padding:"0 0 0 16px",color:TF.c.textMuted,fontSize:"13px",lineHeight:"1.8"}}>
                  {cat.items?.map(item => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {days?.map((day, i) => (
        <DayCard key={i} day={day} index={i} />
      ))}

      {tips && tips.length > 0 && (
        <div style={{background:TF.c.elevated,border:`1px solid ${TF.c.border}`,borderRadius:"14px",padding:"24px",marginTop:"16px"}}>
          <h3 style={{color:TF.c.text,fontFamily:TF.fontSans,fontWeight:700,marginTop:0,fontSize:"17px",letterSpacing:"-0.02em"}}>Local tips</h3>
          <ul style={{margin:0,padding:"0 0 0 20px",color:TF.c.textMuted,lineHeight:"2",fontSize:"14px"}}>
            {tips.map((t,i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function DayCard({ day, index }) {
  const [open, setOpen] = useState(index < 2);
  return (
    <div style={{background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"14px",marginBottom:"12px",overflow:"hidden"}}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{width:"100%",padding:"18px 22px",background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left"}}>
        <div>
          <span style={{color:TF.c.accent,fontWeight:600,fontSize:"11px",letterSpacing:"0.08em",textTransform:"uppercase"}}>Day {index + 1}</span>
          <h3 style={{color:TF.c.text,margin:"6px 0 0",fontFamily:TF.fontSans,fontSize:"17px",fontWeight:600,letterSpacing:"-0.02em"}}>{day.title || day.theme}</h3>
        </div>
        <span style={{display:"flex",transform:open?"rotate(90deg)":"none",transition:"transform 0.2s"}}>
          <ImgIcon name="chevron" size={22} color={TF.c.textMuted} title={open ? "Collapse" : "Expand"} />
        </span>
      </button>
      {open && (
        <div style={{padding:"0 22px 22px"}}>
          {day.activities?.map((act, j) => (
            <div key={j} style={{display:"flex",gap:"16px",padding:"12px 0",borderTop:`1px solid ${TF.c.border}`}}>
              <div style={{color:TF.c.accentHi,fontSize:"12px",fontWeight:600,minWidth:"64px",paddingTop:"2px",fontVariantNumeric:"tabular-nums"}}>{act.time}</div>
              <div>
                <div style={{color:TF.c.text,fontWeight:600,fontSize:"14px"}}>{act.name || act.activity}</div>
                <div style={{color:TF.c.textMuted,fontSize:"13px",marginTop:"4px",lineHeight:"1.5"}}>{act.description || act.details}</div>
                {act.cost && <div style={{color:TF.c.accent,fontSize:"12px",marginTop:"4px",fontWeight:500}}>~{act.cost}</div>}
              </div>
            </div>
          ))}
          {day.notes && <p style={{color:TF.c.textMuted,fontSize:"13px",marginTop:"12px",fontStyle:"italic"}}>{day.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ── Flights Tab ───────────────────────────────────────────────────────────────
function FlightsTab({ form, settings }) {
  const skyscannerUrl = form.destination
    ? `https://www.skyscanner.com/transport/flights/${encodeURIComponent(form.from || "")}/${encodeURIComponent(form.destination)}/${form.dateFrom?.replace(/-/g,"")}/`
    : "https://www.skyscanner.com";

  const googleFlightsUrl = form.destination
    ? `https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(form.from||"")}+to+${encodeURIComponent(form.destination)}`
    : "https://www.google.com/travel/flights";

  // Mock flight data for demo (real: Amadeus API)
  const mockFlights = [
    { airline:"Delta Airlines", from:form.from||"JFK", to:form.destination||"Destination", depart:"08:15", arrive:"14:30", duration:"6h 15m", stops:0, price:487, refundable:true, link: skyscannerUrl },
    { airline:"American Airlines", from:form.from||"JFK", to:form.destination||"Destination", depart:"11:40", arrive:"18:55", duration:"7h 15m", stops:1, price:342, refundable:false, link: skyscannerUrl },
    { airline:"United Airlines", from:form.from||"JFK", to:form.destination||"Destination", depart:"22:00", arrive:"12:20+1", duration:"14h 20m", stops:1, price:299, refundable:false, link: skyscannerUrl },
    { airline:"Lufthansa", from:form.from||"JFK", to:form.destination||"Destination", depart:"16:50", arrive:"08:30+1", duration:"15h 40m", stops:0, price:612, refundable:true, link: "https://www.lufthansa.com" },
  ].filter(f => !settings.refundableOnly || f.refundable)
   .filter(f => !settings.directOnly || f.stops === 0);

  return (
    <div>
      <div style={{display:"flex",gap:"12px",marginBottom:"24px",flexWrap:"wrap"}}>
        <a href={skyscannerUrl} target="_blank" rel="noopener noreferrer"
          style={{padding:"10px 18px",background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"10px",color:TF.c.text,textDecoration:"none",fontSize:"13px",fontWeight:600}}>
          Search Skyscanner
        </a>
        <a href={googleFlightsUrl} target="_blank" rel="noopener noreferrer"
          style={{padding:"10px 18px",background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"10px",color:TF.c.text,textDecoration:"none",fontSize:"13px",fontWeight:600}}>
          Google Flights
        </a>
        <a href="https://www.kayak.com/flights" target="_blank" rel="noopener noreferrer"
          style={{padding:"10px 18px",background:TF.c.bg2,border:`1px solid ${TF.c.border}`,borderRadius:"10px",color:TF.c.textMuted,textDecoration:"none",fontSize:"13px"}}>
          Kayak
        </a>
        <a href="https://www.expedia.com/Flights-Search" target="_blank" rel="noopener noreferrer"
          style={{padding:"10px 18px",background:TF.c.bg2,border:`1px solid ${TF.c.border}`,borderRadius:"10px",color:TF.c.textMuted,textDecoration:"none",fontSize:"13px"}}>
          Expedia
        </a>
      </div>

      <div style={{background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"12px",padding:"16px",marginBottom:"24px",display:"flex",gap:"12px",alignItems:"flex-start"}}>
        <ImgIcon name="info" size={18} color={TF.c.info} title="Info" />
        <p style={{color:TF.c.textMuted,fontSize:"13px",margin:0,lineHeight:"1.65"}}>
          <strong style={{color:TF.c.text}}>Note:</strong> Sample fares below. Use the links for live pricing. For app integration, see the{" "}
          <a href="https://developers.amadeus.com" target="_blank" rel="noreferrer" style={{color:TF.c.accentHi}}>Amadeus Flight API</a>.
        </p>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
        {mockFlights.map((f, i) => (
          <div
            key={`${f.airline}-${i}`}
            className="tf-flight-card"
            style={{
              background:TF.c.surface,
              border:`1px solid ${TF.c.border}`,
              borderRadius:"16px",
              overflow:"hidden",
              boxShadow: i===2 ? `0 0 0 1px ${TF.c.accentBorder}` : "none",
            }}
          >
            <div
              className="tf-flight-media"
              style={{
                position: "relative",
                borderRight: `1px solid ${TF.c.border}`,
              }}
            >
              {i === 2 && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    zIndex: 2,
                    background: TF.c.accent,
                    color: TF.c.onAccent,
                    fontSize: "9px",
                    fontWeight: 800,
                    padding: "5px 8px",
                    borderRadius: "6px",
                    letterSpacing: "0.08em",
                  }}
                >
                  BEST VALUE
                </div>
              )}
              <MediaCover
                src={airlineAircraftImage(f.airline)}
                alt={`${f.airline} aircraft`}
                height={136}
                minHeight={136}
                iconName="plane"
              />
            </div>
            <div
              style={{
                flex: 1,
                padding: "18px 20px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div style={{ minWidth: "160px" }}>
                <div style={{ color: TF.c.text, fontWeight: 700, fontSize: "16px", letterSpacing: "-0.02em" }}>{f.airline}</div>
                <div style={{ color: TF.c.textMuted, fontSize: "13px", marginTop: "4px" }}>
                  {f.stops === 0 ? "Nonstop" : `${f.stops} stop`} · {f.duration}
                </div>
              </div>
              <div style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center", minWidth: "56px" }}>
                  <div style={{ color: TF.c.textSubtle, fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Depart</div>
                  <div style={{ color: TF.c.text, fontWeight: 700, fontSize: "18px", fontVariantNumeric: "tabular-nums" }}>{f.depart}</div>
                  <div style={{ color: TF.c.textMuted, fontSize: "12px" }}>{f.from}</div>
                </div>
                <div style={{ color: TF.c.textSubtle, fontSize: "20px", fontWeight: 200, lineHeight: 1 }} aria-hidden>→</div>
                <div style={{ textAlign: "center", minWidth: "56px" }}>
                  <div style={{ color: TF.c.textSubtle, fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Arrive</div>
                  <div style={{ color: TF.c.text, fontWeight: 700, fontSize: "18px", fontVariantNumeric: "tabular-nums" }}>{f.arrive}</div>
                  <div style={{ color: TF.c.textMuted, fontSize: "12px" }}>{f.to}</div>
                </div>
              </div>
              <div style={{ textAlign: "right", minWidth: "120px" }}>
                <div style={{ color: TF.c.accentHi, fontWeight: 800, fontSize: "24px", fontVariantNumeric: "tabular-nums" }}>${f.price}</div>
                <div style={{ color: f.refundable ? TF.c.success : TF.c.danger, fontSize: "11px", margin: "6px 0 10px", fontWeight: 600 }}>
                  {f.refundable ? "Refundable" : "Non-refundable"}
                </div>
                <a
                  href={f.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "9px 18px",
                    background: `linear-gradient(135deg, ${TF.c.accent}, ${TF.c.accentHi})`,
                    borderRadius: "10px",
                    color: TF.c.onAccent,
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Book
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hotels Tab ────────────────────────────────────────────────────────────────
function HotelsTab({ form, settings }) {
  const hotels = [
    { name:"Le Grand Palace", stars:5, rating:9.4, reviews:2341, price:289, refundable:true, amenities:[{icon:"pool",label:"Pool"},{icon:"restaurant",label:"Restaurant"},{icon:"spa",label:"Spa"},{icon:"parking",label:"Parking"}], imageUrl: unsplashPhoto("photo-1566073771259-6a8506099945", 1200, 800), link:`https://www.booking.com/search.html?ss=${encodeURIComponent(form.destination||"")}` },
    { name:"Boutique Central", stars:4, rating:9.1, reviews:876, price:145, refundable:true, amenities:[{icon:"breakfast",label:"Breakfast"},{icon:"wifi",label:"Wi‑Fi"},{icon:"bike",label:"Bikes"}], imageUrl: unsplashPhoto("photo-1618773928121-c32242e63f39", 1200, 800), link:`https://www.booking.com/search.html?ss=${encodeURIComponent(form.destination||"")}` },
    { name:"Urban Loft Hotel", stars:4, rating:8.8, reviews:1203, price:118, refundable:false, amenities:[{icon:"wifi",label:"Wi‑Fi"},{icon:"gym",label:"Gym"},{icon:"coffee",label:"Coffee"}], imageUrl: unsplashPhoto("photo-1520250497591-112f2f40a3f4", 1200, 800), link:`https://www.hotels.com/search.do?q-destination=${encodeURIComponent(form.destination||"")}` },
    { name:"The Traveler's Inn", stars:3, rating:8.5, reviews:4520, price:74, refundable:true, amenities:[{icon:"wifi",label:"Wi‑Fi"},{icon:"breakfast",label:"Breakfast"}], imageUrl: unsplashPhoto("photo-1590490360182-c33d57733427", 1200, 800), link:`https://www.tripadvisor.com/Search?q=${encodeURIComponent(form.destination||"")}+hotels` },
  ].filter(h => !settings.refundableOnly || h.refundable);

  return (
    <div>
      <div style={{display:"flex",gap:"12px",marginBottom:"24px",flexWrap:"wrap"}}>
        {[
          {name:"Booking.com",url:`https://www.booking.com/search.html?ss=${encodeURIComponent(form.destination||"")}`,color:"#003580"},
          {name:"Hotels.com",url:`https://www.hotels.com/search.do?q-destination=${encodeURIComponent(form.destination||"")}`,color:"#c8102e"},
          {name:"Expedia",url:`https://www.expedia.com/Hotels-Search?destination=${encodeURIComponent(form.destination||"")}`,color:"#003087"},
          {name:"TripAdvisor",url:`https://www.tripadvisor.com/Search?q=${encodeURIComponent(form.destination||"")}+hotels`,color:"#34e0a1"},
          {name:"Priceline",url:`https://www.priceline.com/relax/in/${encodeURIComponent(form.destination||"")}`,color:"#0066cc"},
        ].map(site => (
          <a key={site.name} href={site.url} target="_blank" rel="noopener noreferrer"
            style={{padding:"10px 16px",background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"10px",color:TF.c.textMuted,textDecoration:"none",fontSize:"13px",fontWeight:600}}>
            {site.name}
          </a>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:"16px"}}>
        {hotels.map((h, i) => (
          <div key={i} style={{background:TF.c.surface,border:`1px solid ${i===1?TF.c.accentBorder:TF.c.border}`,borderRadius:"14px",overflow:"hidden"}}>
            {i===1 && (
              <div style={{background:TF.c.accentLow,borderBottom:`1px solid ${TF.c.accentBorder}`,padding:"8px 16px",fontSize:"10px",fontWeight:700,color:TF.c.accentHi,letterSpacing:"0.08em"}}>
                BEST VALUE
              </div>
            )}
            <div style={{ height: 148, position: "relative", overflow: "hidden" }}>
              <MediaCover src={h.imageUrl} alt="" height={148} minHeight={148} iconName="hotel" />
              <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", background: "linear-gradient(to top, rgba(11,12,15,0.88) 0%, transparent 55%)" }} />
            </div>
            <div style={{padding:"18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                <div>
                  <h3 style={{color:TF.c.text,margin:"0 0 6px",fontSize:"16px",fontWeight:600,letterSpacing:"-0.02em"}}>{h.name}</h3>
                  <div style={{color:TF.c.textMuted,fontSize:"12px",fontWeight:500}}>{h.stars}-star property</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{color:TF.c.accentHi,fontWeight:800,fontSize:"20px",fontVariantNumeric:"tabular-nums"}}>${h.price}</div>
                  <div style={{color:TF.c.textMuted,fontSize:"11px"}}>/ night</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px"}}>
                <span style={{background:"rgba(74, 222, 128, 0.14)",color:TF.c.success,padding:"4px 10px",borderRadius:"8px",fontSize:"12px",fontWeight:700}}>{h.rating}</span>
                <span style={{color:TF.c.textMuted,fontSize:"12px"}}>{h.reviews.toLocaleString()} reviews</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginBottom:"16px"}}>
                {h.amenities.map((a) => (
                  <span key={a.label} style={{background:TF.c.bg2,border:`1px solid ${TF.c.border}`,borderRadius:"999px",padding:"5px 10px",fontSize:"11px",color:TF.c.textMuted,display:"inline-flex",alignItems:"center",gap:"6px"}}>
                    <ImgIcon name={a.icon} size={14} color={TF.c.textMuted} title={a.label} />
                    <span>{a.label}</span>
                  </span>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:"12px",fontWeight:600,color: h.refundable?TF.c.success:TF.c.danger}}>{h.refundable?"Free cancellation":"Non-refundable"}</span>
                <a href={h.link} target="_blank" rel="noopener noreferrer"
                  style={{padding:"8px 16px",background:`linear-gradient(135deg, ${TF.c.accent}, ${TF.c.accentHi})`,borderRadius:"8px",color:TF.c.onAccent,textDecoration:"none",fontSize:"13px",fontWeight:700}}>
                  View
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cars Tab ──────────────────────────────────────────────────────────────────
function CarsTab({ form }) {
  const dest = encodeURIComponent(form.destination || "");
  const cars = [
    { type:"Economy", example:"Toyota Yaris", price:28, link:`https://www.kayak.com/cars/${dest}`, imageUrl: unsplashPhoto("photo-1449965408869-eaa3f722e40d", 960, 600) },
    { type:"Compact SUV", example:"Nissan Rogue", price:52, link:`https://www.costcotravel.com/Rental-Cars`, imageUrl: unsplashPhoto("photo-1519641471654-76ce0107ad1b", 960, 600) },
    { type:"Midsize", example:"Toyota Camry", price:41, link:`https://www.rentalcars.com/en/`, imageUrl: unsplashPhoto("photo-1494976388531-d0858494cdd9", 960, 600) },
    { type:"Luxury", example:"BMW 5 Series", price:115, link:`https://www.expedia.com/Cars`, imageUrl: unsplashPhoto("photo-1555215695-3004980ad54e", 960, 600) },
  ];
  return (
    <div>
      <div style={{display:"flex",gap:"12px",marginBottom:"24px",flexWrap:"wrap"}}>
        {[
          {name:"Costco Travel",url:"https://www.costcotravel.com/Rental-Cars",badge:"Members save up to 25%"},
          {name:"Kayak Cars",url:`https://www.kayak.com/cars/${dest}`},
          {name:"RentalCars.com",url:`https://www.rentalcars.com`},
          {name:"Expedia Cars",url:"https://www.expedia.com/Cars"},
          {name:"Priceline",url:"https://www.priceline.com/drive"},
        ].map(site => (
          <a key={site.name} href={site.url} target="_blank" rel="noopener noreferrer"
            style={{padding:"10px 16px",background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"10px",color:TF.c.text,textDecoration:"none",fontSize:"13px",display:"flex",flexDirection:"column",gap:"4px"}}>
            <span style={{fontWeight:600}}>{site.name}</span>
            {site.badge && <span style={{color:TF.c.success,fontSize:"11px",fontWeight:500}}>{site.badge}</span>}
          </a>
        ))}
      </div>
      <div style={{background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"12px",padding:"16px",marginBottom:"24px"}}>
        <p style={{color:TF.c.textMuted,fontSize:"13px",margin:0,lineHeight:"1.6"}}>
          <strong style={{color:TF.c.text}}>Tip:</strong> Compare member programs (e.g. Costco) and card travel portals—rates vary by city and dates.
        </p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"16px"}}>
        {cars.map((c,i) => (
          <div key={i} style={{background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"16px",overflow:"hidden",textAlign:"left"}}>
            <MediaCover src={c.imageUrl} alt={`${c.type} rental`} height={140} minHeight={140} iconName="car" />
            <div style={{padding:"18px"}}>
              <div style={{color:TF.c.text,fontWeight:700,fontSize:"15px",marginBottom:"4px"}}>{c.type}</div>
              <div style={{color:TF.c.textMuted,fontSize:"13px",marginBottom:"12px"}}>{c.example}</div>
              <div style={{color:TF.c.accentHi,fontWeight:800,fontSize:"20px",marginBottom:"14px",fontVariantNumeric:"tabular-nums"}}>
                from ${c.price}<span style={{color:TF.c.textMuted,fontSize:"12px",fontWeight:500}}>/day</span>
              </div>
              <a href={c.link} target="_blank" rel="noopener noreferrer"
                style={{display:"block",textAlign:"center",padding:"10px",background:`linear-gradient(135deg, ${TF.c.accent}, ${TF.c.accentHi})`,borderRadius:"8px",color:TF.c.onAccent,textDecoration:"none",fontSize:"13px",fontWeight:700}}>
                Compare
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Weather Tab ───────────────────────────────────────────────────────────────
function WeatherTab({ form, apiKey }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiTips, setAiTips] = useState("");
  const [tipsLoading, setTipsLoading] = useState(false);

  async function fetchWeather() {
    if (!form.destination) return;
    setLoading(true);
    try {
      // Geocode destination using Open-Meteo geocoding (free)
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(form.destination)}&count=1`);
      const geoData = await geoRes.json();
      if (!geoData.results?.length) { setWeather({error:"Location not found"}); setLoading(false); return; }
      const { latitude, longitude, name, country } = geoData.results[0];

      const dateFrom = form.dateFrom || new Date().toISOString().split("T")[0];
      const dateTo = form.dateTo || new Date(Date.now()+14*864e5).toISOString().split("T")[0];

      const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&start_date=${dateFrom}&end_date=${dateTo}`);
      const wData = await wRes.json();
      setWeather({ name, country, latitude, longitude, daily: wData.daily });
    } catch(e) { setWeather({error: e.message}); }
    setLoading(false);
  }

  async function getWeatherTips() {
    if (!weather || !apiKey) return;
    setTipsLoading(true);
    const temps = weather.daily?.temperature_2m_max;
    const avgTemp = temps ? Math.round(temps.reduce((a,b)=>a+b,0)/temps.length) : "unknown";
    const raw = await askClaude(
      "You are a travel weather advisor. Give 3 practical tips in bullet points.",
      `Trip to ${weather.name} with average temp ${avgTemp}°C, style: ${form.style}. What to pack and prepare for weather?`,
      apiKey
    );
    setAiTips(raw);
    setTipsLoading(false);
  }

  const weatherIconName = (code) => {
    if (code === 0) return "sun";
    if (code <= 3) return "sun";
    if (code <= 48) return "cloud";
    if (code <= 67) return "cloud";
    if (code <= 77) return "cloud";
    if (code <= 82) return "cloud";
    return "cloud";
  };

  useEffect(() => { if (form.destination) fetchWeather(); }, [form.destination]);

  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      {[...Array(7)].map((_,i) => <Skeleton key={i} h="60px" radius="12px" />)}
    </div>
  );

  if (!weather) return (
    <div style={{textAlign:"center",padding:"80px 20px",color:TF.c.textSubtle}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:"16px"}}>
        <div style={{width:"64px",height:"64px",borderRadius:"16px",background:TF.c.surface,border:`1px solid ${TF.c.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <ImgIcon name="sun" size={28} color={TF.c.textMuted} title="Weather" />
        </div>
      </div>
      <p style={{color:TF.c.textMuted}}>Enter a destination above to see the forecast</p>
    </div>
  );

  if (weather.error) return (
    <div style={{textAlign:"center",padding:"40px",color:TF.c.danger,fontWeight:500}}>{weather.error}</div>
  );

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px",flexWrap:"wrap",gap:"12px"}}>
        <h2 style={{fontFamily:TF.fontSans,color:TF.c.text,margin:0,fontSize:"22px",fontWeight:700,letterSpacing:"-0.02em"}}>
          {weather.name}, {weather.country}
        </h2>
        <button type="button" onClick={getWeatherTips} disabled={tipsLoading}
          style={{padding:"10px 18px",background:TF.c.accentLow,border:`1px solid ${TF.c.accentBorder}`,borderRadius:"10px",color:TF.c.accentHi,cursor:"pointer",fontSize:"13px",fontWeight:600}}>
          {tipsLoading ? "Loading tips…" : "Get weather tips"}
        </button>
      </div>

      {aiTips && (
        <div style={{background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"12px",padding:"20px",marginBottom:"24px",color:TF.c.textMuted,whiteSpace:"pre-wrap",lineHeight:"1.7",fontSize:"14px"}}>
          {aiTips}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:"12px"}}>
        {weather.daily?.time?.map((date, i) => (
          <div key={date} style={{background:TF.c.surface,border:`1px solid ${TF.c.border}`,borderRadius:"12px",padding:"14px",textAlign:"center"}}>
            <div style={{color:TF.c.textMuted,fontSize:"11px",marginBottom:"6px",fontWeight:500}}>
              {new Date(date+"T12:00:00").toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})}
            </div>
            <div style={{display:"flex",justifyContent:"center",margin:"10px 0"}}>
              <ImgIcon name={weatherIconName(weather.daily.weathercode[i])} size={22} color={TF.c.accent} title="Weather" />
            </div>
            <div style={{color:TF.c.text,fontWeight:700,fontSize:"15px",fontVariantNumeric:"tabular-nums"}}>{Math.round(weather.daily.temperature_2m_max[i])}°</div>
            <div style={{color:TF.c.textMuted,fontSize:"13px",fontVariantNumeric:"tabular-nums"}}>{Math.round(weather.daily.temperature_2m_min[i])}°</div>
            {weather.daily.precipitation_sum[i] > 0 && (
              <div style={{color:TF.c.info,fontSize:"11px",marginTop:"4px",fontWeight:500}}>{weather.daily.precipitation_sum[i]} mm</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function TripForge() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("tf_api_key") || "");
  const [tab, setTab] = useState("itinerary");
  const [showSettings, setShowSettings] = useState(false);
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({});
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tf_settings") || "{}"); } catch { return {}; }
  });

  const defaultSettings = { currency:"USD", units:"Fahrenheit", distance:"Miles", refundableOnly:false, directOnly:false, showAffiliates:true, ...settings };

  function saveApiKey(key) {
    localStorage.setItem("tf_api_key", key);
    setApiKey(key);
  }

  function saveSettings(s) {
    localStorage.setItem("tf_settings", JSON.stringify(s));
    setSettings(s);
  }

  async function handleSearch(formData) {
    setForm(formData);
    setLoading(true);
    setTab("itinerary");
    setTripData(null);
    try {
      const system = `You are a world-class travel planner. Return ONLY valid JSON matching this exact structure:
{
  "destination": "string",
  "summary": "string (2 sentences about the destination)",
  "budgetBreakdown": {
    "flights": "~$XXX",
    "hotels": "~$XXX/night",
    "food": "~$XX/day",
    "activities": "~$XXX total"
  },
  "days": [
    {
      "title": "string",
      "theme": "string",
      "activities": [
        {
          "time": "string",
          "name": "string",
          "description": "string",
          "cost": "string or null"
        }
      ],
      "notes": "string or null"
    }
  ],
  "tips": ["string", "string", "string"]
}
No markdown, no commentary, only the JSON object.`;

      const nights = formData.dateFrom && formData.dateTo
        ? Math.round((new Date(formData.dateTo)-new Date(formData.dateFrom))/864e5)
        : 5;

      const dest = formData.surpriseMode
        ? `Find a great ${formData.style} destination reachable for $${formData.budget} total from ${formData.from || "the US"} for ${formData.travelers} travelers. Pick a specific city.`
        : formData.destination;

      const raw = await askClaude(system,
        `Plan a ${nights}-night ${formData.style} trip to ${dest} for ${formData.travelers} travelers with a total budget of $${formData.budget}. Dates: ${formData.dateFrom || "flexible"} to ${formData.dateTo || "flexible"}.`,
        apiKey
      );
      setTripData(parseJSON(raw));
    } catch(e) {
      setTripData({ destination: formData.destination, summary: "Error: "+e.message, days:[], tips:[] });
    }
    setLoading(false);
  }

  if (!apiKey) return <ApiKeyModal onSave={saveApiKey} />;

  const tabs = [
    { id:"itinerary", label:"Itinerary", icon:"map" },
    { id:"flights", label:"Flights", icon:"plane" },
    { id:"hotels", label:"Hotels", icon:"hotel" },
    { id:"cars", label:"Car Rental", icon:"car" },
    { id:"weather", label:"Weather", icon:"sun" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${TF.c.bg}; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${TF.c.bg2}; }
        ::-webkit-scrollbar-thumb { background: rgba(45, 212, 191, 0.25); border-radius: 3px; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.72); opacity: 0.7; }
        .tf-flight-card { display: flex; flex-direction: row; align-items: stretch; }
        .tf-flight-media {
          width: 148px;
          flex-shrink: 0;
        }
        @media (max-width: 720px) {
          .tf-flight-card { flex-direction: column; }
          .tf-flight-media {
            width: 100% !important;
            height: 168px !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.07);
          }
        }
      `}</style>

      <div style={{
        minHeight:"100vh", background:TF.c.bg,
        fontFamily:TF.fontSans, color:TF.c.text,
        backgroundImage:`radial-gradient(ellipse 80% 50% at 10% -10%, rgba(45,212,191,0.08), transparent), radial-gradient(ellipse 60% 40% at 90% 0%, rgba(56,189,248,0.06), transparent)`
      }}>
        {/* Header */}
        <header style={{
          borderBottom:`1px solid ${TF.c.border}`,
          padding:"0 40px", display:"flex", alignItems:"center",
          justifyContent:"space-between", height:"60px",
          background:"rgba(11, 12, 15, 0.82)", backdropFilter:"blur(16px)",
          position:"sticky", top:0, zIndex:100
        }}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <div style={{width:"36px",height:"36px",borderRadius:"10px",background:TF.c.accentLow,border:`1px solid ${TF.c.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <ImgIcon name="plane" size={18} color={TF.c.accent} title="TripForge" />
            </div>
            <span style={{fontFamily:TF.fontSans,color:TF.c.text,fontSize:"18px",fontWeight:700,letterSpacing:"-0.03em"}}>TripForge</span>
            <span style={{color:TF.c.textSubtle,fontSize:"13px",marginLeft:"2px",fontWeight:500}}>Travel</span>
          </div>
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            <button type="button" onClick={() => setShowSettings(!showSettings)}
              style={{background:"none",border:"none",color:TF.c.textMuted,cursor:"pointer",padding:"8px",borderRadius:"8px"}}>
              <Icon name="settings" size={20} color={TF.c.textMuted} />
            </button>
          </div>
        </header>

        {/* Main */}
        <main style={{maxWidth:"1200px",margin:"0 auto",padding:"40px 24px",animation:"fadeUp 0.5s ease"}}>
          <HeroSearch onSearch={handleSearch} loading={loading} />

          {/* Tabs */}
          <div style={{display:"flex",gap:"4px",marginBottom:"32px",borderBottom:`1px solid ${TF.c.border}`,overflowX:"auto"}}>
            {tabs.map(t => (
              <button type="button" key={t.id} onClick={() => setTab(t.id)}
                style={{
                  padding:"12px 18px",background:"none",border:"none",cursor:"pointer",
                  borderBottom: tab===t.id ? `2px solid ${TF.c.accent}` : "2px solid transparent",
                  color: tab===t.id ? TF.c.text : TF.c.textMuted,
                  fontSize:"14px",fontWeight: tab===t.id ? 600:500,
                  display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap",
                  transition:"color 0.15s, border-color 0.15s",fontFamily:TF.fontSans
                }}>
                <Icon name={t.icon} size={16} color={tab===t.id?TF.c.accent:TF.c.textMuted} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tab==="itinerary" && <ItineraryTab tripData={tripData} loading={loading} form={form} apiKey={apiKey} />}
          {tab==="flights" && <FlightsTab form={form} settings={defaultSettings} />}
          {tab==="hotels" && <HotelsTab form={form} settings={defaultSettings} />}
          {tab==="cars" && <CarsTab form={form} />}
          {tab==="weather" && <WeatherTab form={form} apiKey={apiKey} />}
        </main>

        {/* Footer */}
        <footer style={{borderTop:`1px solid ${TF.c.border}`,padding:"24px 40px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px"}}>
          <span style={{color:TF.c.textSubtle,fontSize:"12px"}}>© 2026 TripForge</span>
          <span style={{color:TF.c.textSubtle,fontSize:"11px"}}>Sample prices — confirm on provider sites.</span>
        </footer>

        {showSettings && (
          <SettingsPanel
            settings={defaultSettings}
            onChange={saveSettings}
            onClose={() => setShowSettings(false)}
            apiKey={apiKey}
            onChangeKey={saveApiKey}
          />
        )}
      </div>
    </>
  );
}
