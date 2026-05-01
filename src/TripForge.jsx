import { useEffect, useState, useCallback, useRef } from "react";

// ─── Model ────────────────────────────────────────────────────────────────────
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// ─── YOUR API KEY — see implementation note at bottom of file ────────────────
const SITE_API_KEY = "YOUR_ANTHROPIC_API_KEY_HERE";

// ─── Affiliate links ─────────────────────────────────────────────────────────
const AFF = {
  skyscanner: (from, to, date) =>
    `https://www.skyscanner.com/transport/flights/${encodeURIComponent(from||"")}/${encodeURIComponent(to||"")}/${date?.replace(/-/g,"")||""}/?utm_source=YOURAFFID`,
  bookingHotels: (dest) =>
    `https://www.booking.com/search.html?ss=${encodeURIComponent(dest||"")}&aid=YOURAFFID`,
  expediaHotels: (dest) =>
    `https://www.expedia.com/Hotels-Search?destination=${encodeURIComponent(dest||"")}&affcid=YOURAFFID`,
  expediaFlights: (from, to) =>
    `https://www.expedia.com/Flights-Search?flight-type=on&mode=search&trip=oneway&leg1=from:${encodeURIComponent(from||"")},to:${encodeURIComponent(to||"")}&affcid=YOURAFFID`,
  kayakCars: (dest) =>
    `https://www.kayak.com/cars/${encodeURIComponent(dest||"")}?affiliate=YOURAFFID`,
  viator: (dest) =>
    `https://www.viator.com/searchResults/all?text=${encodeURIComponent(dest||"")}&pid=YOURAFFID`,
  googleFlights: (from, to) =>
    `https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(from||"")}+to+${encodeURIComponent(to||"")}`,
};

// ─── Real aircraft photos ─────────────────────────────────────────────────────
const AIRLINE_PHOTOS = {
  "Delta Airlines":    "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=900&h=480&q=85",
  "American Airlines": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&h=480&q=85",
  "United Airlines":   "https://images.unsplash.com/photo-1540962357608-b2e3bba36c18?auto=format&fit=crop&w=900&h=480&q=85",
  "Lufthansa":         "https://images.unsplash.com/photo-1570145007675-901791fe9fdb?auto=format&fit=crop&w=900&h=480&q=85",
  "_fallback":         "https://images.unsplash.com/photo-1464037866556-abfb2b3b75a3?auto=format&fit=crop&w=900&h=480&q=85",
};

// ─── Real specific car model photos ──────────────────────────────────────────
const CAR_PHOTOS = {
  "Toyota Yaris":  "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&h=480&q=85",
  "Nissan Rogue":  "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&h=480&q=85",
  "Toyota Camry":  "https://images.unsplash.com/photo-1494976388531-d0858494cdd9?auto=format&fit=crop&w=800&h=480&q=85",
  "BMW 5 Series":  "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&h=480&q=85",
  "_fallback":     "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=800&h=480&q=85",
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
async function askClaude(system, user, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
    body:JSON.stringify({ model:CLAUDE_MODEL, max_tokens:4096, system, messages:[{role:"user",content:user}] }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message||"API error"); }
  const d = await res.json();
  return d.content.map(b=>b.text||"").join("");
}
function parseJSON(raw) {
  let clean = raw.replace(/```json|```/g,"").trim();
  const s = clean.indexOf("{")!==-1 ? clean.indexOf("{") : clean.indexOf("[");
  clean = clean.slice(s);
  // Try straight parse first
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

// ─── API Key Modal removed — key is now set server-side via SITE_API_KEY ────────

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ settings, onChange, onClose }) {
  const { c, fontBody } = useTokens();
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
  const { c, fontBody } = useTokens();
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
      {/* Orange header band */}
      <div style={{background:`linear-gradient(135deg,${c.accent} 0%,${c.accentHi} 100%)`,padding:"22px 28px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div>
            <h2 style={{color:"#fff",fontSize:20,fontWeight:800,margin:0,letterSpacing:"-0.03em"}}>Plan your perfect trip</h2>
            <p style={{color:"rgba(255,255,255,0.78)",fontSize:13,margin:"4px 0 0"}}>AI builds your full itinerary in seconds</p>
          </div>
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

      <div style={{padding:"24px 28px 28px"}}>
        {/* Destination(s) */}
        {multiCity ? (
          <div style={{marginBottom:16}}>
            {dests.map((d,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:10,marginBottom:10,alignItems:"center"}}>
                <Field icon="pin" value={d.city} onChange={e=>upd(i,"city",e.target.value)} placeholder={`Stop ${i+1} — city`}/>
                <Field icon="calendar" value={d.dateFrom} onChange={e=>upd(i,"dateFrom",e.target.value)} type="date" placeholder="Arrive"/>
                <Field icon="calendar" value={d.dateTo} onChange={e=>upd(i,"dateTo",e.target.value)} type="date" placeholder="Depart"/>
                {dests.length>2
                  ? <button onClick={()=>setDests(d=>d.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:6,borderRadius:8}}><Icon name="trash" size={16} color={c.danger}/></button>
                  : <div/>}
              </div>
            ))}
            <Btn onClick={()=>setDests(d=>[...d,{city:"",dateFrom:"",dateTo:""}])} variant="muted" style={{fontSize:13,padding:"9px 16px"}}>
              <Icon name="plus" size={14} color={c.textMuted}/>Add stop
            </Btn>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginBottom:16}}>
            <Field icon="pin" value={dests[0]?.city} onChange={e=>upd(0,"city",e.target.value)} placeholder="Where to? Paris, Tokyo, Bali…"/>
            <Field icon="calendar" value={dests[0]?.dateFrom} onChange={e=>upd(0,"dateFrom",e.target.value)} type="date" placeholder="Depart date"/>
            <Field icon="calendar" value={dests[0]?.dateTo} onChange={e=>upd(0,"dateTo",e.target.value)} type="date" placeholder="Return date"/>
          </div>
        )}

        {/* Shared row — "Flying from" appears exactly ONCE */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:18}}>
          <Field icon="plane" value={from} onChange={e=>setFrom(e.target.value)} placeholder="Flying from (city or airport)"/>
          <Field icon="dollar" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="Total budget ($)" type="number"/>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",opacity:0.5}}><Icon name="users" size={15} color={c.text}/></span>
            <select value={travelers} onChange={e=>setTravelers(e.target.value)} style={selStyle}>
              {[1,2,3,4,5,6,8,10].map(n=><option key={n} value={n}>{n} traveler{n>1?"s":""}</option>)}
            </select>
          </div>
        </div>

        {/* Style pills */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:22}}>
          {styles.map(s=>(
            <button key={s} onClick={()=>setStyle(s)}
              style={{padding:"7px 14px",borderRadius:999,border:`1.5px solid ${style===s?c.accentBorder:c.border}`,background:style===s?c.accentLow:"transparent",color:style===s?c.accentHi:c.textMuted,fontSize:12,fontWeight:style===s?700:500,cursor:"pointer",fontFamily:fontBody,textTransform:"capitalize",transition:"all 0.15s"}}>
              {s}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <Btn onClick={()=>go(false)} disabled={loading} style={{flex:1,minWidth:200,padding:"14px 24px",fontSize:15,borderRadius:14}}>
            <Icon name="sparkle" size={17} color="#fff"/>
            {loading?"Building your itinerary…":"Build my itinerary"}
          </Btn>
          <Btn onClick={()=>go(true)} disabled={loading} variant="muted" style={{flexShrink:0,borderRadius:14}}>
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

  async function getExtras() {
    setExtrasLoading(true); setExtras(null);
    try {
      const raw = await askClaude(
        `Travel expert. Return ONLY JSON: {"budgetTips":["string","string","string"],"packing":{"categories":[{"name":"string","items":["string"]}]}}. No markdown.`,
        `${form.style} trip to ${form.destination}. ${form.travelers} travelers. $${form.budget} budget. ${form.dateFrom||"flexible"} to ${form.dateTo||"flexible"}.`,
        apiKey
      );
      setExtras(parseJSON(raw));
    } catch(e) { setExtras({_error:true}); }
    setExtrasLoading(false);
  }

  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:c.surface,borderRadius:18,padding:32,textAlign:"center",border:`1.5px solid ${c.border}`}}>
        <div style={{fontSize:52,marginBottom:14,display:"inline-block",animation:"spin 2s linear infinite"}}>✈️</div>
        <div style={{color:c.text,fontSize:18,fontWeight:700,marginBottom:6}}>Building your itinerary…</div>
        <div style={{color:c.textMuted,fontSize:14}}>TripForge is crafting your {form.style} trip to {form.destination}</div>
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

      {days?.map((day,i)=><DayCard key={i} day={day} index={i}/>)}

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

function DayCard({ day, index }) {
  const { c, fontBody } = useTokens();
  const [open, setOpen] = useState(index < 2);
  return (
    <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:16,marginBottom:10,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"18px 22px",background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left",fontFamily:fontBody}}>
        <div>
          <span style={{color:c.accent,fontWeight:800,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase"}}>Day {index+1}</span>
          <div style={{color:c.text,marginTop:4,fontSize:16,fontWeight:700,letterSpacing:"-0.02em"}}>{day.title||day.theme}</div>
        </div>
        <span style={{transform:open?"rotate(90deg)":"none",transition:"transform 0.2s",display:"inline-flex",flexShrink:0}}>
          <Icon name="chevron" size={20} color={c.textMuted}/>
        </span>
      </button>
      {open && (
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
  const { c } = useTokens();
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
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(form.destination||"")}&count=1`)
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
    setLoading(true); setRecs(null);
    try {
      const raw = await askClaude(
        `Local food expert. Return ONLY JSON: {"restaurants":[{"name":"string","cuisine":"string","priceRange":"$/$$/$$$/$$$$","mustTry":"string","neighborhood":"string","tip":"string"}]}. 6 restaurants. No markdown.`,
        `Best restaurants in ${form.destination} for a ${form.style||"general"} trip.`,
        apiKey
      );
      setRecs(parseJSON(raw));
    } catch(e) { setRecs({error:true}); }
    setLoading(false);
  }

  useEffect(()=>{ if(form.destination&&apiKey&&!recs) getRecs(); },[form.destination]);

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
          <div key={i} style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:16,padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{color:c.text,fontWeight:700,fontSize:16}}>{r.name}</div>
                <div style={{color:c.textMuted,fontSize:13,marginTop:3}}>{r.cuisine} · {r.neighborhood}</div>
              </div>
              <span style={{color:pc(r.priceRange),fontWeight:800,fontSize:15,flexShrink:0,marginLeft:8}}>{r.priceRange}</span>
            </div>
            {r.mustTry&&<div style={{background:c.accentLow,border:`1px solid ${c.accentBorder}`,borderRadius:9,padding:"8px 12px",marginBottom:10}}><span style={{color:c.accent,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Must try: </span><span style={{color:c.text,fontSize:13}}>{r.mustTry}</span></div>}
            {r.tip&&<p style={{color:c.textMuted,fontSize:13,margin:0,lineHeight:1.6}}>💡 {r.tip}</p>}
          </div>
        ))}
      </div>
      <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:12,padding:16}}>
        <p style={{color:c.textMuted,fontSize:13,margin:0,lineHeight:1.6}}><strong style={{color:c.text}}>Book a table: </strong>
          {[{name:"OpenTable",url:`https://www.opentable.com/s?term=${encodeURIComponent(form.destination||"")}`},{name:"Yelp",url:`https://www.yelp.com/search?find_desc=Restaurants&find_loc=${encodeURIComponent(form.destination||"")}`},{name:"TripAdvisor",url:`https://www.tripadvisor.com/Search?q=${encodeURIComponent((form.destination||"")+" restaurants")}`}].map((s,i)=><span key={s.name}><a href={s.url} target="_blank" rel="noopener noreferrer" style={{color:c.accentHi,fontWeight:600}}>{s.name}</a>{i<2?" · ":""}</span>)}
        </p>
      </div>
    </div>
  );
}

// ─── Flights Tab — real aircraft photos with airline name overlay ──────────────
function FlightsTab({ form, settings }) {
  const { c, fontBody } = useTokens();
  const skUrl = AFF.skyscanner(form.from,form.destination,form.dateFrom);
  const flights = [
    { airline:"Delta Airlines",    from:form.from||"JFK", to:form.destination||"Destination", depart:"08:15", arrive:"14:30",   duration:"6h 15m",  stops:0, price:487, refundable:true  },
    { airline:"American Airlines", from:form.from||"JFK", to:form.destination||"Destination", depart:"11:40", arrive:"18:55",   duration:"7h 15m",  stops:1, price:342, refundable:false },
    { airline:"United Airlines",   from:form.from||"JFK", to:form.destination||"Destination", depart:"22:00", arrive:"12:20+1", duration:"14h 20m", stops:1, price:299, refundable:false },
    { airline:"Lufthansa",         from:form.from||"JFK", to:form.destination||"Destination", depart:"16:50", arrive:"08:30+1", duration:"15h 40m", stops:0, price:612, refundable:true  },
  ].filter(f=>(!settings.refundableOnly||f.refundable)&&(!settings.directOnly||f.stops===0));

  return (
    <div>
      <AdSlot/>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {[{name:"🔍 Skyscanner",url:skUrl,primary:true},{name:"Google Flights",url:AFF.googleFlights(form.from,form.destination)},{name:"Expedia",url:AFF.expediaFlights(form.from,form.destination)},{name:"Kayak",url:"https://www.kayak.com/flights"}].map(s=>(
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
            style={{padding:"10px 18px",background:s.primary?c.accentLow:c.surface,border:`1.5px solid ${s.primary?c.accentBorder:c.border}`,borderRadius:10,color:s.primary?c.accentHi:c.textMuted,textDecoration:"none",fontSize:13,fontWeight:700,fontFamily:fontBody}}>
            {s.name}
          </a>
        ))}
      </div>
      <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:10,padding:"12px 16px",marginBottom:18,display:"flex",gap:10}}>
        <Icon name="info" size={16} color={c.info}/>
        <p style={{color:c.textMuted,fontSize:13,margin:0,lineHeight:1.6}}>Sample fares for reference — use the links above for live pricing.</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {flights.map((f,i)=>(
          <div key={i} style={{background:c.surface,border:`1.5px solid ${i===2?c.accentBorder:c.border}`,borderRadius:18,overflow:"hidden",position:"relative"}}>
            {i===2&&<div style={{position:"absolute",top:14,right:14,zIndex:3,background:c.accent,color:"#fff",fontSize:10,fontWeight:800,padding:"4px 10px",borderRadius:20,letterSpacing:"0.08em"}}>BEST VALUE</div>}
            {/* Real aircraft photo with gradient overlay */}
            <div style={{position:"relative",height:168,overflow:"hidden"}}>
              <Img src={AIRLINE_PHOTOS[f.airline]} fallbackSrc={AIRLINE_PHOTOS["_fallback"]} alt={`${f.airline} aircraft`} iconName="plane"/>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(to right,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.15) 65%,transparent 100%)"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"14px 20px"}}>
                <div style={{color:"#fff",fontWeight:800,fontSize:20,letterSpacing:"-0.02em",textShadow:"0 1px 4px rgba(0,0,0,0.4)"}}>{f.airline}</div>
                <div style={{color:"rgba(255,255,255,0.78)",fontSize:13,marginTop:2}}>{f.stops===0?"Nonstop":"1 stop"} · {f.duration}</div>
              </div>
            </div>
            {/* Flight details */}
            <div style={{padding:"16px 20px",display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:14}}>
              <div style={{display:"flex",gap:20,alignItems:"center"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{color:c.textSubtle,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Depart</div>
                  <div style={{color:c.text,fontWeight:900,fontSize:22,letterSpacing:"-0.02em"}}>{f.depart}</div>
                  <div style={{color:c.textMuted,fontSize:12}}>{f.from}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{color:c.textSubtle,fontSize:10}}>────</div>
                  <Icon name="plane" size={14} color={c.accent}/>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{color:c.textSubtle,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Arrive</div>
                  <div style={{color:c.text,fontWeight:900,fontSize:22,letterSpacing:"-0.02em"}}>{f.arrive}</div>
                  <div style={{color:c.textMuted,fontSize:12}}>{f.to}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:c.accent,fontWeight:900,fontSize:26,letterSpacing:"-0.03em"}}>${f.price}</div>
                <div style={{color:f.refundable?c.success:c.danger,fontSize:12,fontWeight:700,margin:"4px 0 10px"}}>{f.refundable?"✓ Refundable":"Non-refundable"}</div>
                <a href={skUrl} target="_blank" rel="noopener noreferrer"
                  style={{display:"inline-block",padding:"10px 22px",background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,borderRadius:10,color:"#fff",textDecoration:"none",fontSize:14,fontWeight:800,boxShadow:`0 6px 20px ${c.accentBorder}`}}>
                  Book →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hotels Tab — real hotel exterior photos ──────────────────────────────────
function HotelsTab({ form, settings }) {
  const { c, fontBody } = useTokens();
  const hotels = [
    { name:"Le Grand Palace",    stars:5, rating:9.4, reviews:2341, price:289, refundable:true,  amenities:["wifi","pool","gym","coffee"], img:HOTEL_PHOTOS[0] },
    { name:"Boutique Central",   stars:4, rating:9.1, reviews:876,  price:145, refundable:true,  amenities:["wifi","coffee"],              img:HOTEL_PHOTOS[1] },
    { name:"Urban Loft Hotel",   stars:4, rating:8.8, reviews:1203, price:118, refundable:false, amenities:["wifi","gym"],                 img:HOTEL_PHOTOS[2] },
    { name:"The Traveler's Inn", stars:3, rating:8.5, reviews:4520, price:74,  refundable:true,  amenities:["wifi","coffee"],              img:HOTEL_PHOTOS[3] },
  ].filter(h=>!settings.refundableOnly||h.refundable);

  return (
    <div>
      <AdSlot/>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {[{name:"Booking.com",url:AFF.bookingHotels(form.destination)},{name:"Expedia",url:AFF.expediaHotels(form.destination)},{name:"Hotels.com",url:`https://www.hotels.com/search.do?q-destination=${encodeURIComponent(form.destination||"")}`},{name:"TripAdvisor",url:`https://www.tripadvisor.com/Search?q=${encodeURIComponent((form.destination||"")+" hotels")}`},{name:"Priceline",url:`https://www.priceline.com/relax/in/${encodeURIComponent(form.destination||"")}`}].map(s=>(
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
            style={{padding:"10px 16px",background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:10,color:c.textMuted,textDecoration:"none",fontSize:13,fontWeight:600,fontFamily:fontBody}}>
            {s.name}
          </a>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
        {hotels.map((h,i)=>(
          <div key={i} style={{background:c.surface,border:`1.5px solid ${i===1?c.accentBorder:c.border}`,borderRadius:18,overflow:"hidden"}}>
            {i===1&&<div style={{background:c.accent,padding:"7px 18px",fontSize:10,fontWeight:800,color:"#fff",letterSpacing:"0.1em",textAlign:"center"}}>★ BEST VALUE</div>}
            <div style={{height:168,position:"relative",overflow:"hidden"}}>
              <Img src={h.img} fallbackSrc={HOTEL_PHOTOS[3]} alt={h.name} iconName="hotel"/>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 55%)",pointerEvents:"none"}}/>
              <div style={{position:"absolute",bottom:14,left:16,right:16}}>
                <div style={{color:"#fff",fontWeight:800,fontSize:17,textShadow:"0 1px 4px rgba(0,0,0,0.5)"}}>{h.name}</div>
                <div style={{color:"rgba(255,255,255,0.8)",fontSize:12}}>{"★".repeat(h.stars)} {h.stars}-star</div>
              </div>
            </div>
            <div style={{padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{background:"rgba(34,211,160,0.15)",color:c.success,padding:"4px 10px",borderRadius:8,fontSize:13,fontWeight:800}}>{h.rating}</span>
                  <span style={{color:c.textMuted,fontSize:12}}>{h.reviews.toLocaleString()} reviews</span>
                </div>
                <div><span style={{color:c.accent,fontWeight:900,fontSize:22}}>${h.price}</span><span style={{color:c.textMuted,fontSize:11}}>/night</span></div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                {h.amenities.map(a=><span key={a} style={{background:c.bg2,border:`1px solid ${c.border}`,borderRadius:999,padding:"4px 10px",fontSize:11,color:c.textMuted,display:"inline-flex",alignItems:"center",gap:5}}><Icon name={a} size={12} color={c.textMuted}/>{a}</span>)}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:h.refundable?c.success:c.danger}}>{h.refundable?"Free cancellation":"Non-refundable"}</span>
                <a href={AFF.bookingHotels(form.destination)} target="_blank" rel="noopener noreferrer"
                  style={{padding:"9px 18px",background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,borderRadius:10,color:"#fff",textDecoration:"none",fontSize:13,fontWeight:800}}>
                  View →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cars Tab — real specific car photos ─────────────────────────────────────
function CarsTab({ form }) {
  const { c, fontBody } = useTokens();
  const cars = [
    { type:"Economy",     ex:"Toyota Yaris", price:28,  img:CAR_PHOTOS["Toyota Yaris"], fb:CAR_PHOTOS["_fallback"] },
    { type:"Compact SUV", ex:"Nissan Rogue", price:52,  img:CAR_PHOTOS["Nissan Rogue"], fb:CAR_PHOTOS["_fallback"] },
    { type:"Midsize",     ex:"Toyota Camry", price:41,  img:CAR_PHOTOS["Toyota Camry"], fb:CAR_PHOTOS["_fallback"] },
    { type:"Luxury",      ex:"BMW 5 Series", price:115, img:CAR_PHOTOS["BMW 5 Series"], fb:CAR_PHOTOS["_fallback"] },
  ];
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {[{name:"Costco Travel",url:"https://www.costcotravel.com/Rental-Cars",badge:"Save up to 25%"},{name:"Kayak",url:AFF.kayakCars(form.destination)},{name:"RentalCars",url:"https://www.rentalcars.com"},{name:"Expedia Cars",url:"https://www.expedia.com/Cars"}].map(s=>(
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
            style={{padding:"10px 16px",background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:10,color:c.text,textDecoration:"none",fontSize:13,display:"flex",flexDirection:"column",gap:3,fontFamily:fontBody}}>
            <span style={{fontWeight:700}}>{s.name}</span>
            {s.badge&&<span style={{color:c.success,fontSize:11,fontWeight:600}}>{s.badge}</span>}
          </a>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:16}}>
        {cars.map((car,i)=>(
          <div key={i} style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:18,overflow:"hidden"}}>
            <div style={{height:168,position:"relative",overflow:"hidden"}}>
              <Img src={car.img} fallbackSrc={car.fb} alt={car.ex} iconName="car"/>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,transparent 50%)"}}/>
              <div style={{position:"absolute",top:14,left:14}}>
                <span style={{background:"rgba(0,0,0,0.65)",color:"#fff",fontSize:11,fontWeight:800,padding:"5px 12px",borderRadius:20,backdropFilter:"blur(6px)",letterSpacing:"0.05em"}}>{car.type.toUpperCase()}</span>
              </div>
            </div>
            <div style={{padding:18}}>
              <div style={{color:c.text,fontWeight:700,fontSize:16}}>{car.ex}</div>
              <div style={{color:c.textMuted,fontSize:13,margin:"4px 0 14px"}}>or similar</div>
              <div style={{color:c.accent,fontWeight:900,fontSize:22,marginBottom:14}}>from ${car.price}<span style={{color:c.textMuted,fontSize:12,fontWeight:500}}>/day</span></div>
              <a href={AFF.kayakCars(form.destination)} target="_blank" rel="noopener noreferrer"
                style={{display:"block",textAlign:"center",padding:"11px",background:`linear-gradient(135deg,${c.accent},${c.accentHi})`,borderRadius:10,color:"#fff",textDecoration:"none",fontSize:14,fontWeight:800}}>
                Compare rates →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Weather Tab ──────────────────────────────────────────────────────────────
function WeatherTab({ form }) {
  const { c } = useTokens();
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetch_() {
    if (!form.destination) return;
    setLoading(true);
    try {
      const geo=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(form.destination)}&count=1`).then(r=>r.json());
      if (!geo.results?.length){setWx({error:"We couldn't find weather data for that destination. Please check the spelling and try again."});setLoading(false);return;}
      const {latitude,longitude,name,country}=geo.results[0];
      const df=form.dateFrom||new Date().toISOString().split("T")[0];
      const dt=form.dateTo||new Date(Date.now()+14*864e5).toISOString().split("T")[0];
      const w=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&start_date=${df}&end_date=${dt}`).then(r=>r.json());
      setWx({name,country,daily:w.daily});
    } catch(e){setWx({error:'unavailable'});}
    setLoading(false);
  }

  useEffect(()=>{if(form.destination)fetch_();},[form.destination]);

  const wi=(code)=>code===0?"☀️":code<=3?"🌤️":code<=48?"☁️":code<=67?"🌧️":"⛈️";

  if (!form.destination) return <div style={{textAlign:"center",padding:"72px 20px"}}><div style={{fontSize:64,marginBottom:16}}>🌤️</div><p style={{color:c.textMuted,fontSize:15}}>Enter a destination to see the forecast</p></div>;
  if (loading) return <div style={{display:"flex",flexDirection:"column",gap:10}}>{[...Array(7)].map((_,i)=><Skeleton key={i} h="60px" r="12px"/>)}</div>;
  if (wx?.error) return (
    <div style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:20,padding:"40px 24px",textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:14}}>🌤️</div>
      <div style={{color:c.text,fontWeight:700,fontSize:18,marginBottom:8}}>Weather data temporarily unavailable</div>
      <p style={{color:c.textMuted,fontSize:14,lineHeight:1.6,maxWidth:380,margin:"0 auto 20px"}}>We couldn't retrieve the forecast for this destination right now. Please check the destination name and try again.</p>
      <Btn onClick={fetch_} variant="ghost" style={{fontSize:13}}>Try again</Btn>
    </div>
  );
  if (!wx) return null;

  return (
    <div>
      <h2 style={{color:c.text,fontSize:22,fontWeight:800,margin:"0 0 20px",letterSpacing:"-0.03em"}}>{wx.name}, {wx.country}</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:12}}>
        {wx.daily?.time?.map((date,i)=>(
          <div key={date} style={{background:c.surface,border:`1.5px solid ${c.border}`,borderRadius:14,padding:"14px 10px",textAlign:"center"}}>
            <div style={{color:c.textMuted,fontSize:11,fontWeight:600,marginBottom:6}}>{new Date(date+"T12:00:00").toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})}</div>
            <div style={{fontSize:28,margin:"8px 0"}}>{wi(wx.daily.weathercode[i])}</div>
            <div style={{color:c.text,fontWeight:800,fontSize:16}}>{Math.round(wx.daily.temperature_2m_max[i])}°</div>
            <div style={{color:c.textMuted,fontSize:13}}>{Math.round(wx.daily.temperature_2m_min[i])}°</div>
            {wx.daily.precipitation_sum[i]>0&&<div style={{color:c.info,fontSize:11,marginTop:4,fontWeight:600}}>{wx.daily.precipitation_sum[i]}mm</div>}
          </div>
        ))}
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
  const ds = {currency:"USD",units:"Fahrenheit",refundableOnly:false,directOnly:false,...settings};

  function saveSettings(s){localStorage.setItem("tf_settings",JSON.stringify(s));setSettings(s);}

  async function handleSearch(formData) {
    setForm(formData); setLoading(true); setTab("itinerary"); setTripData(null);
    try {
      const nights = formData.dateFrom&&formData.dateTo
        ? Math.max(1,Math.round((new Date(formData.dateTo)-new Date(formData.dateFrom))/864e5)) : 5;

      const dateContext = formData.dateFrom
        ? `Travel dates: ${formData.dateFrom} to ${formData.dateTo||"open-ended"}. CRITICAL: only suggest attractions, restaurants, and activities that are confirmed open/operating during these specific dates. Mention any seasonal events or weather considerations for that period.`
        : "Dates flexible — plan for a typical season.";

      const dest = formData.surpriseMode
        ? `Best ${formData.style} destination within $${formData.budget} from ${formData.from||"the US"} for ${formData.travelers} travelers`
        : formData.multiCity
          ? `multi-city: ${formData.destinations?.map(d=>d.city).filter(Boolean).join(" → ")}`
          : formData.destination;

      const system = `You are an expert travel planner. RULES:
1. All activities, restaurants, and attractions MUST be real places in ${dest} accessible during the given dates.
2. Use real names — no generic placeholders.
3. Budget accurately for ${formData.travelers} traveler(s).
4. Keep descriptions SHORT — max 15 words each. Keep notes null unless essential.
5. Return ONLY valid JSON. No markdown. No commentary. No trailing commas.
{"destination":"string","summary":"1 sentence overview + 1 sentence seasonal note","budgetBreakdown":{"flights":"~$XXX","hotels":"~$XXX/night","food":"~$XX/day","activities":"~$XXX total"},"days":[{"title":"string","theme":"string","activities":[{"time":"string","name":"string","description":"string max 15 words","cost":"string or null"}],"notes":null}],"tips":["string","string","string"]}`;

      const raw = await askClaude(system,
        `Plan ${nights}-night ${formData.style} trip to ${dest}. ${formData.travelers} traveler(s). $${formData.budget} total budget. ${dateContext} Origin: ${formData.from||"unspecified"}.`,
        apiKey
      );
      setTripData(parseJSON(raw));
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
        input[type=date]::-webkit-calendar-picker-indicator{filter:${dark?"invert(0.6)":"none"};opacity:0.6;cursor:pointer;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:${c.accentBorder};border-radius:4px;}
        select option{background:${c.bg2};color:${c.text};}
        button,a{-webkit-tap-highlight-color:transparent;}
        @media print{
          .no-print,header,footer{display:none!important;}
          body{background:white!important;}
        }
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
            <button onClick={toggleTheme} style={{background:"none",border:`1.5px solid ${c.border}`,borderRadius:10,padding:"7px 12px",color:c.textMuted,cursor:"pointer",display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,fontFamily:fontBody}}>
              <Icon name={dark?"sun":"moon"} size={15} color={c.textMuted}/>
            </button>
            <button onClick={()=>setShowSettings(!showSettings)} style={{background:"none",border:"none",color:c.textMuted,cursor:"pointer",padding:"8px",borderRadius:10}}>
              <Icon name="settings" size={20} color={c.textMuted}/>
            </button>
          </div>
        </header>

        {/* Top ad */}
        <div style={{maxWidth:1160,margin:"0 auto",padding:"10px 20px 0"}}>
          <AdSlot style={{margin:0}}/>
        </div>

        {/* Main */}
        <main style={{maxWidth:1160,margin:"0 auto",padding:"24px 20px 48px",animation:"fadeUp 0.4s ease"}}>
          <HeroSearch onSearch={handleSearch} loading={loading}/>

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
          {tab==="flights"     && <FlightsTab     form={form} settings={ds}/>}
          {tab==="hotels"      && <HotelsTab      form={form} settings={ds}/>}
          {tab==="cars"        && <CarsTab        form={form}/>}
          {tab==="weather"     && <WeatherTab     form={form}/>}
        </main>

        <footer style={{borderTop:`1px solid ${c.border}`,padding:"18px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,maxWidth:1160,margin:"0 auto"}}>
          <span style={{color:c.textSubtle,fontSize:12,fontWeight:600}}>© 2026 TripForge</span>
          <span style={{color:c.textSubtle,fontSize:11}}>Sample prices — confirm on provider sites. Some links are affiliate links.</span>
        </footer>

        {showSettings&&<SettingsPanel settings={ds} onChange={saveSettings} onClose={()=>setShowSettings(false)}/>}
      </div>
    </>
  );
}
