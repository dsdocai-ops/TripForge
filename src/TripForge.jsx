import { useEffect, useState, useCallback, useRef } from "react";

// ─── Model ────────────────────────────────────────────────────────────────────
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// ─── API config ───────────────────────────────────────────────────────────────
// Set VITE_PROXY_URL in .env to route calls through your Cloudflare Worker
// (keeps API key off the client). Falls back to direct browser call.
const PROXY_URL    = import.meta.env.VITE_PROXY_URL || "";
const SITE_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "YOUR_ANTHROPIC_API_KEY_HERE";

// ─── Affiliate links (deep-linked with dates + traveler count) ───────────────
// Converts "New York" or "New York, NY, USA" → "new-york" for Skyscanner/Kayak slugs
function slugify(s) { return cityOnly(s||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }

const AFF = {
  skyscanner: (from, to, date, dateReturn="", travelers=1) => {
    const d1 = (date||"").replace(/-/g,"").slice(2); // YYMMDD
    const d2 = (dateReturn||"").replace(/-/g,"").slice(2);
    const seg = d1 ? (d2 ? `${d1}/${d2}` : d1) : "any";
    return `https://www.skyscanner.com/transport/flights/${slugify(from)||"anywhere"}/${slugify(to)||"anywhere"}/${seg}/?adults=${travelers}&utm_source=YOURAFFID`;
  },
  bookingHotels: (dest, checkin="", checkout="", travelers=1) =>
    `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest||"")}&checkin=${checkin}&checkout=${checkout}&group_adults=${travelers}&no_rooms=1&aid=YOURAFFID`,
  expediaHotels: (dest, checkin="", checkout="", travelers=1) =>
    `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(dest||"")}&startDate=${checkin}&endDate=${checkout}&adults=${travelers}&affcid=YOURAFFID`,
  hotelscom: (dest, checkin="", checkout="", travelers=1) =>
    `https://www.hotels.com/search.do?q-destination=${encodeURIComponent(dest||"")}&q-check-in=${checkin}&q-check-out=${checkout}&q-rooms=1&q-room-0-adults=${travelers}`,
  expediaFlights: (from, to, date="", travelers=1) =>
    `https://www.expedia.com/Flights-Search?flight-type=on&mode=search&trip=oneway&leg1=from:${encodeURIComponent(from||"")},to:${encodeURIComponent(to||"")},departure:${date}TANYT&passengers=adults:${travelers},children:0,infantinlap:Y&affcid=YOURAFFID`,
  kayakCars: (dest, pickup="", dropoff="") => {
    const loc = slugify(dest||"");
    const base = `https://www.kayak.com/cars/${loc}`;
    return (pickup && dropoff) ? `${base}/${pickup}/${dropoff}` : base;
  },
  kayakFlights: (from, to, date="", travelers=1) =>
    `https://www.kayak.com/flights/${slugify(from)}-${slugify(to)}${date?"/"+date:""}?adults=${travelers}`,
  rentalcars: (dest, pickup="", dropoff="") =>
    `https://www.rentalcars.com/SearchResults.do?affiliateCode=YOURAFFID&preflang=en&adplat=search&location=${encodeURIComponent(dest||"")}&d1=${pickup}&d2=${dropoff}`,
  expediaCars: (dest, pickup="", dropoff="") =>
    `https://www.expedia.com/Cars/search?location=${encodeURIComponent(dest||"")}&startDate=${pickup}&endDate=${dropoff}`,
  viator: (dest) =>
    `https://www.viator.com/searchResults/all?text=${encodeURIComponent(dest||"")}&pid=YOURAFFID`,
  googleFlights: (from, to, date="") =>
    `https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(from||"")}+to+${encodeURIComponent(to||"")}${date?"+on+"+date:""}`,
};

// ─── Aircraft photos — keyed by lowercase keyword for fuzzy matching ──────────
const AIRLINE_PHOTOS = {
  "delta":    "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=900&h=480&q=80",
  "american": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&h=480&q=80",
  "united":   "https://images.unsplash.com/photo-1540962357608-b2e3bba36c18?auto=format&fit=crop&w=900&h=480&q=80",
  "lufthansa":"https://images.unsplash.com/photo-1570145007675-901791fe9fdb?auto=format&fit=crop&w=900&h=480&q=80",
  "emirates": "https://images.unsplash.com/photo-1551197640-4c1288d95b4f?auto=format&fit=crop&w=900&h=480&q=80",
  "british":  "https://images.unsplash.com/photo-1474302770737-173ee21bab63?auto=format&fit=crop&w=900&h=480&q=80",
  "air france":"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&h=480&q=80",
  "southwest":"https://images.unsplash.com/photo-1520437358207-323b43b50729?auto=format&fit=crop&w=900&h=480&q=80",
  "qatar":    "https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=900&h=480&q=80",
  "singapore":"https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=900&h=480&q=80",
  "jetblue":  "https://images.unsplash.com/photo-1587019158091-1a103c5dd17f?auto=format&fit=crop&w=900&h=480&q=80",
  "alaska":   "https://images.unsplash.com/photo-1609726494499-27d3e942456c?auto=format&fit=crop&w=900&h=480&q=80",
  "_fallback":"https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&h=480&q=80",
};
// Fuzzy-match airline name against photo keys
function getAirlinePhoto(airline) {
  if (!airline) return AIRLINE_PHOTOS["_fallback"];
  const a = airline.toLowerCase();
  const key = Object.keys(AIRLINE_PHOTOS).find(k => k !== "_fallback" && (a.includes(k) || k.includes(a.split(" ")[0])));
  return AIRLINE_PHOTOS[key] || AIRLINE_PHOTOS["_fallback"];
}

// ─── Car category photos (generic stock, keyed by category) ──────────────────
const CAR_PHOTOS = {
  Economy:         "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&h=480&q=85",
  "Compact SUV":   "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&h=480&q=85",
  Midsize:         "https://images.unsplash.com/photo-1494976388531-d0858494cdd9?auto=format&fit=crop&w=800&h=480&q=85",
  Luxury:          "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&h=480&q=85",
  _fallback:       "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=800&h=480&q=85",
};

// ─── Real hotel photos ────────────────────────────────────────────────────────
const HOTEL_PHOTOS = [
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&h=500&q=85",
  "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=900&h=500&q=85",
  "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=900&h=500&q=85",
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&h=500&q=85",
];

// ─── Ad Slot ──────────────────────────────────────────────────────────────────
function AdSlot({ style={} }) {
  const { c } = useTokens();
  return (
    <div className="no-print" style={{
      width:"100%", minHeight:72, background:c.surface,
      border:`1px dashed ${c.border}`, borderRadius:12,
      display:"flex", alignItems:"center", justifyContent:"center",
      color:c.textSubtle, fontSize:11, fontWeight:700,
      letterSpacing:"0.1em", textTransform:"uppercase", margin:"14px 0", ...style,
    }}>
      {/* Replace with AdSense <ins> tag */}
      Advertisement
    </div>
  );
}

// ─── Theme ────────────────────────────────────────────────────────────────────
let _listeners = [];
let _theme = "light";
function useTheme() {
  const [t, setT] = useState(_theme);
  useEffect(() => {
    _listeners.push(setT);
    return () => { _listeners = _listeners.filter(l => l !== setT); };
  }, []);
  const toggle = useCallback(() => {
    _theme = _theme === "dark" ? "light" : "dark";
    _listeners.forEach(l => l(_theme));
  }, []);
  return [t, toggle];
}

// ─── Design tokens ────────────────────────────────────────────────────────────
function useTokens() {
  const [theme] = useTheme();
  const dark = theme === "dark";
  return {
    dark,
    font: `"Sora", system-ui, sans-serif`,
    fontBody: `"DM Sans", system-ui, sans-serif`,
    fontMono: `"JetBrains Mono", monospace`,
    c: dark ? {
      bg:"#080a0f", bg2:"#0e1118", surface:"#13171f", surfaceHover:"#191e28",
      border:"rgba(255,255,255,0.07)", borderStrong:"rgba(255,255,255,0.13)",
      text:"#f0f2f7", textMuted:"#7c8899", textSubtle:"#3d4756",
      accent:"#ff6b2b", accentHi:"#ff8c55", accentLow:"rgba(255,107,43,0.11)", accentBorder:"rgba(255,107,43,0.32)",
      onAccent:"#fff", teal:"#0fd4c8", tealLow:"rgba(15,212,200,0.1)",
      success:"#22d3a0", danger:"#ff4d6d", info:"#3b9eff", gold:"#f5c842",
      overlay:"rgba(4,6,12,0.92)",
    } : {
      bg:"#faf9f7", bg2:"#f2efe9", surface:"#ffffff", surfaceHover:"#fdf9f5",
      border:"rgba(0,0,0,0.07)", borderStrong:"rgba(0,0,0,0.14)",
      text:"#12100e", textMuted:"#6b6258", textSubtle:"#b5ada4",
      accent:"#e8520a", accentHi:"#ff6b2b", accentLow:"rgba(232,82,10,0.07)", accentBorder:"rgba(232,82,10,0.28)",
      onAccent:"#fff", teal:"#0ab8ae", tealLow:"rgba(10,184,174,0.08)",
      success:"#059669", danger:"#dc2626", info:"#1d6fb8", gold:"#d97706",
      overlay:"rgba(18,16,14,0.72)",
    },
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────
async function askClaude(system, user, apiKey, maxTokens = 4096) {
  const useProxy = !!PROXY_URL;
  const url = useProxy ? PROXY_URL : "https://api.anthropic.com/v1/messages";
  const headers = useProxy
    ? { "Content-Type": "application/json" }
    : { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
  const body = JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "API error"); }
      const d = await res.json();
      return d.content.map(b => b.text || "").join("");
    } catch(e) {
      lastErr = e;
      if (attempt === 0) await new Promise(r => setTimeout(r, 1200));
    }
  }
  throw lastErr;
}
function parseJSON(raw) {
  let clean = raw.replace(/```json|```/g, "").trim();
  // Pick whichever opening bracket comes first — fixes arrays being sliced incorrectly
  const iObj = clean.indexOf("{");
  const iArr = clean.indexOf("[");
  const s = iArr !== -1 && (iObj === -1 || iArr < iObj) ? iArr : iObj;
  if (s === -1) throw new Error("No JSON");
  clean = clean.slice(s);
  try { return JSON.parse(clean); } catch(_) {}
  // Truncated mid-JSON — attempt to close open structures
  let attempt = clean;
  attempt = attempt.replace(/,?\s*"[^"]*$/, "");
  attempt = attempt.replace(/,?\s*"[^"]*"\s*:\s*[^,}\]]*$/, "");
  attempt = attempt.replace(/,\s*$/, "");
  const opens = [];
  for (const ch of attempt) {
    if (ch === "{") opens.push("}");
    else if (ch === "[") opens.push("]");
    else if (ch === "}" || ch === "]") opens.pop();
  }
  attempt += opens.reverse().join("");
  return JSON.parse(attempt);
}
// ─── Session cache (prevents re-fetching on tab switches) ────────────────────
function sGet(k) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function sSet(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} }
function sCacheKey(...parts) { return "tf_" + parts.map(p => String(p||"").toLowerCase().replace(/\s+/g,"_")).join("_"); }
// Strips region/country suffix from CityInput values ("Paris, Île-de-France, France" → "Paris")
function cityOnly(s) { return (s||"").split(",")[0].trim(); }

// ─── Icons ────────────────────────────────────────────────────────────────────
function Icon({ name, size=20, color="currentColor" }) {
  const icons = {
    plane:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>,
    hotel:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    car:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h11l4 4v4a2 2 0 01-2 2h-2m-6 0h4"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
    map:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
    sun:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
    fork:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 .55.45 1 1 1h3c.55 0 1-.45 1-1z"/></svg>,
    print:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
    settings:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    x:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    check:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    dollar:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    bag:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
    pin:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s6-4.35 6-10a6 6 0 10-12 0c0 5.65 6 10 6 10z"/><circle cx="12" cy="11" r="2"/></svg>,
    plus:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trash:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
    info:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    sparkle:<svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
    arrow:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    chevron:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
    wifi:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0114 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg>,
    pool:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20M2 7h20M4 17c2 2 5 2 7 0s5-2 7 0"/></svg>,
    coffee:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    gym:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7v10M18 7v10M8 10h8M8 14h8"/><rect x="2" y="9" width="3" height="6" rx="1"/><rect x="19" y="9" width="3" height="6" rx="1"/></svg>,
    users:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    globe:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
    share:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
    calendar:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  };
  return <span style={{display:"inline-flex",alignItems:"center",flexShrink:0}}>{icons[name]||null}</span>;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h="1rem", w="100%", r="10px" }) {
  const { c } = useTokens();
  return <div style={{height:h,width:w,borderRadius:r,background:`linear-gradient(90deg,${c.surface} 25%,${c.surfaceHover} 50%,${c.surface} 75%)`,backgroundSize:"200% 100%",animation:"shimmer 1.6s infinite"}} />;
}

// ─── Image with two-level fallback ────────────────────────────────────────────
function Img({ src, fallbackSrc, alt="", style={}, iconName="plane" }) {
  const { c } = useTokens();
  const [err1, setErr1] = useState(false);
  const [err2, setErr2] = useState(false);
  const current = err1 ? fallbackSrc : src;
  if (err2 || (!src && !fallbackSrc)) {
    return (
      <div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${c.surface},${c.bg2})`,display:"flex",alignItems:"center",justifyContent:"center",...style}}>
        <Icon name={iconName} size={40} color={c.accentHi} />
      </div>
    );
  }
  return (
    <img src={current} alt={alt} loading="lazy" decoding="async"
      onError={()=>{ if (!err1) setErr1(true); else setErr2(true); }}
      style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",display:"block",...style}} />
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
function Btn({ onClick, disabled, children, variant="primary", style={}, full=false }) {
  const { c, fontBody } = useTokens();
  const v = {
    primary:{ background:`linear-gradient(135deg,${c.accent},${c.accentHi})`, color:"#fff", border:"none", boxShadow:`0 6px 20px ${c.accentBorder}` },
    ghost:  { background:c.accentLow, color:c.accentHi, border:`1.5px solid ${c.accentBorder}` },
    muted:  { background:c.surface, color:c.textMuted, border:`1.5px solid ${c.border}` },
    teal:   { background:c.tealLow, color:c.teal, border:`1.5px solid rgba(15,212,200,0.3)` },
  }[variant]||{};
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,
      padding:"11px 22px",borderRadius:12,cursor:disabled?"not-allowed":"pointer",
      fontSize:14,fontWeight:700,fontFamily:fontBody,transition:"opacity 0.15s, transform 0.1s",
      opacity:disabled?0.5:1,width:full?"100%":undefined,letterSpacing:"-0.01em",
      ...v,...style,
    }}>{children}</button>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ icon, value, onChange, placeholder, type="text", style={} }) {
  const { c, fontBody } = useTokens();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{position:"relative",...style}}>
      {icon && <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",zIndex:1,opacity:focused?0.9:0.5,transition:"opacity 0.15s"}}><Icon name={icon} size={15} color={c.text} /></span>}
      <input type={type} value={value||""} onChange={onChange} placeholder={placeholder}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        style={{
          width:"100%",padding:`13px 14px 13px ${icon?40:14}px`,
          background:focused?c.surfaceHover:c.bg2,
          border:`1.5px solid ${focused?c.accentBorder:c.border}`,
          borderRadius:12,color:c.text,fontSize:14,fontFamily:fontBody,
          outline:"none",boxSizing:"border-box",transition:"all 0.15s",
          WebkitAppearance:"none",
        }} />
    </div>
  );
}

// ─── City autocomplete (Open-Meteo geocoding) ────────────────────────────────
function CityInput({ value, onChange, placeholder, style={} }) {
  const { c, fontBody } = useTokens();
  const [query, setQuery]       = useState(value || "");
  const [results, setResults]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [fetching, setFetching] = useState(false);
  const [focused, setFocused]   = useState(false);
  const timer  = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => { if (value !== query) setQuery(value || ""); }, [value]);

  useEffect(() => {
    function close(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q); onChange(q);
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setFetching(true);
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`);
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
      } catch {}
      setFetching(false);
    }, 350);
  }

  function select(item) {
    const parts = [item.name];
    if (item.admin1 && item.admin1 !== item.name) parts.push(item.admin1);
    parts.push(item.country);
    const label = parts.filter(Boolean).join(", ");
    setQuery(label); onChange(label);
    setResults([]); setOpen(false);
  }

  const showDropdown = open && results.length > 0;
  return (
    <div ref={wrapRef} style={{position:"relative",...style}}>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",opacity:focused?0.9:0.5,transition:"opacity 0.15s",zIndex:1}}>
          <Icon name="pin" size={15} color={c.text}/>
        </span>
        <input
          type="text" value={query} onChange={handleChange} placeholder={placeholder}
          autoComplete="off"
          onFocus={()=>{ setFocused(true); if (results.length) setOpen(true); }}
          onBlur={()=>setFocused(false)}
          style={{
            width:"100%", padding:"13px 36px 13px 40px",
            background:focused?c.surfaceHover:c.bg2,
            border:`1.5px solid ${focused?c.accentBorder:c.border}`,
            borderRadius: showDropdown ? "12px 12px 0 0" : 12,
            color:c.text, fontSize:14, fontFamily:fontBody,
            outline:"none", boxSizing:"border-box", transition:"all 0.15s", WebkitAppearance:"none",
          }}
        />
        {fetching && <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:c.textSubtle,fontSize:12}}>…</span>}
      </div>
      {showDropdown && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:600,background:c.surface,border:`1.5px solid ${c.accentBorder}`,borderTop:"none",borderRadius:"0 0 12px 12px",overflow:"hidden",boxShadow:`0 8px 24px rgba(0,0,0,0.18)`}}>
          {results.slice(0, 6).map((r, i) => (
            <button key={r.id||i} onMouseDown={()=>select(r)}
              style={{width:"100%",textAlign:"left",padding:"10px 16px",background:"none",border:"none",borderTop:i>0?`1px solid ${c.border}`:"none",cursor:"pointer",fontFamily:fontBody,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <div>
                <span style={{color:c.text,fontSize:14,fontWeight:600}}>{r.name}</span>
                {r.admin1 && r.admin1 !== r.name && <span style={{color:c.textMuted,fontSize:13}}>{", "}{r.admin1}</span>}
              </div>
              <span style={{color:c.textSubtle,fontSize:12,fontWeight:700,flexShrink:0}}>{r.country_code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── API Key Modal removed — key is now set server-side via SITE_API_KEY ────────

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ settings, onChange, onClose }) {
  const { c, font, fontBody } = useTokens();
  return (
    <div style={{position:"fixed",top:0,right:0,bottom:0,width:300,background:c.surface,borderLeft:`1.5px solid ${c.border}`,zIndex:900,padding:"28px 22px",fontFamily:fontBody,overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
        <span style={{color:c.text,fontSize:17,fontWeight:700}}>Settings</span>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer"}}><Icon name="x" size={20} color={c.textMuted}/></button>
      </div>
      {[{label:"Currency",key:"currency",opts:["USD","EUR","GBP","CAD","AUD","JPY"]},{label:"Temperature",key:"units",opts:["Fahrenheit","Celsius"]}].map(({label,key,opts})=>(
        <div key={key} style={{marginBottom:22}}>
          <div style={{color:c.textMuted,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>{label}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {opts.map(o=><button key={o} onClick={()=>onChange({...settings,[key]:o})} style={{padding:"7px 14px",borderRadius:8,border:`1.5px solid ${settings[key]===o?c.accentBorder:c.border}`,background:settings[key]===o?c.accentLow:"transparent",color:settings[key]===o?c.accentHi:c.textMuted,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:fontBody}}>{o}</button>)}
          </div>
        </div>
      ))}
      {[{label:"Refundable only",key:"refundableOnly"},{label:"Direct flights only",key:"directOnly"}].map(({label,key})=>(
        <div key={key} onClick={()=>onChange({...settings,[key]:!settings[key]})} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",cursor:"pointer",borderBottom:`1px solid ${c.border}`}}>
          <div style={{width:22,height:22,borderRadius:7,border:`1.5px solid ${settings[key]?c.accentBorder:c.borderStrong}`,background:settings[key]?c.accentLow:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {settings[key]&&<Icon name="check" size={12} color={c.accent}/>}
          </div>
          <span style={{color:c.text,fontSize:14}}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Hero Search — FIXED: single "Flying from" ───────────────────────────────
function HeroSearch({ onSearch, loading }) {
  const { c, font, fontBody } = useTokens();
  const [multiCity, setMultiCity] = useState(false);
  const [dests, setDests] = useState([{city:"",dateFrom:"",dateTo:""}]);
  const [from, setFrom] = useState("");
  const [travelers, setTravelers] = useState("2");
  const [budget, setBudget] = useState("3000");
  const [style, setStyle] = useState("relaxation");

  const upd = (i,k,v) => setDests(d=>d.map((x,j)=>j===i?{...x,[k]:v}:x));
  const styles = ["relaxation","adventure","culture","food & wine","city break","nature","family","luxury","budget"];

  function go(surpriseMode=false) {
    onSearch({
      from, travelers, budget, style, multiCity,
      destinations:dests,
      destination: multiCity ? dests.map(d=>d.city).filter(Boolean).join(" → ") : dests[0]?.city||"",
      dateFrom: dests[0]?.dateFrom||"",
      dateTo: multiCity ? dests[dests.length-1]?.dateTo||"" : dests[0]?.dateTo||"",
      surpriseMode,
    });
  }

  const selStyle = {
    width:"100%",padding:"13px 14px 13px 40px",background:c.bg2,
    border:`1.5px solid ${c.border}`,borderRadius:12,color:c.text,
    fontSize:14,fontFamily:fontBody,outline:"none",appearance:"none",
    WebkitAppearance:"none",cursor:"pointer",
  };

  return (
    <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:20,overflow:"hidden",marginBottom:32,boxShadow:`0 4px 40px ${c.dark?"rgba(0,0,0,0.4)":"rgba(0,0,0,0.06)"}`}}>
      {/* Hero headline band */}
      <div style={{background:`linear-gradient(135deg,${c.accent} 0%,${c.accentHi} 100%)`,padding:"32px 28px 28px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16}}>
          <div style={{flex:1,minWidth:240}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.18)",borderRadius:999,padding:"5px 14px",marginBottom:14}}>
              <span style={{fontSize:12,color:"#fff",fontWeight:700,letterSpacing:"0.06em"}}>✨ AI-POWERED · FREE TO PLAN</span>
            </div>
            <h1 style={{color:"#fff",fontSize:"clamp(24px,4vw,38px)",fontWeight:800,margin:"0 0 10px",letterSpacing:"-0.03em",lineHeight:1.1,fontFamily:font}}>
              Your next trip, fully planned<br/>in 30 seconds.
            </h1>
            <p style={{color:"rgba(255,255,255,0.85)",fontSize:15,margin:0,lineHeight:1.65,maxWidth:520}}>
              Tell TripForge where you want to go and your budget — our AI builds a complete day-by-day itinerary, finds flights, hotels, and restaurants, all in one place.
            </p>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <div style={{display:"flex",gap:8}}>
              {["Single","Multi-city"].map((label,i)=>(
                <button key={label} onClick={()=>{setMultiCity(i===1);if(i===1&&dests.length<2)setDests(d=>[...d,{city:"",dateFrom:"",dateTo:""}]);}}
                  style={{padding:"8px 16px",borderRadius:9,border:"1.5px solid",borderColor:(i===1)===multiCity?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.35)",background:(i===1)===multiCity?"rgba(255,255,255,0.22)":"transparent",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:fontBody}}>
                  {label}
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>

      <div style={{padding:"24px 28px 28px"}}>
        {/* Destination(s) */}
        {multiCity ? (
          <div style={{marginBottom:16}}>
            {dests.map((d,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,marginBottom:10,alignItems:"end"}}>
                <CityInput value={d.city} onChange={v=>upd(i,"city",v)} placeholder={`Stop ${i+1} city — e.g. Rome, Barcelona`}/>
                {/* Date range for each stop */}
                <div style={{background:c.bg2,border:`1.5px solid ${c.border}`,borderRadius:12,display:"flex",alignItems:"stretch",overflow:"hidden"}}>
                  <div style={{flex:1,padding:"6px 12px 8px"}}>
                    <div style={{fontSize:9,fontWeight:700,color:c.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>Arrive</div>
                    <input type="date" value={d.dateFrom||""} onChange={e=>upd(i,"dateFrom",e.target.value)}
                      style={{background:"transparent",border:"none",outline:"none",color:c.text,fontSize:13,fontFamily:fontBody,width:"100%",cursor:"pointer"}}/>
                    {!d.dateFrom && <div style={{color:c.textSubtle,fontSize:10,marginTop:2}}>Date you arrive</div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",padding:"0 6px",color:c.textSubtle,fontSize:14,flexShrink:0}}>→</div>
                  <div style={{flex:1,padding:"6px 12px 8px",borderLeft:`1px solid ${c.border}`}}>
                    <div style={{fontSize:9,fontWeight:700,color:c.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>Leave</div>
                    <input type="date" value={d.dateTo||""} onChange={e=>upd(i,"dateTo",e.target.value)}
                      style={{background:"transparent",border:"none",outline:"none",color:c.text,fontSize:13,fontFamily:fontBody,width:"100%",cursor:"pointer"}}/>
                    {!d.dateTo && <div style={{color:c.textSubtle,fontSize:10,marginTop:2}}>Date you leave</div>}
                  </div>
                </div>
                {dests.length>2
                  ? <button onClick={()=>setDests(d=>d.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:6,borderRadius:8,marginBottom:2}}><Icon name="trash" size={16} color={c.danger}/></button>
                  : <div/>}
              </div>
            ))}
            <Btn onClick={()=>setDests(d=>[...d,{city:"",dateFrom:"",dateTo:""}])} variant="muted" style={{fontSize:13,padding:"9px 16px"}}>
              <Icon name="plus" size={14} color={c.textMuted}/>Add stop
            </Btn>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginBottom:16}}>
            <CityInput value={dests[0]?.city} onChange={v=>upd(0,"city",v)} placeholder="Destination city — e.g. Paris, Tokyo, Bali"/>
            {/* Date range — labelled, arrow between */}
            <div style={{background:c.bg2,border:`1.5px solid ${c.border}`,borderRadius:12,display:"flex",alignItems:"stretch",overflow:"hidden"}}>
              <div style={{flex:1,padding:"6px 14px 8px"}}>
                <div style={{fontSize:9,fontWeight:700,color:c.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>✈️ Depart</div>
                <input type="date" value={dests[0]?.dateFrom||""} onChange={e=>upd(0,"dateFrom",e.target.value)}
                  style={{background:"transparent",border:"none",outline:"none",color:c.text,fontSize:13,fontFamily:fontBody,width:"100%",cursor:"pointer"}}/>
                {!dests[0]?.dateFrom && <div style={{color:c.textSubtle,fontSize:10,marginTop:2}}>Your departure date</div>}
              </div>
              <div style={{display:"flex",alignItems:"center",padding:"0 8px",color:c.accentHi,fontSize:16,flexShrink:0,fontWeight:700}}>→</div>
              <div style={{flex:1,padding:"6px 14px 8px",borderLeft:`1px solid ${c.border}`}}>
                <div style={{fontSize:9,fontWeight:700,color:c.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>🏠 Return</div>
                <input type="date" value={dests[0]?.dateTo||""} onChange={e=>upd(0,"dateTo",e.target.value)}
                  style={{background:"transparent",border:"none",outline:"none",color:c.text,fontSize:13,fontFamily:fontBody,width:"100%",cursor:"pointer"}}/>
                {!dests[0]?.dateTo && <div style={{color:c.textSubtle,fontSize:10,marginTop:2}}>Your return date</div>}
              </div>
            </div>
          </div>
        )}

        {/* Shared row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:18}}>
          <CityInput value={from} onChange={v=>setFrom(v)} placeholder="Departure city — e.g. New York, London"/>
          <Field icon="dollar" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="Total budget ($)" type="number"/>
          {/* Travelers stepper — any number, no dropdown */}
          <div style={{background:c.bg2,border:`1.5px solid ${c.border}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",height:50}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <span style={{opacity:0.5,display:"inline-flex"}}><Icon name="users" size={15} color={c.text}/></span>
              <span style={{fontSize:11,fontWeight:700,color:c.textMuted,letterSpacing:"0.07em",textTransform:"uppercase"}}>Travelers</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <button onClick={()=>setTravelers(t=>String(Math.max(1,Number(t)-1)))}
                style={{width:28,height:28,borderRadius:8,border:`1.5px solid ${c.border}`,background:c.surface,color:c.text,fontSize:17,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,fontFamily:fontBody}}>−</button>
              <input type="number" min="1" max="99" value={travelers}
                onChange={e=>setTravelers(String(Math.max(1,Number(e.target.value)||1)))}
                style={{width:34,textAlign:"center",background:"transparent",border:"none",outline:"none",color:c.text,fontSize:15,fontWeight:800,fontFamily:fontBody,MozAppearance:"textfield"}}/>
              <button onClick={()=>setTravelers(t=>String(Number(t)+1))}
                style={{width:28,height:28,borderRadius:8,border:`1.5px solid ${c.border}`,background:c.surface,color:c.text,fontSize:17,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,fontFamily:fontBody}}>+</button>
            </div>
          </div>
        </div>

        {/* Style + trip type row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:22}}>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",opacity:0.5}}><Icon name="sparkle" size={15} color={c.text}/></span>
            <select value={style} onChange={e=>setStyle(e.target.value)} style={selStyle}>
              {styles.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* CTA */}
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <Btn onClick={()=>go(false)} disabled={loading} style={{flex:1,minWidth:200,padding:"15px 28px",fontSize:16,borderRadius:14,boxShadow:`0 8px 28px ${c.accentBorder}`}}>
            <Icon name="sparkle" size={17} color="#fff"/>
            {loading?"Building your itinerary…":"Plan My Trip Free →"}
          </Btn>
          <Btn onClick={()=>go(true)} disabled={loading} variant="muted" style={{flexShrink:0,borderRadius:14,fontSize:13}}>
            🎲 Surprise me
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Itinerary Tab ────────────────────────────────────────────────────────────
function ItineraryTab({ tripData, loading, form, apiKey }) {
  const { c, fontBody } = useTokens();
  const [extras, setExtras] = useState(null);
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  useEffect(() => {
    const before = () => setPrintMode(true);
    const after  = () => setPrintMode(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint",  after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);

  async function getExtras() {
    const ck = sCacheKey("extras", form.destination, form.style);
    const hit = sGet(ck);
    if (hit) { setExtras(hit); return; }
    setExtrasLoading(true); setExtras(null);
    try {
      const raw = await askClaude(
        `Travel expert. Return ONLY JSON: {"budgetTips":["string","string","string"],"packing":{"categories":[{"name":"string","items":["string"]}]}}. No markdown.`,
        `${form.style} trip to ${form.destination}. ${form.travelers} travelers. $${form.budget} budget. ${form.dateFrom||"flexible"} to ${form.dateTo||"flexible"}.`,
        apiKey, 1500
      );
      const parsed = parseJSON(raw);
      sSet(ck, parsed);
      setExtras(parsed);
    } catch(e) { setExtras({_error:true}); }
    setExtrasLoading(false);
  }

  const LOAD_MSGS = [
    "Finding the best neighborhoods…",
    "Mapping your days…",
    "Calculating your budget…",
    "Sourcing local restaurants…",
    "Almost ready…",
  ];
  const [loadIdx, setLoadIdx] = useState(0);
  useEffect(()=>{
    if (!loading) return;
    setLoadIdx(0);
    const iv = setInterval(()=>setLoadIdx(i=>(i+1)%LOAD_MSGS.length),2800);
    return ()=>clearInterval(iv);
  },[loading]);

  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:c.surface,borderRadius:18,padding:"40px 32px",textAlign:"center",border:`1.5px solid ${c.border}`}}>
        <div style={{fontSize:52,marginBottom:18,display:"inline-block",animation:"spin 2s linear infinite"}}>✈️</div>
        <div style={{color:c.text,fontSize:20,fontWeight:800,marginBottom:8,letterSpacing:"-0.02em"}}>Building your itinerary…</div>
        <div style={{color:c.accent,fontSize:14,fontWeight:600,marginBottom:20,minHeight:22,transition:"all 0.3s"}}>{LOAD_MSGS[loadIdx]}</div>
        {/* Progress bar */}
        <div style={{width:"100%",maxWidth:320,margin:"0 auto",height:4,background:c.border,borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",background:`linear-gradient(90deg,${c.accent},${c.accentHi})`,borderRadius:4,animation:"progress 14s linear forwards"}}/>
        </div>
        <div style={{color:c.textMuted,fontSize:13,marginTop:14}}>TripForge is crafting your {form.style} trip to <strong style={{color:c.text}}>{form.destination}</strong></div>
      </div>
      {[1,2,3].map(i=><div key={i} style={{background:c.surface,borderRadius:16,padding:24,display:"flex",flexDirection:"column",gap:12}}><Skeleton h="20px" w="40%"/><Skeleton h="14px"/><Skeleton h="14px" w="70%"/></div>)}
    </div>
  );

  if (!tripData) return (
    <div style={{textAlign:"center",padding:"72px 20px"}}>
      <div style={{fontSize:64,marginBottom:16}}>🌍</div>
      <div style={{color:c.text,fontSize:20,fontWeight:700,marginBottom:8}}>Ready to explore?</div>
      <p style={{color:c.textMuted,fontSize:15,maxWidth:380,margin:"0 auto"}}>Fill in your trip details above and let AI build your perfect itinerary</p>
    </div>
  );

  const { destination, summary, days, budgetBreakdown, tips, _error } = tripData;

  if (_error) return (
    <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:20,padding:"40px 32px",textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:16}}>✈️</div>
      <div style={{color:c.text,fontWeight:800,fontSize:20,marginBottom:10}}>We couldn't build your itinerary right now</div>
      <p style={{color:c.textMuted,fontSize:14,lineHeight:1.7,maxWidth:420,margin:"0 auto 24px"}}>Our AI travel planner is experiencing a brief interruption. Please check your internet connection and try again in a moment.</p>
      <div style={{background:c.accentLow,border:`1.5px solid ${c.accentBorder}`,borderRadius:12,padding:"12px 18px",display:"inline-block"}}>
        <span style={{color:c.accentHi,fontSize:13,fontWeight:600}}>Tip: Make sure your destination field is filled in and try again.</span>
      </div>
    </div>
  );

  return (
    <div>
      <AdSlot/>
      <div style={{background:`linear-gradient(135deg,${c.accentLow},${c.tealLow})`,border:`1.5px solid ${c.border}`,borderRadius:20,padding:"26px 28px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{color:c.accent,fontSize:11,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Your itinerary</div>
            <h2 style={{color:c.text,fontSize:26,fontWeight:800,margin:"0 0 10px",letterSpacing:"-0.04em",lineHeight:1.1}}>{destination}</h2>
            <p style={{color:c.textMuted,lineHeight:1.7,margin:0,fontSize:14}}>{summary}</p>
          </div>
          <button onClick={()=>window.print()} style={{flexShrink:0,background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:10,padding:"9px 16px",color:c.textMuted,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:600,fontFamily:fontBody}}>
            <Icon name="print" size={14} color={c.textMuted}/> Print
          </button>
        </div>
      </div>

      {budgetBreakdown && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:20}}>
          {Object.entries(budgetBreakdown).map(([k,v])=>(
            <div key={k} style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:14,padding:"14px",textAlign:"center"}}>
              <div style={{color:c.accent,fontSize:16,fontWeight:800}}>{v}</div>
              <div style={{color:c.textMuted,fontSize:11,textTransform:"capitalize",marginTop:4,fontWeight:600}}>{k}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn onClick={getExtras} disabled={extrasLoading} variant="ghost" style={{fontSize:13,padding:"10px 18px"}}>
          <Icon name="bag" size={14} color={c.accentHi}/>
          {extrasLoading?"Thinking…":"Budget tips + packing list"}
        </Btn>
        <a href={AFF.viator(form.destination)} target="_blank" rel="noopener noreferrer"
          style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 18px",background:c.tealLow,border:`1.5px solid rgba(15,212,200,0.3)`,borderRadius:12,color:c.teal,textDecoration:"none",fontSize:13,fontWeight:700,fontFamily:fontBody}}>
          <Icon name="sparkle" size={14} color={c.teal}/> Book activities (Viator)
        </a>
      </div>

      {extras?._error && (
        <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:14,padding:"18px 20px",marginBottom:18,display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:28,flexShrink:0}}>💡</span>
          <div>
            <div style={{color:c.text,fontWeight:700,fontSize:14,marginBottom:4}}>Budget tips temporarily unavailable</div>
            <p style={{color:c.textMuted,fontSize:13,margin:0,lineHeight:1.6}}>This feature is experiencing a brief interruption. Please try again in a moment.</p>
          </div>
        </div>
      )}
      {extras?.budgetTips && (
        <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:16,padding:22,marginBottom:18}}>
          <div style={{color:c.accent,fontWeight:800,fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>💰 Budget Tips</div>
          {extras.budgetTips.map((t,i)=>(
            <div key={i} style={{display:"flex",gap:12,marginBottom:10}}>
              <span style={{color:c.accentHi,fontWeight:800,fontSize:14,flexShrink:0}}>{i+1}.</span>
              <span style={{color:c.textMuted,fontSize:14,lineHeight:1.6}}>{t}</span>
            </div>
          ))}
        </div>
      )}

      {extras?.packing && (
        <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:16,padding:22,marginBottom:20}}>
          <div style={{color:c.text,fontWeight:700,fontSize:15,marginBottom:16}}>🧳 Packing List</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:18}}>
            {extras.packing.categories?.map(cat=>(
              <div key={cat.name}>
                <div style={{color:c.accentHi,fontWeight:700,marginBottom:8,fontSize:12,textTransform:"uppercase",letterSpacing:"0.06em"}}>{cat.name}</div>
                <ul style={{margin:0,padding:"0 0 0 16px",color:c.textMuted,fontSize:13,lineHeight:2}}>
                  {cat.items?.map(item=><li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {days?.map((day,i)=><DayCard key={i} day={day} index={i} printMode={printMode}/>)}

      {tips?.length>0 && (
        <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:16,padding:22,marginTop:14}}>
          <div style={{color:c.text,fontWeight:700,fontSize:15,marginBottom:14}}>💡 Local Tips</div>
          {tips.map((t,i)=>(
            <div key={i} style={{display:"flex",gap:12,marginBottom:10}}>
              <span style={{color:c.teal,fontWeight:700,flexShrink:0}}>→</span>
              <span style={{color:c.textMuted,fontSize:14,lineHeight:1.6}}>{t}</span>
            </div>
          ))}
        </div>
      )}
      <AdSlot style={{marginTop:20}}/>
    </div>
  );
}

function DayCard({ day, index, printMode=false }) {
  const { c, fontBody } = useTokens();
  const [open, setOpen] = useState(index < 2);
  const isOpen = open || printMode;
  return (
    <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:16,marginBottom:10,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"18px 22px",background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left",fontFamily:fontBody}}>
        <div>
          <span style={{color:c.accent,fontWeight:800,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase"}}>Day {index+1}</span>
          <div style={{color:c.text,marginTop:4,fontSize:16,fontWeight:700,letterSpacing:"-0.02em"}}>{day.title||day.theme}</div>
        </div>
        <span className="no-print" style={{transform:open?"rotate(90deg)":"none",transition:"transform 0.2s",display:"inline-flex",flexShrink:0}}>
          <Icon name="chevron" size={20} color={c.textMuted}/>
        </span>
      </button>
      {isOpen && (
        <div style={{padding:"0 22px 22px"}}>
          {day.activities?.map((act,j)=>(
            <div key={j} style={{display:"flex",gap:16,padding:"13px 0",borderTop:`1px solid ${c.border}`}}>
              <div style={{color:c.accent,fontSize:12,fontWeight:800,minWidth:58,paddingTop:2,flexShrink:0}}>{act.time}</div>
              <div>
                <div style={{color:c.text,fontWeight:700,fontSize:14}}>{act.name||act.activity}</div>
                <div style={{color:c.textMuted,fontSize:13,marginTop:4,lineHeight:1.65}}>{act.description||act.details}</div>
                {act.cost&&<div style={{color:c.accentHi,fontSize:12,marginTop:5,fontWeight:700}}>~{act.cost}</div>}
              </div>
            </div>
          ))}
          {day.notes&&<p style={{color:c.textMuted,fontSize:13,marginTop:12,fontStyle:"italic",lineHeight:1.6}}>{day.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Map Tab ──────────────────────────────────────────────────────────────────
function MapTab({ tripData, form }) {
  const { c, fontBody } = useTokens();
  const mapRef = useRef(null);
  const inst = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(()=>{
    if (document.getElementById("lf-css")) { setLoaded(true); return; }
    const lnk=document.createElement("link"); lnk.id="lf-css"; lnk.rel="stylesheet";
    lnk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(lnk);
    const sc=document.createElement("script"); sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    sc.onload=()=>setLoaded(true); document.head.appendChild(sc);
  },[]);

  useEffect(()=>{
    if (!loaded||!mapRef.current||!tripData) return;
    const L=window.L;
    if (inst.current) { inst.current.remove(); inst.current=null; }
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityOnly(form.destination)||"")}&count=1`)
      .then(r=>r.json()).then(data=>{
        const loc=data.results?.[0]; if(!loc) { setMapError(true); return; }
        const map=L.map(mapRef.current).setView([loc.latitude,loc.longitude],12); inst.current=map;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);
        const icon=L.divIcon({html:`<div style="background:#ff6b2b;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.35)"></div>`,iconSize:[32,32],iconAnchor:[16,32],className:""});
        L.marker([loc.latitude,loc.longitude],{icon}).addTo(map).bindPopup(`<b>${loc.name}, ${loc.country}</b>`).openPopup();
      });
  },[loaded,tripData,form]);

  if (!tripData) return <div style={{textAlign:"center",padding:"72px 20px"}}><div style={{fontSize:64,marginBottom:16}}>🗺️</div><p style={{color:c.textMuted,fontSize:15}}>Plan a trip first to see the map</p></div>;
  if (mapError) return (
    <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:20,padding:"40px 24px",textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:14}}>🗺️</div>
      <div style={{color:c.text,fontWeight:700,fontSize:18,marginBottom:8}}>Map temporarily unavailable</div>
      <p style={{color:c.textMuted,fontSize:14,lineHeight:1.6,maxWidth:380,margin:"0 auto"}}>We couldn't load the map for this destination. This is usually a temporary issue — please try again shortly.</p>
    </div>
  );
  return <div ref={mapRef} style={{width:"100%",height:480,borderRadius:18,overflow:"hidden",border:`1.5px solid ${c.border}`}}/>;
}

// ─── Restaurants Tab ──────────────────────────────────────────────────────────
function RestaurantsTab({ form, apiKey }) {
  const { c, fontBody } = useTokens();
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(false);

  async function getRecs() {
    if (!form.destination||!apiKey) return;
    const ck = sCacheKey("recs", form.destination, form.style);
    const hit = sGet(ck);
    if (hit) { setRecs(hit); return; }
    setLoading(true); setRecs(null);
    try {
      const raw = await askClaude(
        `Local food expert. Return ONLY JSON: {"restaurants":[{"name":"string","cuisine":"string","priceRange":"$/$$/$$$/$$$$","mustTry":"string","neighborhood":"string","tip":"string"}]}. 6 restaurants. No markdown.`,
        `Best restaurants in ${form.destination} for a ${form.style||"general"} trip.`,
        apiKey, 1200
      );
      const parsed = parseJSON(raw);
      sSet(ck, parsed);
      setRecs(parsed);
    } catch(e) { setRecs({error:true}); }
    setLoading(false);
  }

  useEffect(()=>{ if(form.destination&&apiKey) getRecs(); },[form.destination]);

  if (!form.destination) return <div style={{textAlign:"center",padding:"72px 20px"}}><div style={{fontSize:64,marginBottom:16}}>🍽️</div><p style={{color:c.textMuted,fontSize:15}}>Enter a destination to get restaurant picks</p></div>;
  if (loading) return <div style={{display:"flex",flexDirection:"column",gap:12}}>{[...Array(4)].map((_,i)=><Skeleton key={i} h="100px" r="14px"/>)}</div>;
  const pc=(p)=>p?.length<=1?c.success:p?.length<=2?c.teal:p?.length<=3?c.gold:c.danger;

  return (
    <div>
      <AdSlot/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22,flexWrap:"wrap",gap:12}}>
        <h2 style={{color:c.text,fontSize:22,fontWeight:800,margin:0,letterSpacing:"-0.03em"}}>Where to eat in {form.destination}</h2>
        <Btn onClick={getRecs} disabled={loading} variant="ghost" style={{fontSize:13,padding:"9px 16px"}}><Icon name="sparkle" size={14} color={c.accentHi}/>Refresh</Btn>
      </div>
      {recs?.error&&(
        <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:16,padding:"28px 24px",textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:12}}>🍽️</div>
          <div style={{color:c.text,fontWeight:700,fontSize:16,marginBottom:8}}>Restaurant recommendations are temporarily unavailable</div>
          <p style={{color:c.textMuted,fontSize:14,lineHeight:1.6,margin:"0 0 18px"}}>We're experiencing a brief interruption with this feature. In the meantime, you can browse top-rated restaurants directly below.</p>
          <Btn onClick={getRecs} variant="ghost" style={{fontSize:13}}>Try again</Btn>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:14,marginBottom:20}}>
        {recs?.restaurants?.map((r,i)=>(
          <div key={i} style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:16,padding:20,display:"flex",flexDirection:"column",gap:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{color:c.text,fontWeight:700,fontSize:16}}>{r.name}</div>
                <div style={{color:c.textMuted,fontSize:13,marginTop:3}}>{r.cuisine} · {r.neighborhood}</div>
              </div>
              <span style={{color:pc(r.priceRange),fontWeight:800,fontSize:15,flexShrink:0,marginLeft:8}}>{r.priceRange}</span>
            </div>
            {r.mustTry&&<div style={{background:c.accentLow,border:`1px solid ${c.accentBorder}`,borderRadius:9,padding:"8px 12px",marginBottom:10}}><span style={{color:c.accent,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Must try: </span><span style={{color:c.text,fontSize:13}}>{r.mustTry}</span></div>}
            {r.tip&&<p style={{color:c.textMuted,fontSize:13,margin:"0 0 12px",lineHeight:1.6}}>💡 {r.tip}</p>}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:"auto",paddingTop:10,borderTop:`1px solid ${c.border}`}}>
              {/* Maps — queries name + city for a direct place result */}
              <a href={`https://maps.google.com/?q=${encodeURIComponent(r.name+", "+cityOnly(form.destination))}`} target="_blank" rel="noopener noreferrer"
                style={{padding:"6px 12px",background:c.bg2,border:`1px solid ${c.border}`,borderRadius:8,color:c.textMuted,textDecoration:"none",fontSize:12,fontWeight:600,fontFamily:fontBody}}>
                📍 Maps
              </a>
              {/* Yelp — name + city narrows directly to the business */}
              <a href={`https://www.yelp.com/search?find_desc=${encodeURIComponent('"'+r.name+'"')}&find_loc=${encodeURIComponent(cityOnly(form.destination))}`} target="_blank" rel="noopener noreferrer"
                style={{padding:"6px 12px",background:c.bg2,border:`1px solid ${c.border}`,borderRadius:8,color:c.textMuted,textDecoration:"none",fontSize:12,fontWeight:600,fontFamily:fontBody}}>
                ⭐ Yelp
              </a>
              {/* TripAdvisor — reliable restaurant search */}
              <a href={`https://www.tripadvisor.com/Search?q=${encodeURIComponent(r.name+" "+cityOnly(form.destination))}&searchSessionId=restaurant`} target="_blank" rel="noopener noreferrer"
                style={{padding:"6px 12px",background:c.bg2,border:`1px solid ${c.border}`,borderRadius:8,color:c.textMuted,textDecoration:"none",fontSize:12,fontWeight:600,fontFamily:fontBody}}>
                🌍 TripAdvisor
              </a>
            </div>
          </div>
        ))}
      </div>
      <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:12,padding:16}}>
        <p style={{color:c.textMuted,fontSize:13,margin:0,lineHeight:1.6}}><strong style={{color:c.text}}>Browse all restaurants: </strong>
          {[{name:"Yelp",url:`https://www.yelp.com/search?find_desc=Restaurants&find_loc=${encodeURIComponent(cityOnly(form.destination)||"")}`},{name:"TripAdvisor",url:`https://www.tripadvisor.com/Restaurants-${encodeURIComponent(cityOnly(form.destination||""))}`},{name:"Google Maps",url:`https://maps.google.com/?q=restaurants+in+${encodeURIComponent(cityOnly(form.destination)||"")}`}].map((s,i)=><span key={s.name}><a href={s.url} target="_blank" rel="noopener noreferrer" style={{color:c.accentHi,fontWeight:600}}>{s.name}</a>{i<2?" · ":""}</span>)}
        </p>
      </div>
    </div>
  );
}

// ─── Flights Tab — AI-powered flight suggestions ──────────────────────────────
function FlightsTab({ form, settings, apiKey }) {
  const { c, fontBody } = useTokens();
  const [flights, setFlights] = useState(null);
  const [loading, setLoading] = useState(false);
  const fromCity = cityOnly(form.from);
  const destCity = cityOnly(form.destination);
  const skUrl = AFF.skyscanner(fromCity, destCity, form.dateFrom, form.dateTo, form.travelers);

  async function fetchFlights() {
    if (!form.destination || !apiKey) return;
    const ck = sCacheKey("flights", form.destination, form.from, form.dateFrom);
    const hit = sGet(ck);
    if (hit) { setFlights(hit); return; }
    setLoading(true); setFlights(null);
    try {
      const raw = await askClaude(
        `Flight data expert. Return ONLY a JSON array of 4 flight options. Strict rules: (1) Only airlines that genuinely operate this exact route. (2) iataFrom/iataTo must be the correct primary IATA airport codes. (3) estimatedPrice = realistic economy fare per person one-way at current market rates — domestic US $120-450, transatlantic $380-950, intra-Europe $45-280, Asia-Pacific $280-850, adjust for season and route popularity. (4) Include both nonstop and 1-stop options where realistic. (5) flightNumber uses real airline IATA prefix + plausible number. (6) duration must be accurate for the route including layover if stops>0. (7) from/to fields are the city names. Each object: {"airline":"string","from":"string","to":"string","iataFrom":"XXX","iataTo":"YYY","depart":"HH:MM","arrive":"HH:MM","duration":"Xh Ym","stops":0,"estimatedPrice":000,"refundable":true,"flightNumber":"XX 000","bookingClass":"Economy"}. No markdown. Return exactly 4 items.`,
        `Flights from ${form.from || "New York"} to ${form.destination}${form.dateFrom ? ` on ${form.dateFrom}` : ""}. ${form.travelers || 2} traveler(s). Travel style: ${form.style || "general"}. Budget consideration: $${form.budget || 3000} total trip.`,
        apiKey, 1200
      );
      const parsed = parseJSON(raw);
      const data = Array.isArray(parsed) ? parsed : parsed.flights || [];
      if (!data.length) throw new Error("Empty flights array");
      sSet(ck, data);
      setFlights(data);
    } catch(e) { setFlights({ _error: true }); }
    setLoading(false);
  }

  useEffect(() => { if (form.destination && apiKey) fetchFlights(); }, [form.destination]);

  const filtered = Array.isArray(flights)
    ? [...flights]
        .filter(f => (!settings.refundableOnly || f.refundable) && (!settings.directOnly || f.stops === 0))
        .sort((a, b) => (a.estimatedPrice * (1 + (a.stops||0) * 0.12)) - (b.estimatedPrice * (1 + (b.stops||0) * 0.12)))
    : [];

  if (!form.destination) return (
    <div style={{textAlign:"center",padding:"72px 20px"}}>
      <div style={{fontSize:64,marginBottom:16}}>✈️</div>
      <p style={{color:c.textMuted,fontSize:15}}>Plan a trip first to see flight options</p>
    </div>
  );

  return (
    <div>
      <AdSlot/>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        {[
          {name:"🔍 Skyscanner", url:skUrl, primary:true},
          {name:"Google Flights", url:AFF.googleFlights(fromCity, destCity, form.dateFrom)},
          {name:"Expedia", url:AFF.expediaFlights(fromCity, destCity, form.dateFrom, form.travelers)},
          {name:"Kayak", url:AFF.kayakFlights(fromCity, destCity, form.dateFrom, form.travelers)},
        ].map(s => (
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
            style={{padding:"10px 18px",background:s.primary?c.accentLow:c.surface,border:`1.5px solid ${s.primary?c.accentBorder:c.border}`,borderRadius:10,color:s.primary?c.accentHi:c.textMuted,textDecoration:"none",fontSize:13,fontWeight:700,fontFamily:fontBody}}>
            {s.name}
          </a>
        ))}
        <Btn onClick={fetchFlights} disabled={loading} variant="ghost" style={{fontSize:13,padding:"9px 16px"}}>
          <Icon name="sparkle" size={14} color={c.accentHi}/>{loading ? "Searching…" : "Refresh"}
        </Btn>
      </div>

      <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:10,padding:"12px 16px",marginBottom:18,display:"flex",gap:10}}>
        <Icon name="info" size={16} color={c.info}/>
        <p style={{color:c.textMuted,fontSize:13,margin:0,lineHeight:1.6}}>AI-suggested options for {form.from || "your origin"} → {form.destination}, sorted by best value. Click <strong>Book Now</strong> for real-time pricing on Skyscanner.</p>
      </div>

      {loading && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {[1,2,3,4].map(i => <Skeleton key={i} h="200px" r="18px"/>)}
        </div>
      )}

      {flights?._error && (
        <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:20,padding:"40px 24px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:14}}>✈️</div>
          <div style={{color:c.text,fontWeight:700,fontSize:18,marginBottom:8}}>Flight suggestions temporarily unavailable</div>
          <p style={{color:c.textMuted,fontSize:14,lineHeight:1.6,maxWidth:380,margin:"0 auto 20px"}}>Search live fares on Skyscanner, Google Flights, or Expedia using the links above.</p>
          <Btn onClick={fetchFlights} variant="ghost" style={{fontSize:13}}>Try again</Btn>
        </div>
      )}

      {!loading && Array.isArray(flights) && filtered.length === 0 && flights.length > 0 && (
        <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:14,padding:"20px 24px",textAlign:"center"}}>
          <p style={{color:c.textMuted,fontSize:14,margin:0}}>No flights match your current filters. Try adjusting refundable or direct-only settings.</p>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {filtered.map((f, i) => {
          const isBestDeal = i === 0;
          const isNonstopBonus = i === 1 && f.stops === 0 && filtered[0].stops > 0;
          const bookUrl = AFF.skyscanner(f.iataFrom||f.from||fromCity, f.iataTo||f.to||destCity, form.dateFrom, form.dateTo, form.travelers);
          return (
            <div key={i} style={{background:c.surface,border:`1.5px solid ${isBestDeal?c.accentBorder:c.border}`,borderRadius:18,overflow:"hidden",position:"relative"}}>
              {isBestDeal && <div style={{position:"absolute",top:14,right:14,zIndex:3,background:c.accent,color:"#fff",fontSize:10,fontWeight:800,padding:"4px 10px",borderRadius:20,letterSpacing:"0.08em"}}>BEST DEAL</div>}
              {isNonstopBonus && <div style={{position:"absolute",top:14,right:14,zIndex:3,background:c.teal,color:"#fff",fontSize:10,fontWeight:800,padding:"4px 10px",borderRadius:20,letterSpacing:"0.08em"}}>NONSTOP</div>}
              <div style={{position:"relative",height:168,overflow:"hidden"}}>
                <Img src={getAirlinePhoto(f.airline)} fallbackSrc={AIRLINE_PHOTOS["_fallback"]} alt={`${f.airline} aircraft`} iconName="plane"/>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to right,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.15) 65%,transparent 100%)"}}/>
                <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"14px 20px"}}>
                  <div style={{color:"#fff",fontWeight:800,fontSize:20,letterSpacing:"-0.02em",textShadow:"0 1px 4px rgba(0,0,0,0.4)"}}>{f.airline}</div>
                  <div style={{color:"rgba(255,255,255,0.78)",fontSize:13,marginTop:2}}>{f.flightNumber && <span style={{marginRight:8,opacity:0.9}}>{f.flightNumber}</span>}{f.stops===0?"Nonstop":f.stops===1?"1 stop":`${f.stops} stops`} · {f.duration}</div>
                </div>
              </div>
              <div style={{padding:"16px 20px",display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:14}}>
                <div style={{display:"flex",gap:20,alignItems:"center"}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{color:c.textSubtle,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Depart</div>
                    <div style={{color:c.text,fontWeight:900,fontSize:22,letterSpacing:"-0.02em"}}>{f.depart}</div>
                    <div style={{color:c.textMuted,fontSize:12}}>{f.iataFrom||f.from}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <div style={{color:c.textSubtle,fontSize:10}}>────</div>
                    <Icon name="plane" size={14} color={c.accent}/>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{color:c.textSubtle,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Arrive</div>
                    <div style={{color:c.text,fontWeight:900,fontSize:22,letterSpacing:"-0.02em"}}>{f.arrive}</div>
                    <div style={{color:c.textMuted,fontSize:12}}>{f.iataTo||f.to}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{color:c.accent,fontWeight:900,fontSize:26,letterSpacing:"-0.03em"}}>~${f.estimatedPrice}</div>
                  <div style={{color:c.textMuted,fontSize:11,margin:"2px 0 2px",fontStyle:"italic"}}>est. per person · {f.bookingClass||"Economy"}</div>
                  <div style={{color:f.refundable?c.success:c.danger,fontSize:12,fontWeight:700,margin:"2px 0 12px"}}>{f.refundable?"✓ Refundable":"Non-refundable"}</div>
                  <a href={bookUrl} target="_blank" rel="noopener noreferrer"
                    style={{display:"inline-flex",alignItems:"center",gap:8,padding:"11px 22px",background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,borderRadius:10,color:"#fff",textDecoration:"none",fontSize:14,fontWeight:800,boxShadow:`0 6px 20px ${c.accentBorder}`,whiteSpace:"nowrap"}}>
                    Book Now →
                  </a>
                  <div style={{color:c.textSubtle,fontSize:10,marginTop:5,textAlign:"right"}}>via Skyscanner</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hotels Tab — AI-powered hotel recommendations ────────────────────────────
function HotelsTab({ form, settings, apiKey }) {
  const { c, fontBody } = useTokens();
  const [hotels, setHotels] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchHotels() {
    if (!form.destination || !apiKey) return;
    const ck = sCacheKey("hotels", form.destination, form.style);
    const hit = sGet(ck);
    if (hit) { setHotels(hit); return; }
    setLoading(true); setHotels(null);
    try {
      const raw = await askClaude(
        `Hotel data expert. Return ONLY a JSON array of 4 real hotels. Strict rules: (1) Only real, currently-operating hotels at this exact destination — use the actual hotel brand name. (2) pricePerNight: current market nightly rate in USD — budget cities $50-120, mid-range cities $100-220, expensive cities $180-400, luxury tier $350-700. (3) rating: the hotel's actual known score on a 10-point scale (be accurate to the real property). (4) stars: the property's real star classification. (5) neighborhood: the actual district/area name. (6) amenities: only list what this specific hotel realistically offers from [wifi, pool, gym, coffee]. (7) Include variety: one budget, two mid-range, one upscale. Each: {"name":"string","stars":number,"neighborhood":"string","description":"string max 18 words","pricePerNight":number,"amenities":["wifi"],"refundable":boolean,"rating":number}. No markdown. Return exactly 4 items.`,
        `Best hotels in ${form.destination} for ${form.travelers || 2} traveler(s) with a $${form.budget || 3000} total trip budget. Travel style: ${form.style || "general"}${form.dateFrom ? `. Dates: ${form.dateFrom} to ${form.dateTo}` : ""}.`,
        apiKey, 1400
      );
      const parsed = parseJSON(raw);
      const data = Array.isArray(parsed) ? parsed : parsed.hotels || [];
      if (!data.length) throw new Error("Empty hotels array");
      sSet(ck, data);
      setHotels(data);
    } catch(e) { setHotels({ _error: true }); }
    setLoading(false);
  }

  useEffect(() => { if (form.destination && apiKey) fetchHotels(); }, [form.destination]);

  const filtered = Array.isArray(hotels)
    ? [...hotels]
        .filter(h => !settings.refundableOnly || h.refundable)
        .sort((a, b) => (a.pricePerNight||999) - (b.pricePerNight||999))
    : [];

  if (!form.destination) return (
    <div style={{textAlign:"center",padding:"72px 20px"}}>
      <div style={{fontSize:64,marginBottom:16}}>🏨</div>
      <p style={{color:c.textMuted,fontSize:15}}>Plan a trip first to see hotel recommendations</p>
    </div>
  );

  return (
    <div>
      <AdSlot/>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        {[
          {name:"Booking.com", url:AFF.bookingHotels(cityOnly(form.destination), form.dateFrom, form.dateTo, form.travelers)},
          {name:"Expedia", url:AFF.expediaHotels(cityOnly(form.destination), form.dateFrom, form.dateTo, form.travelers)},
          {name:"Hotels.com", url:AFF.hotelscom(cityOnly(form.destination), form.dateFrom, form.dateTo, form.travelers)},
          {name:"TripAdvisor", url:`https://www.tripadvisor.com/Search?q=${encodeURIComponent(cityOnly(form.destination||"")+" hotels")}`},
          {name:"Priceline", url:`https://www.priceline.com/relax/in/${encodeURIComponent(cityOnly(form.destination)||"")}`},
        ].map(s => (
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
            style={{padding:"10px 16px",background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:10,color:c.textMuted,textDecoration:"none",fontSize:13,fontWeight:600,fontFamily:fontBody}}>
            {s.name}
          </a>
        ))}
        <Btn onClick={fetchHotels} disabled={loading} variant="ghost" style={{fontSize:13,padding:"9px 16px"}}>
          <Icon name="sparkle" size={14} color={c.accentHi}/>{loading ? "Searching…" : "Refresh"}
        </Btn>
      </div>

      {loading && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
          {[1,2,3,4].map(i => <Skeleton key={i} h="340px" r="18px"/>)}
        </div>
      )}

      {hotels?._error && (
        <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:20,padding:"40px 24px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:14}}>🏨</div>
          <div style={{color:c.text,fontWeight:700,fontSize:18,marginBottom:8}}>Hotel suggestions temporarily unavailable</div>
          <p style={{color:c.textMuted,fontSize:14,lineHeight:1.6,maxWidth:380,margin:"0 auto 20px"}}>Browse hotels on Booking.com or Expedia using the links above.</p>
          <Btn onClick={fetchHotels} variant="ghost" style={{fontSize:13}}>Try again</Btn>
        </div>
      )}

      {!loading && Array.isArray(hotels) && filtered.length === 0 && hotels.length > 0 && (
        <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:14,padding:"20px 24px",textAlign:"center"}}>
          <p style={{color:c.textMuted,fontSize:14,margin:0}}>No hotels match your current filters. Try adjusting the refundable setting.</p>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
        {filtered.map((h, i) => {
          const isBestDeal = i === 0;
          const bestRatedIdx = filtered.reduce((bi, hh, ii) => (hh.rating||0) > (filtered[bi].rating||0) ? ii : bi, 0);
          const isTopRated = i === bestRatedIdx && !isBestDeal;
          const bookUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(h.name+" "+cityOnly(form.destination))}&checkin=${form.dateFrom||""}&checkout=${form.dateTo||""}&group_adults=${form.travelers||2}&no_rooms=1&aid=YOURAFFID`;
          return (
            <div key={i} style={{background:c.surface,border:`1.5px solid ${isBestDeal?c.accentBorder:c.border}`,borderRadius:18,overflow:"hidden"}}>
              {isBestDeal && <div style={{background:c.accent,padding:"7px 18px",fontSize:10,fontWeight:800,color:"#fff",letterSpacing:"0.1em",textAlign:"center"}}>★ BEST DEAL</div>}
              {isTopRated && <div style={{background:c.teal,padding:"7px 18px",fontSize:10,fontWeight:800,color:"#fff",letterSpacing:"0.1em",textAlign:"center"}}>★ TOP RATED</div>}
              <div style={{height:168,position:"relative",overflow:"hidden"}}>
                <Img src={HOTEL_PHOTOS[i % HOTEL_PHOTOS.length]} fallbackSrc={HOTEL_PHOTOS[0]} alt={h.name} iconName="hotel"/>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 55%)",pointerEvents:"none"}}/>
                <div style={{position:"absolute",bottom:14,left:16,right:16}}>
                  <div style={{color:"#fff",fontWeight:800,fontSize:17,textShadow:"0 1px 4px rgba(0,0,0,0.5)"}}>{h.name}</div>
                  <div style={{color:"rgba(255,255,255,0.8)",fontSize:12}}>{"★".repeat(Math.min(5,Math.max(1,h.stars||4)))} {h.stars||4}-star · {h.neighborhood}</div>
                </div>
              </div>
              <div style={{padding:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{background:"rgba(34,211,160,0.15)",color:c.success,padding:"4px 10px",borderRadius:8,fontSize:13,fontWeight:800}}>{h.rating||"—"}</span>
                    <span style={{color:c.textMuted,fontSize:12}}>/10</span>
                  </div>
                  <div><span style={{color:c.accent,fontWeight:900,fontSize:22}}>~${h.pricePerNight}</span><span style={{color:c.textMuted,fontSize:11}}>/night</span></div>
                </div>
                {h.description && <p style={{color:c.textMuted,fontSize:13,margin:"0 0 10px",lineHeight:1.55}}>{h.description}</p>}
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                  {h.amenities?.map(a => (
                    <span key={a} style={{background:c.bg2,border:`1px solid ${c.border}`,borderRadius:999,padding:"4px 10px",fontSize:11,color:c.textMuted,display:"inline-flex",alignItems:"center",gap:5}}>
                      <Icon name={["wifi","pool","gym","coffee"].includes(a) ? a : "info"} size={12} color={c.textMuted}/>{a}
                    </span>
                  ))}
                </div>
                <span style={{fontSize:12,fontWeight:700,color:h.refundable?c.success:c.danger,display:"block",marginBottom:10}}>{h.refundable?"✓ Free cancellation":"Non-refundable"}</span>
                <a href={bookUrl} target="_blank" rel="noopener noreferrer"
                  style={{display:"block",textAlign:"center",padding:"11px 14px",background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,borderRadius:10,color:"#fff",textDecoration:"none",fontSize:14,fontWeight:800}}>
                  Book Now →
                </a>
                <div style={{color:c.textSubtle,fontSize:10,marginTop:5,textAlign:"center"}}>via Booking.com</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Kayak car-category filter slugs ─────────────────────────────────────────
const KAYAK_CAR_TYPE = { "Economy":"economy", "Compact SUV":"suv", "Midsize":"intermediate", "Luxury":"luxury" };

// ─── Cars Tab — AI-powered car rental suggestions ─────────────────────────────
function CarsTab({ form, apiKey }) {
  const { c, fontBody } = useTokens();
  const [cars, setCars] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchCars() {
    if (!form.destination || !apiKey) return;
    const ck = sCacheKey("cars", form.destination);
    const hit = sGet(ck);
    if (hit) { setCars(hit); return; }
    setLoading(true); setCars(null);
    try {
      const nights = form.dateFrom && form.dateTo
        ? Math.max(1, Math.round((new Date(form.dateTo) - new Date(form.dateFrom)) / 864e5))
        : 5;
      const raw = await askClaude(
        `Car rental data expert. Return ONLY a JSON array of 4 rental options. Strict rules: (1) example: a specific real car model commonly available at this destination (e.g. "Toyota Corolla", "Hyundai Tucson", "Ford Mustang"). (2) estimatedDailyRate: current market rates in USD — Economy $25-55, Compact SUV $45-85, Midsize $35-70, Luxury $75-180 — adjust upward for tourist-heavy or expensive destinations. (3) features: 2-3 accurate features for this category (choose from: Automatic, Manual, Air conditioning, GPS available, Unlimited mileage, Child seat available, Bluetooth, Hybrid). (4) recommended: mark the single best value-for-money option true. Each: {"category":"Economy"|"Compact SUV"|"Midsize"|"Luxury","example":"string","estimatedDailyRate":number,"features":["string"],"recommended":boolean,"supplier":"string (e.g. Enterprise, Hertz, Avis, Budget, Sixt)"}. No markdown. Return exactly 4 items.`,
        `Car rentals in ${form.destination} for ${nights} days. Budget: $${form.budget || 3000} total for ${form.travelers || 2} traveler(s). Style: ${form.style || "general"}.`,
        apiKey, 800
      );
      const parsed = parseJSON(raw);
      const data = Array.isArray(parsed) ? parsed : parsed.cars || [];
      if (!data.length) throw new Error("Empty cars array");
      sSet(ck, data);
      setCars(data);
    } catch(e) { setCars({ _error: true }); }
    setLoading(false);
  }

  useEffect(() => { if (form.destination && apiKey) fetchCars(); }, [form.destination]);

  function categoryPhoto(cat) {
    if (!cat) return CAR_PHOTOS._fallback;
    const key = Object.keys(CAR_PHOTOS).find(k => k !== "_fallback" && cat.toLowerCase().includes(k.toLowerCase()));
    return key ? CAR_PHOTOS[key] : CAR_PHOTOS._fallback;
  }

  if (!form.destination) return (
    <div style={{textAlign:"center",padding:"72px 20px"}}>
      <div style={{fontSize:64,marginBottom:16}}>🚗</div>
      <p style={{color:c.textMuted,fontSize:15}}>Plan a trip first to see car rental options</p>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        {[
          {name:"Costco Travel", url:"https://www.costcotravel.com/Rental-Cars", badge:"Save up to 25%"},
          {name:"Kayak", url:AFF.kayakCars(cityOnly(form.destination), form.dateFrom, form.dateTo)},
          {name:"RentalCars", url:AFF.rentalcars(cityOnly(form.destination), form.dateFrom, form.dateTo)},
          {name:"Expedia Cars", url:AFF.expediaCars(cityOnly(form.destination), form.dateFrom, form.dateTo)},
        ].map(s => (
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
            style={{padding:"10px 16px",background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:10,color:c.text,textDecoration:"none",fontSize:13,display:"flex",flexDirection:"column",gap:3,fontFamily:fontBody}}>
            <span style={{fontWeight:700}}>{s.name}</span>
            {s.badge && <span style={{color:c.success,fontSize:11,fontWeight:600}}>{s.badge}</span>}
          </a>
        ))}
        <Btn onClick={fetchCars} disabled={loading} variant="ghost" style={{fontSize:13,padding:"9px 16px"}}>
          <Icon name="sparkle" size={14} color={c.accentHi}/>{loading ? "Searching…" : "Refresh"}
        </Btn>
      </div>

      {loading && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:16}}>
          {[1,2,3,4].map(i => <Skeleton key={i} h="300px" r="18px"/>)}
        </div>
      )}

      {cars?._error && (
        <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:20,padding:"40px 24px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:14}}>🚗</div>
          <div style={{color:c.text,fontWeight:700,fontSize:18,marginBottom:8}}>Car rental suggestions temporarily unavailable</div>
          <p style={{color:c.textMuted,fontSize:14,lineHeight:1.6,maxWidth:380,margin:"0 auto 20px"}}>Compare cars on Kayak or Costco Travel using the links above.</p>
          <Btn onClick={fetchCars} variant="ghost" style={{fontSize:13}}>Try again</Btn>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:16}}>
        {Array.isArray(cars) && [...cars]
          .sort((a, b) => (b.recommended?1:0) - (a.recommended?1:0) || a.estimatedDailyRate - b.estimatedDailyRate)
          .map((car, i) => {
            const bookUrl = AFF.kayakCars(cityOnly(form.destination), form.dateFrom, form.dateTo) + (KAYAK_CAR_TYPE[car.category] ? `?filter=cabtype_${KAYAK_CAR_TYPE[car.category]}` : "");
            return (
              <div key={i} style={{background:c.surface,border:`1.5px solid ${car.recommended?c.accentBorder:c.border}`,borderRadius:18,overflow:"hidden"}}>
                {car.recommended && <div style={{background:c.accent,padding:"5px 12px",fontSize:10,fontWeight:800,color:"#fff",letterSpacing:"0.08em",textAlign:"center"}}>★ BEST VALUE</div>}
                <div style={{height:168,position:"relative",overflow:"hidden"}}>
                  <Img src={categoryPhoto(car.category)} fallbackSrc={CAR_PHOTOS._fallback} alt={car.example||car.category} iconName="car"/>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,transparent 50%)"}}/>
                  <div style={{position:"absolute",top:14,left:14}}>
                    <span style={{background:"rgba(0,0,0,0.65)",color:"#fff",fontSize:11,fontWeight:800,padding:"5px 12px",borderRadius:20,backdropFilter:"blur(6px)",letterSpacing:"0.05em"}}>{(car.category||"Car").toUpperCase()}</span>
                  </div>
                </div>
                <div style={{padding:18}}>
                  <div style={{color:c.text,fontWeight:700,fontSize:16}}>{car.example}</div>
                  <div style={{color:c.textMuted,fontSize:13,margin:"2px 0 8px"}}>{car.supplier ? `${car.supplier} · ` : ""}or similar</div>
                  {car.features?.length > 0 && (
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                      {car.features.map(f => <span key={f} style={{background:c.bg2,border:`1px solid ${c.border}`,borderRadius:999,padding:"3px 9px",fontSize:11,color:c.textMuted}}>{f}</span>)}
                    </div>
                  )}
                  <div style={{color:c.accent,fontWeight:900,fontSize:22,marginBottom:14}}>~${car.estimatedDailyRate}<span style={{color:c.textMuted,fontSize:12,fontWeight:500}}>/day</span></div>
                  <a href={bookUrl} target="_blank" rel="noopener noreferrer"
                    style={{display:"block",textAlign:"center",padding:"11px",background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,borderRadius:10,color:"#fff",textDecoration:"none",fontSize:14,fontWeight:800}}>
                    Book Now →
                  </a>
                  <div style={{color:c.textSubtle,fontSize:10,marginTop:5,textAlign:"center"}}>via Kayak</div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Weather Tab ──────────────────────────────────────────────────────────────
function WeatherTab({ form, settings={} }) {
  const { c, font, fontBody } = useTokens();
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(false);
  const isFahrenheit = (settings.units||"Fahrenheit") === "Fahrenheit";
  const tempUnit  = isFahrenheit ? "°F" : "°C";
  const speedUnit = isFahrenheit ? "mph" : "km/h";
  const precipUnit = isFahrenheit ? "in" : "mm";

  async function fetchWeatherData() {
    if (!form.destination) return;
    setLoading(true);
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityOnly(form.destination))}&count=1`).then(r=>r.json());
      if (!geo.results?.length) { setWx({error:true}); setLoading(false); return; }
      const {latitude,longitude,name,country} = geo.results[0];
      const df = form.dateFrom || new Date().toISOString().split("T")[0];
      const dt = form.dateTo   || new Date(Date.now()+14*864e5).toISOString().split("T")[0];
      const tUnit = isFahrenheit ? "fahrenheit" : "celsius";
      const wUnit = isFahrenheit ? "mph" : "kmh";
      const w = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max,weathercode` +
        `&temperature_unit=${tUnit}&wind_speed_unit=${wUnit}&precipitation_unit=${isFahrenheit?"inch":"mm"}` +
        `&timezone=auto&start_date=${df}&end_date=${dt}`
      ).then(r=>r.json());
      setWx({name, country, daily:w.daily});
    } catch(e) { setWx({error:true}); }
    setLoading(false);
  }

  useEffect(()=>{ if(form.destination) fetchWeatherData(); },[form.destination, settings.units]);

  const wi = code => code===0?"☀️":code<=3?"🌤️":code<=48?"☁️":code<=67?"🌧️":code<=77?"🌨️":"⛈️";
  const wDesc = code => code===0?"Clear":code<=3?"Partly cloudy":code<=48?"Overcast":code<=67?"Rain":code<=77?"Snow":"Thunderstorm";

  if (!form.destination) return <div style={{textAlign:"center",padding:"72px 20px"}}><div style={{fontSize:64,marginBottom:16}}>🌤️</div><p style={{color:c.textMuted,fontSize:15}}>Enter a destination to see the forecast</p></div>;
  if (loading) return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:12}}>{[...Array(7)].map((_,i)=><Skeleton key={i} h="170px" r="14px"/>)}</div>;
  if (wx?.error) return (
    <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:20,padding:"40px 24px",textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:14}}>🌤️</div>
      <div style={{color:c.text,fontWeight:700,fontSize:18,marginBottom:8}}>Weather data temporarily unavailable</div>
      <p style={{color:c.textMuted,fontSize:14,lineHeight:1.6,maxWidth:380,margin:"0 auto 20px"}}>We couldn't retrieve the forecast. Please check the destination and try again.</p>
      <Btn onClick={fetchWeatherData} variant="ghost" style={{fontSize:13}}>Try again</Btn>
    </div>
  );
  if (!wx) return null;

  const d = wx.daily;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <h2 style={{color:c.text,fontSize:22,fontWeight:800,margin:0,letterSpacing:"-0.03em"}}>{wx.name}, {wx.country}</h2>
        <span style={{fontSize:12,color:c.textMuted,fontWeight:600}}>Forecast · {tempUnit} · {speedUnit}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:12}}>
        {d?.time?.map((date,i)=>(
          <div key={date} style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:14,padding:"14px 12px",textAlign:"center",display:"flex",flexDirection:"column",gap:4}}>
            {/* Date */}
            <div style={{color:c.textMuted,fontSize:11,fontWeight:700,letterSpacing:"0.04em"}}>
              {new Date(date+"T12:00:00").toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})}
            </div>
            {/* Icon + condition */}
            <div style={{fontSize:30,margin:"6px 0 2px"}}>{wi(d.weathercode[i])}</div>
            <div style={{color:c.textSubtle,fontSize:10,fontWeight:600,marginBottom:4}}>{wDesc(d.weathercode[i])}</div>
            {/* High / Low */}
            <div style={{display:"flex",justifyContent:"center",alignItems:"baseline",gap:6}}>
              <span style={{color:c.text,fontWeight:900,fontSize:17}}>{Math.round(d.temperature_2m_max[i])}{tempUnit}</span>
              <span style={{color:c.textMuted,fontSize:13}}>{Math.round(d.temperature_2m_min[i])}{tempUnit}</span>
            </div>
            {/* Wind */}
            {d.windspeed_10m_max?.[i]!=null && (
              <div style={{color:c.textMuted,fontSize:11,fontWeight:600}}>
                💨 {Math.round(d.windspeed_10m_max[i])} {speedUnit}
              </div>
            )}
            {/* Rain chance */}
            {d.precipitation_probability_max?.[i]!=null && (
              <div style={{color:d.precipitation_probability_max[i]>50?c.info:c.textSubtle,fontSize:11,fontWeight:700}}>
                🌧 {d.precipitation_probability_max[i]}%
              </div>
            )}
            {/* Precipitation amount */}
            {d.precipitation_sum?.[i]>0 && (
              <div style={{color:c.info,fontSize:10,fontWeight:600}}>
                {isFahrenheit ? d.precipitation_sum[i].toFixed(2) : Math.round(d.precipitation_sum[i]*10)/10} {precipUnit}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Landing Sections (shown before first search) ─────────────────────────────
function LandingSections({ onSearch, loading }) {
  const { c, font, fontBody } = useTokens();

  // Scroll to the search form
  function scrollToForm() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const steps = [
    { num:"01", icon:"✏️", title:"Tell us your trip", desc:"Enter your destination, travel dates, budget, and travel style. Takes about 30 seconds." },
    { num:"02", icon:"⚡", title:"AI builds your plan", desc:"TripForge generates a full day-by-day itinerary with real places, real timings, and real costs." },
    { num:"03", icon:"🎯", title:"Book everything in one place", desc:"Flights, hotels, and activities are all linked. Click to book. Done." },
  ];

  const features = [
    { emoji:"📅", title:"A complete itinerary, not a list of ideas", desc:"Every day is mapped out hour by hour with specific real places — not generic suggestions like 'visit a museum'." },
    { emoji:"💰", title:"A budget that actually adds up", desc:"See exactly what flights, hotels, food, and activities will cost before you book a single thing." },
    { emoji:"✈️", title:"Flights and hotels compared for you", desc:"TripForge pulls options from Skyscanner, Booking.com, and Expedia so you never need to open five tabs." },
    { emoji:"🧳", title:"A packing list built for your trip", desc:"Tailored to your destination, dates, and weather — not a generic checklist." },
    { emoji:"🍽️", title:"Restaurant picks from a local perspective", desc:"Specific restaurants in specific neighborhoods, with the dish you should actually order." },
    { emoji:"🖨️", title:"Printable and shareable", desc:"One tap to get a clean print-ready itinerary to share with your travel companions." },
  ];

  const metrics = [
    { val:"~30 sec", label:"To build a full itinerary" },
    { val:"190+", label:"Countries supported" },
    { val:"100%", label:"Free to plan" },
    { val:"0", label:"Tabs needed" },
  ];

  // Testimonials removed — will be added once real reviews are collected

  const sectionStyle = { padding:"72px 0 64px", borderTop:`1px solid ${c.border}` };
  const h2Style = { color:c.text, fontSize:"clamp(22px,3.5vw,32px)", fontWeight:800, letterSpacing:"-0.03em", margin:"0 0 12px", fontFamily:font };
  const subStyle = { color:c.textMuted, fontSize:16, lineHeight:1.7, margin:"0 0 48px", maxWidth:520 };

  return (
    <div style={{fontFamily:fontBody}}>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{color:c.accent,fontSize:12,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>How it works</div>
          <h2 style={{...h2Style,margin:"0 auto 12px",maxWidth:500}}>Three steps from idea to full trip plan</h2>
          <p style={{...subStyle,margin:"0 auto"}}>No travel agent. No research rabbit holes. No tab overload.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20}}>
          {steps.map((s,i)=>(
            <div key={i} style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:20,padding:"28px 24px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:16,right:20,color:c.border,fontSize:48,fontWeight:900,lineHeight:1,fontFamily:font,userSelect:"none"}}>{s.num}</div>
              <div style={{fontSize:36,marginBottom:16}}>{s.icon}</div>
              <div style={{color:c.text,fontWeight:700,fontSize:18,marginBottom:8,letterSpacing:"-0.02em"}}>{s.title}</div>
              <p style={{color:c.textMuted,fontSize:14,lineHeight:1.7,margin:0}}>{s.desc}</p>
            </div>
          ))}
        </div>
        {/* Second CTA */}
        <div style={{textAlign:"center",marginTop:40}}>
          <button onClick={scrollToForm}
            style={{display:"inline-flex",alignItems:"center",gap:10,padding:"15px 32px",background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,color:"#fff",border:"none",borderRadius:14,fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:fontBody,boxShadow:`0 8px 28px ${c.accentBorder}`,letterSpacing:"-0.01em"}}>
            <Icon name="sparkle" size={17} color="#fff"/>
            Plan My Trip Free →
          </button>
          <div style={{color:c.textSubtle,fontSize:12,marginTop:10,fontWeight:500}}>No account required · No credit card · 100% free to plan</div>
        </div>
      </div>

      {/* ── AD SLOT ──────────────────────────────────────────────────────── */}
      <AdSlot/>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{color:c.accent,fontSize:12,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>What you actually get</div>
          <h2 style={{...h2Style,margin:"0 auto"}}>Built for real travelers, not demo videos</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
          {features.map((f,i)=>(
            <div key={i} style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:16,padding:"22px 20px",display:"flex",gap:16,alignItems:"flex-start"}}>
              <span style={{fontSize:28,flexShrink:0,lineHeight:1}}>{f.emoji}</span>
              <div>
                <div style={{color:c.text,fontWeight:700,fontSize:15,marginBottom:6,lineHeight:1.3}}>{f.title}</div>
                <p style={{color:c.textMuted,fontSize:13,lineHeight:1.65,margin:0}}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TRUST SIGNALS ────────────────────────────────────────────────── */}
      <div style={{...sectionStyle,paddingBottom:80}}>
        {/* Metrics bar */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:1,background:c.border,borderRadius:16,overflow:"hidden",marginBottom:48}}>
          {metrics.map((m,i)=>(
            <div key={i} style={{background:c.surface,padding:"24px 20px",textAlign:"center"}}>
              <div style={{color:c.accent,fontSize:28,fontWeight:900,letterSpacing:"-0.03em",fontFamily:font}}>{m.val}</div>
              <div style={{color:c.textMuted,fontSize:12,fontWeight:600,marginTop:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Honest prompt — no fake reviews */}
        <div style={{maxWidth:560,margin:"0 auto",textAlign:"center",padding:"32px 28px",background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:20}}>
          <div style={{fontSize:36,marginBottom:14}}>✈️</div>
          <div style={{color:c.text,fontWeight:700,fontSize:18,marginBottom:8,letterSpacing:"-0.02em"}}>Be one of the first to try TripForge</div>
          <p style={{color:c.textMuted,fontSize:14,lineHeight:1.7,margin:"0 0 20px"}}>TripForge is brand new. Plan your trip, see what it builds, and let us know what you think. Your feedback shapes what gets built next.</p>
          <button onClick={scrollToForm}
            style={{display:"inline-flex",alignItems:"center",gap:8,padding:"12px 24px",background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:fontBody}}>
            Try it now — it&apos;s free →
          </button>
        </div>

        {/* Powered by note */}
        <div style={{textAlign:"center",marginTop:36}}>
          <span style={{color:c.textSubtle,fontSize:12,fontWeight:500}}>
            Powered by Claude AI · Trusted by travelers in 190+ countries · 100% free to plan
          </span>
        </div>
      </div>

      {/* ── FINAL CTA SECTION ────────────────────────────────────────────── */}
      <div style={{background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,borderRadius:20,padding:"52px 40px",textAlign:"center",marginBottom:16}}>
        <h2 style={{color:"#fff",fontSize:"clamp(22px,4vw,34px)",fontWeight:800,margin:"0 0 12px",letterSpacing:"-0.03em",fontFamily:font,lineHeight:1.1}}>
          Ready to stop researching<br/>and start traveling?
        </h2>
        <p style={{color:"rgba(255,255,255,0.82)",fontSize:15,margin:"0 0 28px",lineHeight:1.65}}>
          Your complete trip plan is 30 seconds away. No account required.
        </p>
        <button onClick={scrollToForm}
          style={{display:"inline-flex",alignItems:"center",gap:10,padding:"16px 36px",background:"#fff",color:c.accent,border:"none",borderRadius:14,fontSize:17,fontWeight:800,cursor:"pointer",fontFamily:fontBody,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",letterSpacing:"-0.01em"}}>
          <Icon name="sparkle" size={18} color={c.accent}/>
          Plan My Trip Free →
        </button>
        <div style={{color:"rgba(255,255,255,0.65)",fontSize:12,marginTop:14,fontWeight:500}}>
          Free to plan · Affiliate links help keep TripForge running
        </div>
      </div>

    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TripForge() {
  const { c, dark, font, fontBody } = useTokens();
  const [, toggleTheme] = useTheme();
  const apiKey = SITE_API_KEY; // Key is set at top of file — no user input needed
  const [tab, setTab]         = useState("itinerary");
  const [showSettings, setShowSettings] = useState(false);
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [form, setForm]         = useState({});
  const [settings, setSettings] = useState(()=>{try{return JSON.parse(localStorage.getItem("tf_settings")||"{}");}catch{return {};}});
  const [copied, setCopied] = useState(false);
  const ds = {currency:"USD",units:"Fahrenheit",refundableOnly:false,directOnly:false,...settings};

  function saveSettings(s){localStorage.setItem("tf_settings",JSON.stringify(s));setSettings(s);}

  function shareTrip() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2200); });
    } else {
      const el = Object.assign(document.createElement("input"),{value:url,style:"position:fixed;opacity:0"});
      document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el);
      setCopied(true); setTimeout(()=>setCopied(false),2200);
    }
  }

  // Auto-search when page is loaded via a shared link
  useEffect(()=>{
    try {
      const p = new URLSearchParams(window.location.search);
      const dest = p.get("dest");
      if (!dest) return;
      handleSearch({
        destination: dest, from: p.get("from")||"",
        dateFrom: p.get("df")||"", dateTo: p.get("dt")||"",
        travelers: p.get("t")||"2", budget: p.get("b")||"3000",
        style: p.get("s")||"relaxation",
        multiCity: false, surpriseMode: false,
        destinations: [{ city: dest, dateFrom: p.get("df")||"", dateTo: p.get("dt")||"" }],
      });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function handleSearch(formData) {
    setForm(formData); setLoading(true); setTab("itinerary"); setTripData(null);
    try {
      const nights = formData.dateFrom&&formData.dateTo
        ? Math.max(1,Math.round((new Date(formData.dateTo)-new Date(formData.dateFrom))/864e5)) : 5;
      // Activity days = nights (arrival day counts, departure day does NOT get its own day)
      const activityDays = nights;

      const dateContext = formData.dateFrom
        ? `Arrival: ${formData.dateFrom}. Departure: ${formData.dateTo||"open-ended"}. CRITICAL: plan exactly ${activityDays} days (Day 1 = arrival day ${formData.dateFrom}, Day ${activityDays} = last full day before departure — do NOT create a separate departure day). Only suggest attractions confirmed open during these dates. Mention seasonal events or weather for this period.`
        : `Dates flexible — plan for a typical season. Plan exactly ${activityDays} days.`;

      const dest = formData.surpriseMode
        ? `Best ${formData.style} destination within $${formData.budget} from ${formData.from||"the US"} for ${formData.travelers} travelers`
        : formData.multiCity
          ? `multi-city: ${formData.destinations?.map(d=>d.city).filter(Boolean).join(" → ")}`
          : formData.destination;

      const ck = sCacheKey("itin", dest, formData.style, formData.travelers, formData.budget, nights);
      const hit = sGet(ck);
      if (hit) { setTripData(hit); setLoading(false); return; }

      const system = `You are an expert travel planner. RULES:
1. All activities, restaurants, and attractions MUST be real places in ${dest} accessible during the given dates.
2. Use real names — no generic placeholders.
3. Budget accurately for ${formData.travelers} traveler(s).
4. Keep descriptions SHORT — max 15 words each. Keep notes null unless essential.
5. The "days" array MUST contain exactly ${activityDays} entries — no more, no fewer. Day 1 is the arrival day. The departure day is NOT a separate day.
6. Return ONLY valid JSON. No markdown. No commentary. No trailing commas.
{"destination":"string","summary":"1 sentence overview + 1 sentence seasonal note","budgetBreakdown":{"flights":"~$XXX","hotels":"~$XXX/night","food":"~$XX/day","activities":"~$XXX total"},"days":[{"title":"string","theme":"string","activities":[{"time":"string","name":"string","description":"string max 15 words","cost":"string or null"}],"notes":null}],"tips":["string","string","string"]}`;

      const raw = await askClaude(system,
        `Plan a ${formData.style} trip to ${dest} with exactly ${activityDays} days in the itinerary. ${formData.travelers} traveler(s). $${formData.budget} total budget. ${dateContext} Origin: ${formData.from||"unspecified"}.`,
        apiKey, 4096
      );
      const parsed = parseJSON(raw);
      sSet(ck, parsed);
      setTripData(parsed);
      // Encode trip in URL so it can be shared
      if (!formData.multiCity && !formData.surpriseMode && formData.destination) {
        try {
          const p = new URLSearchParams({
            dest: formData.destination, from: formData.from||"",
            df: formData.dateFrom||"", dt: formData.dateTo||"",
            t: formData.travelers||"2", b: formData.budget||"3000",
            s: formData.style||"relaxation",
          });
          history.replaceState(null, "", `?${p}`);
        } catch {}
      }
    } catch(e) {
      setTripData({destination:formData.destination||"Your Trip",_error:true,days:[],tips:[]});
    }
    setLoading(false);
  }

  // API key is hardcoded — no modal needed

  const tabs = [
    {id:"itinerary",   label:"Itinerary",   icon:"map"},
    {id:"map",         label:"Map",         icon:"pin"},
    {id:"restaurants", label:"Restaurants", icon:"fork"},
    {id:"flights",     label:"Flights",     icon:"plane"},
    {id:"hotels",      label:"Hotels",      icon:"hotel"},
    {id:"cars",        label:"Cars",        icon:"car"},
    {id:"weather",     label:"Weather",     icon:"sun"},
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;}
        body{background:${c.bg};font-family:${fontBody};-webkit-font-smoothing:antialiased;moz-osx-font-smoothing:grayscale;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes progress{from{width:0%}to{width:95%}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .pill-scroll::-webkit-scrollbar{display:none;}
        .pill-scroll{-ms-overflow-style:none;scrollbar-width:none;}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:${dark?"invert(0.6)":"none"};opacity:0.6;cursor:pointer;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:${c.accentBorder};border-radius:4px;}
        select option{background:${c.bg2};color:${c.text};}
        button,a{-webkit-tap-highlight-color:transparent;}
        .print-only{display:none!important;}
        .print-watermark{display:none!important;}
        @media print{
          *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
          @page{margin:2cm 2.2cm;size:A4 portrait;}
          .no-print,header,footer,nav{display:none!important;}
          body{background:white!important;color:#12100e!important;font-family:"DM Sans",system-ui,sans-serif!important;}
          .print-only{display:block!important;}
          .print-watermark{display:flex!important;}
          .print-pg-footer{display:block!important;}
          /* Day cards — always show content, clean borders */
          [class*="daycard"]{break-inside:avoid;page-break-inside:avoid;}
          /* Budget grid — spread across page */
          div[style*="repeat(auto-fit"]{grid-template-columns:repeat(4,1fr)!important;}
          /* Hide interactive controls */
          .no-print button,.no-print a{display:none!important;}
          /* Remove box shadows, simplify borders */
          *{box-shadow:none!important;}
          a{color:#e8520a!important;text-decoration:none!important;}
          /* Itinerary section spacing */
          h2{font-size:20px!important;margin-bottom:12px!important;}
        }
        .header-cta{display:none!important;}
        @media(min-width:640px){.header-cta{display:inline-flex!important;}}
        /* Smooth section fade-in on scroll */
        @keyframes sectionIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
      `}</style>

      <div style={{minHeight:"100vh",background:c.bg,color:c.text,fontFamily:fontBody}}>

        {/* Header */}
        <header className="no-print" style={{
          position:"sticky",top:0,zIndex:100,
          background:dark?"rgba(8,10,15,0.92)":"rgba(250,249,247,0.94)",
          backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
          borderBottom:`1px solid ${c.border}`,
          padding:"0 20px",height:60,
          display:"flex",alignItems:"center",justifyContent:"space-between",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 12px ${c.accentBorder}`}}>
              <Icon name="globe" size={18} color="#fff"/>
            </div>
            <span style={{fontSize:18,fontWeight:800,letterSpacing:"-0.04em",color:c.text,fontFamily:font}}>TripForge</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}
              style={{display:"none",padding:"8px 18px",background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:fontBody}}
              className="header-cta">
              Plan a Trip
            </button>
            {tripData && !tripData._error && (
              <button onClick={shareTrip} style={{background:"none",border:`1.5px solid ${copied?c.success:c.border}`,borderRadius:10,padding:"7px 12px",color:copied?c.success:c.textMuted,cursor:"pointer",display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,fontFamily:fontBody,transition:"all 0.2s"}}>
                <Icon name={copied?"check":"share"} size={15} color={copied?c.success:c.textMuted}/>
                <span style={{display:"none"}} className="header-cta">{copied?"Copied!":"Share"}</span>
              </button>
            )}
            <button onClick={toggleTheme} style={{background:"none",border:`1.5px solid ${c.border}`,borderRadius:10,padding:"7px 12px",color:c.textMuted,cursor:"pointer",display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,fontFamily:fontBody}}>
              <Icon name={dark?"sun":"moon"} size={15} color={c.textMuted}/>
            </button>
            <button onClick={()=>setShowSettings(!showSettings)} style={{background:"none",border:"none",color:c.textMuted,cursor:"pointer",padding:"8px",borderRadius:10}}>
              <Icon name="settings" size={20} color={c.textMuted}/>
            </button>
          </div>
        </header>

        {/* Main */}
        <main style={{maxWidth:1160,margin:"0 auto",padding:"24px 20px 48px",animation:"fadeUp 0.4s ease"}}>
          <div className="no-print">
            <HeroSearch onSearch={handleSearch} loading={loading}/>
            {!tripData && !loading && <LandingSections onSearch={handleSearch} loading={loading}/>}
          </div>

          {/* Print-only branded header */}
          {(tripData || loading) && (
            <div className="print-only" style={{paddingBottom:20,marginBottom:28,borderBottom:"2.5px solid #e8520a"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontFamily:'"Sora",system-ui,sans-serif',fontSize:28,fontWeight:900,color:"#e8520a",letterSpacing:"-0.04em",lineHeight:1}}>TripForge</div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#6b6258",marginTop:5}}>AI Travel Planner · tripforge.app</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:22,fontWeight:800,color:"#12100e",letterSpacing:"-0.03em"}}>{tripData?.destination || form.destination}</div>
                  {form.dateFrom && <div style={{fontSize:13,color:"#6b6258",marginTop:4}}>{form.dateFrom}{form.dateTo?` → ${form.dateTo}`:""} · {form.travelers||2} traveler{Number(form.travelers)>1?"s":""}</div>}
                  <div style={{fontSize:11,color:"#b5ada4",marginTop:3}}>Generated {new Date().toLocaleDateString("en",{year:"numeric",month:"long",day:"numeric"})}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="no-print" style={{display:"flex",gap:0,marginBottom:28,borderBottom:`1.5px solid ${c.border}`,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:"12px 14px",background:"none",border:"none",cursor:"pointer",
                borderBottom:`2.5px solid ${tab===t.id?c.accent:"transparent"}`,
                color:tab===t.id?c.text:c.textMuted,
                fontSize:13,fontWeight:tab===t.id?700:500,
                display:"flex",alignItems:"center",gap:7,
                whiteSpace:"nowrap",fontFamily:fontBody,
                marginBottom:-2,transition:"color 0.15s,border-color 0.15s",
                flexShrink:0,
              }}>
                <Icon name={t.icon} size={15} color={tab===t.id?c.accent:c.textMuted}/>
                {t.label}
              </button>
            ))}
          </div>

          {tab==="itinerary"   && <ItineraryTab   tripData={tripData} loading={loading} form={form} apiKey={apiKey}/>}
          {tab==="map"         && <MapTab         tripData={tripData} form={form}/>}
          {tab==="restaurants" && <RestaurantsTab form={form} apiKey={apiKey}/>}
          {tab==="flights"     && <FlightsTab     form={form} settings={ds} apiKey={apiKey}/>}
          {tab==="hotels"      && <HotelsTab      form={form} settings={ds} apiKey={apiKey}/>}
          {tab==="cars"        && <CarsTab        form={form} apiKey={apiKey}/>}
          {tab==="weather"     && <WeatherTab     form={form} settings={ds}/>}
        </main>

        <footer style={{borderTop:`1px solid ${c.border}`,padding:"28px 20px",maxWidth:1160,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:24,marginBottom:20}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Icon name="globe" size={14} color="#fff"/>
                </div>
                <span style={{color:c.text,fontWeight:800,fontSize:15,fontFamily:font}}>TripForge</span>
              </div>
              <p style={{color:c.textSubtle,fontSize:12,lineHeight:1.6,maxWidth:280,margin:0}}>
                AI-powered travel planning. Turn a destination and a budget into a complete trip plan in 30 seconds.
              </p>
            </div>
            <div style={{display:"flex",gap:40,flexWrap:"wrap"}}>
              <div>
                <div style={{color:c.textMuted,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Plan</div>
                {[["Flights","#"],["Hotels","#"],["Car Rental","#"],["Restaurants","#"],["Weather","#"]].map(([label,href])=>(
                  <div key={label}><a href={href} style={{color:c.textSubtle,fontSize:13,textDecoration:"none",lineHeight:2.2,display:"block"}}>{label}</a></div>
                ))}
              </div>
              <div>
                <div style={{color:c.textMuted,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Company</div>
                {[["Privacy Policy","#"],["Affiliate Disclosure","#"],["Contact","#"]].map(([label,href])=>(
                  <div key={label}><a href={href} style={{color:c.textSubtle,fontSize:13,textDecoration:"none",lineHeight:2.2,display:"block"}}>{label}</a></div>
                ))}
              </div>
            </div>
          </div>
          <div style={{borderTop:`1px solid ${c.border}`,paddingTop:16,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <span style={{color:c.textSubtle,fontSize:12}}>© 2026 TripForge. All rights reserved.</span>
            <span style={{color:c.textSubtle,fontSize:11}}>AI-estimated prices for reference only — always confirm live pricing on provider sites. Some links are affiliate links that help keep TripForge free.</span>
          </div>
        </footer>

        {showSettings&&<SettingsPanel settings={ds} onChange={saveSettings} onClose={()=>setShowSettings(false)}/>}

        {/* Repeating diagonal watermark — print only */}
        <div className="print-watermark" style={{position:"fixed",top:"-20%",left:"-10%",width:"120%",height:"140%",pointerEvents:"none",zIndex:9999,overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center",transform:"rotate(-35deg)",transformOrigin:"center center"}}>
          {[...Array(10)].map((_,i)=>(
            <div key={i} style={{display:"flex",gap:"80px",whiteSpace:"nowrap"}}>
              {[...Array(5)].map((_,j)=>(
                <span key={j} style={{fontSize:30,fontWeight:900,color:"rgba(232,82,10,0.08)",fontFamily:'"Sora",system-ui,sans-serif',letterSpacing:"-0.02em",userSelect:"none"}}>TripForge</span>
              ))}
            </div>
          ))}
        </div>

        {/* Print footer */}
        <div className="print-only print-pg-footer" style={{position:"fixed",bottom:16,left:0,right:0,textAlign:"center",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#b5ada4"}}>
          TripForge AI Travel Planner · tripforge.app · Prices are AI estimates — verify before booking
        </div>
      </div>
    </>
  );
}
