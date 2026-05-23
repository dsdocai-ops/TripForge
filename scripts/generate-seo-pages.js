#!/usr/bin/env node
/**
 * Faresparks SEO Page Generator
 *
 * Generates static HTML landing pages for top travel destinations.
 * Pages are saved to public/seo/[slug]/ and served by Vercel's CDN
 * at no runtime cost. Each page links back to the Faresparks app.
 *
 * Usage:
 *   node scripts/generate-seo-pages.js              # all destinations
 *   node scripts/generate-seo-pages.js paris        # single destination
 *   node scripts/generate-seo-pages.js --limit 10   # first 10 only
 *
 * Requires: ANTHROPIC_API_KEY in environment (or .env file)
 */

const fs   = require("fs");
const path = require("path");
const https = require("https");

// ── Load .env manually (no dotenv dependency needed) ─────────────────────────
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const [k, ...v] = line.split("=");
    if (k && v.length && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY not set. Add it to .env or export it.");
  process.exit(1);
}

// ── Destinations list ─────────────────────────────────────────────────────────
// Add more destinations here — each generates one landing page.
const DESTINATIONS = [
  // Europe
  { name: "Paris", country: "France", region: "Europe", emoji: "🗼" },
  { name: "Barcelona", country: "Spain", region: "Europe", emoji: "🏖️" },
  { name: "Rome", country: "Italy", region: "Europe", emoji: "🏛️" },
  { name: "Amsterdam", country: "Netherlands", region: "Europe", emoji: "🚲" },
  { name: "Lisbon", country: "Portugal", region: "Europe", emoji: "🌊" },
  { name: "Prague", country: "Czech Republic", region: "Europe", emoji: "🏰" },
  { name: "Vienna", country: "Austria", region: "Europe", emoji: "🎶" },
  { name: "Santorini", country: "Greece", region: "Europe", emoji: "🌅" },
  { name: "Dubrovnik", country: "Croatia", region: "Europe", emoji: "⚓" },
  { name: "Edinburgh", country: "Scotland", region: "Europe", emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Budapest", country: "Hungary", region: "Europe", emoji: "🛁" },
  { name: "Bruges", country: "Belgium", region: "Europe", emoji: "🍺" },
  { name: "Amalfi Coast", country: "Italy", region: "Europe", emoji: "🌿" },
  { name: "Reykjavik", country: "Iceland", region: "Europe", emoji: "🌋" },
  { name: "Zurich", country: "Switzerland", region: "Europe", emoji: "🏔️" },
  // Asia
  { name: "Tokyo", country: "Japan", region: "Asia", emoji: "🗾" },
  { name: "Bali", country: "Indonesia", region: "Asia", emoji: "🌺" },
  { name: "Bangkok", country: "Thailand", region: "Asia", emoji: "🛕" },
  { name: "Singapore", country: "Singapore", region: "Asia", emoji: "🦁" },
  { name: "Kyoto", country: "Japan", region: "Asia", emoji: "⛩️" },
  { name: "Seoul", country: "South Korea", region: "Asia", emoji: "🏙️" },
  { name: "Hong Kong", country: "China", region: "Asia", emoji: "🌃" },
  { name: "Phuket", country: "Thailand", region: "Asia", emoji: "🏝️" },
  { name: "Maldives", country: "Maldives", region: "Asia", emoji: "🐠" },
  { name: "Chiang Mai", country: "Thailand", region: "Asia", emoji: "🐘" },
  // Americas
  { name: "New York", country: "USA", region: "Americas", emoji: "🗽" },
  { name: "Cancun", country: "Mexico", region: "Americas", emoji: "🌮" },
  { name: "Buenos Aires", country: "Argentina", region: "Americas", emoji: "💃" },
  { name: "Machu Picchu", country: "Peru", region: "Americas", emoji: "🦙" },
  { name: "Rio de Janeiro", country: "Brazil", region: "Americas", emoji: "🎭" },
  { name: "Havana", country: "Cuba", region: "Americas", emoji: "🎺" },
  { name: "Mexico City", country: "Mexico", region: "Americas", emoji: "🌮" },
  { name: "Cartagena", country: "Colombia", region: "Americas", emoji: "🌺" },
  { name: "Costa Rica", country: "Costa Rica", region: "Americas", emoji: "🐸" },
  { name: "Patagonia", country: "Argentina/Chile", region: "Americas", emoji: "🏔️" },
  // Middle East & Africa
  { name: "Dubai", country: "UAE", region: "Middle East", emoji: "🏙️" },
  { name: "Marrakech", country: "Morocco", region: "Africa", emoji: "🕌" },
  { name: "Cape Town", country: "South Africa", region: "Africa", emoji: "🦓" },
  { name: "Zanzibar", country: "Tanzania", region: "Africa", emoji: "🏖️" },
  { name: "Istanbul", country: "Turkey", region: "Middle East", emoji: "🕌" },
  // Oceania
  { name: "Sydney", country: "Australia", region: "Oceania", emoji: "🦘" },
  { name: "Queenstown", country: "New Zealand", region: "Oceania", emoji: "🎿" },
  { name: "Fiji", country: "Fiji", region: "Oceania", emoji: "🌊" },
];

// ── Template types to generate per destination ────────────────────────────────
const TEMPLATES = [
  { type: "itinerary", days: 7, label: "7-Day Itinerary" },
  { type: "itinerary", days: 3, label: "3-Day Itinerary" },
  { type: "guide",     days: null, label: "Travel Guide" },
  { type: "budget",    days: null, label: "Budget Travel Guide" },
];

// ── Slugify ───────────────────────────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Claude Haiku API call ─────────────────────────────────────────────────────
function callClaude(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
    }, res => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.content?.[0]?.text || "");
        } catch (e) { reject(e); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Content generation prompts ────────────────────────────────────────────────
function buildPrompt(dest, template) {
  const { name, country, emoji } = dest;

  if (template.type === "itinerary") {
    return {
      system: `You are an expert travel writer creating SEO-optimized destination guides.
Write in second person ("you"), friendly and knowledgeable tone.
Return ONLY the HTML body content (no <html>/<head>/<body> tags).
Use semantic HTML: <h2>, <h3>, <p>, <ul>, <li>, <table>, <strong>.
Include real places, real neighborhoods, real restaurants.
Do not hallucinate — use ranges for prices, not exact figures.`,
      user: `Write a complete ${template.days}-day ${name}, ${country} itinerary guide.

Structure:
1. Opening paragraph (2-3 sentences, include target keyword "${template.days}-day ${name} itinerary")
2. Quick Facts box (HTML table): Best time to visit | Currency | Language | Budget/day | Visa needed for US citizens
3. Day-by-day breakdown (H2 for each day, H3 for Morning/Afternoon/Evening, real places with brief descriptions)
4. Where to Stay (H2): Budget / Mid-range / Luxury hotel recommendations with price ranges
5. Getting There (H2): Flight tips, airport info, Skyscanner search tip
6. Getting Around (H2): Local transport options, car rental note
7. Budget Breakdown (H2): HTML table with Accommodation / Food / Transport / Activities / Total per day
8. Best Time to Visit (H2): Month by month, peak vs off-season
9. Travel Tips (H2): 5 bullet points of insider tips
10. FAQ (H2): 5 questions and answers about ${name}

Word count target: 1,800-2,200 words.`
    };
  }

  if (template.type === "budget") {
    return {
      system: `You are a budget travel expert writing SEO content.
Return ONLY HTML body content. Use real places, real prices (ranges), practical advice.`,
      user: `Write a complete budget travel guide for ${name}, ${country}.

Structure:
1. Intro: "Can you travel ${name} on a budget?" (2 paragraphs)
2. Average Daily Budget (HTML table): Shoestring / Budget / Mid-range tiers with $ amounts
3. Cheapest Ways to Get There (H2): Budget airlines, best booking windows, Skyscanner tip
4. Budget Accommodation Options (H2): Hostels, budget hotels, neighborhoods to stay
5. Free Things to Do in ${name} (H2): 8-10 genuinely free activities
6. Cheap Eats Guide (H2): Street food, local markets, budget restaurants
7. Money-Saving Tips (H2): 10 practical tips specific to ${name}
8. Sample Budget Itinerary (H2): 5 days for $X total
9. Cheapest Time to Visit ${name} (H2): Off-season guide
10. FAQ (H2): 5 budget-specific questions

Word count: 1,500-2,000 words.`
    };
  }

  // general guide
  return {
    system: `You are an expert travel writer. Return ONLY HTML body content. Real places only.`,
    user: `Write a comprehensive ${name}, ${country} travel guide.

Structure:
1. Introduction (3 paragraphs covering why visit ${name})
2. Top 10 Things to Do (H2): Numbered list with descriptions
3. Best Neighborhoods to Stay (H2): 4-5 neighborhoods with character and hotel price range
4. Where to Eat in ${name} (H2): Breakfast / lunch / dinner picks across budget levels
5. Day Trips from ${name} (H2): 3-4 nearby destinations worth visiting
6. Practical Information (H2): Visa, currency, language, tipping, safety
7. Getting Around ${name} (H2): Metro, taxis, apps, walking
8. Best Time to Visit (H2): Season breakdown
9. ${name} Itinerary Ideas (H2): Links to 3-day and 7-day itinerary guides
10. FAQ: 5 common questions

Word count: 2,000-2,500 words.`
  };
}

// ── HTML page template ────────────────────────────────────────────────────────
function buildHtmlPage(dest, template, content) {
  const { name, country, emoji } = dest;
  const slug = slugify(name);
  const titleMap = {
    itinerary: `${template.days}-Day ${name} Itinerary (${new Date().getFullYear()} Guide)`,
    budget: `Budget Travel in ${name}: Complete Cost Guide`,
    guide: `${name} Travel Guide: Everything You Need to Know`,
  };
  const descMap = {
    itinerary: `Plan your perfect ${template.days}-day ${name} trip. Day-by-day itinerary, best hotels, budget breakdown, local tips, and restaurant recommendations for ${name}, ${country}.`,
    budget: `How to travel ${name} on a budget. Average daily costs, free things to do, cheap eats, budget hotels, and money-saving tips for ${name}, ${country}.`,
    guide: `The ultimate ${name} travel guide. Best things to do, where to stay, when to visit, and practical tips for your ${name}, ${country} trip.`,
  };
  const title = titleMap[template.type];
  const description = descMap[template.type];
  const canonical = `https://Faresparks.com/seo/${slug}/${template.type}${template.days ? `-${template.days}d` : ""}`;
  const appUrl = `https://Faresparks.com/?dest=${encodeURIComponent(name)}`;

  // Related pages for internal linking
  const related = TEMPLATES
    .filter(t => !(t.type === template.type && t.days === template.days))
    .map(t => ({
      url: `/seo/${slug}/${t.type}${t.days ? `-${t.days}d` : ""}`,
      label: `${name} ${t.label}`,
    }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="Faresparks" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />

  <!-- Schema.org Article -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${title}",
    "description": "${description}",
    "url": "${canonical}",
    "publisher": {
      "@type": "Organization",
      "name": "Faresparks",
      "url": "https://Faresparks.com"
    },
    "about": {
      "@type": "TouristDestination",
      "name": "${name}",
      "containedInPlace": {
        "@type": "Country",
        "name": "${country}"
      }
    },
    "datePublished": "${new Date().toISOString().split("T")[0]}",
    "dateModified": "${new Date().toISOString().split("T")[0]}"
  }
  </script>

  <!-- AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4981583463376168" crossorigin="anonymous"></script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "DM Sans", system-ui, sans-serif; background: #faf9f7; color: #1a1917; line-height: 1.7; }
    a { color: #e8520a; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .wrapper { max-width: 780px; margin: 0 auto; padding: 0 20px; }

    /* Header */
    header { background: #fff; border-bottom: 1px solid #e8e5e0; padding: 0 20px; height: 58px;
      display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
    .logo { font-weight: 800; font-size: 18px; color: #1a1917; letter-spacing: -0.04em; }
    .logo span { color: #e8520a; }
    .cta-btn { background: linear-gradient(135deg, #e8520a, #f97316); color: #fff;
      padding: 9px 20px; border-radius: 9px; font-weight: 700; font-size: 13px; white-space: nowrap; }
    .cta-btn:hover { text-decoration: none; opacity: 0.92; }

    /* Breadcrumb */
    .breadcrumb { font-size: 13px; color: #888; padding: 14px 0; }
    .breadcrumb a { color: #888; }

    /* Hero */
    .hero { background: linear-gradient(135deg, #e8520a, #f97316); color: #fff;
      border-radius: 18px; padding: 40px 36px; margin: 24px 0 32px; }
    .hero-emoji { font-size: 52px; margin-bottom: 12px; }
    .hero h1 { font-size: clamp(22px, 4vw, 32px); font-weight: 800; letter-spacing: -0.03em;
      line-height: 1.15; margin-bottom: 12px; }
    .hero p { font-size: 15px; opacity: 0.88; line-height: 1.65; margin-bottom: 20px; max-width: 560px; }
    .hero-cta { display: inline-flex; align-items: center; gap: 8px; background: #fff;
      color: #e8520a; padding: 13px 26px; border-radius: 11px; font-weight: 800; font-size: 15px; }
    .hero-cta:hover { text-decoration: none; opacity: 0.92; }

    /* Article content */
    .content { padding-bottom: 60px; }
    .content h2 { font-size: 22px; font-weight: 800; color: #1a1917; letter-spacing: -0.02em;
      margin: 36px 0 14px; padding-top: 8px; border-top: 2px solid #f0ede8; }
    .content h3 { font-size: 17px; font-weight: 700; color: #333; margin: 20px 0 8px; }
    .content p { margin-bottom: 16px; color: #3d3a35; }
    .content ul, .content ol { padding-left: 24px; margin-bottom: 16px; color: #3d3a35; }
    .content li { margin-bottom: 8px; }
    .content table { width: 100%; border-collapse: collapse; margin: 16px 0 24px; font-size: 14px; }
    .content th { background: #f5f3f0; padding: 10px 14px; text-align: left; font-weight: 700;
      border: 1px solid #e0ddd8; }
    .content td { padding: 10px 14px; border: 1px solid #e0ddd8; }
    .content tr:nth-child(even) td { background: #faf9f7; }
    .content strong { color: #1a1917; }

    /* Affiliate CTA boxes */
    .aff-box { background: #fff; border: 1.5px solid #e0ddd8; border-radius: 14px;
      padding: 20px 22px; margin: 24px 0; display: flex; align-items: center;
      justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .aff-box-text { font-size: 14px; color: #555; }
    .aff-box-text strong { display: block; color: #1a1917; font-size: 15px; margin-bottom: 4px; }
    .aff-btn { background: #e8520a; color: #fff; padding: 10px 20px; border-radius: 9px;
      font-weight: 700; font-size: 13px; white-space: nowrap; flex-shrink: 0; }
    .aff-btn:hover { text-decoration: none; opacity: 0.88; }

    /* Related links */
    .related { background: #f5f3f0; border-radius: 14px; padding: 24px; margin: 40px 0 20px; }
    .related h3 { font-size: 15px; font-weight: 800; margin-bottom: 14px; color: #1a1917; }
    .related-links { display: flex; flex-wrap: wrap; gap: 10px; }
    .related-link { background: #fff; border: 1.5px solid #e0ddd8; border-radius: 8px;
      padding: 8px 14px; font-size: 13px; font-weight: 600; color: #e8520a; }
    .related-link:hover { text-decoration: none; background: #fff5f0; }

    /* AI CTA */
    .ai-cta { background: linear-gradient(135deg, #e8520a, #f97316); border-radius: 18px;
      padding: 36px; text-align: center; margin: 40px 0; color: #fff; }
    .ai-cta h2 { font-size: 22px; font-weight: 800; margin-bottom: 10px; border: none; padding: 0; }
    .ai-cta p { opacity: 0.88; margin-bottom: 20px; font-size: 15px; }
    .ai-cta a { background: #fff; color: #e8520a; padding: 14px 30px; border-radius: 11px;
      font-weight: 800; font-size: 15px; display: inline-block; }
    .ai-cta a:hover { text-decoration: none; opacity: 0.92; }

    /* Footer */
    footer { border-top: 1px solid #e8e5e0; padding: 28px 20px; text-align: center;
      font-size: 13px; color: #999; }
    footer a { color: #999; margin: 0 10px; }

    @media (max-width: 600px) {
      .hero { padding: 28px 22px; }
      .content h2 { font-size: 19px; }
      .aff-box { flex-direction: column; }
    }
  </style>
</head>
<body>

<header>
  <a href="/" class="logo">Fare<span>Spark</span></a>
  <a href="${appUrl}" class="cta-btn">Plan This Trip Free →</a>
</header>

<main class="wrapper">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> › <a href="/seo/${slug}/">${name}</a> › ${template.label}
  </nav>

  <div class="hero">
    <div class="hero-emoji">${emoji}</div>
    <h1>${title}</h1>
    <p>Use our free AI travel planner to instantly generate a personalized ${name} itinerary — flights, hotels, restaurants, and daily plans in 30 seconds.</p>
    <a href="${appUrl}" class="hero-cta">✨ Generate My ${name} Itinerary Free →</a>
  </div>

  <!-- Top affiliate box: Flights -->
  <div class="aff-box">
    <div class="aff-box-text">
      <strong>Find the cheapest flights to ${name}</strong>
      Compare prices across 1,000+ airlines. Set price alerts so you never miss a deal.
    </div>
    <a href="https://www.skyscanner.com/transport/flights/anywhere/${slugify(name)}/?utm_source=YOURAFFID" class="aff-btn" rel="nofollow sponsored" target="_blank">Search Flights →</a>
  </div>

  <article class="content">
    ${content}
  </article>

  <!-- Mid-page affiliate boxes -->
  <div class="aff-box">
    <div class="aff-box-text">
      <strong>Best hotels in ${name}</strong>
      Compare prices on Booking.com — free cancellation on most rooms.
    </div>
    <a href="https://www.booking.com/searchresults.html?ss=${encodeURIComponent(name)}&aid=YOURAFFID" class="aff-btn" rel="nofollow sponsored" target="_blank">Find Hotels →</a>
  </div>

  <div class="aff-box">
    <div class="aff-box-text">
      <strong>Top-rated ${name} tours & activities</strong>
      Book skip-the-line tickets, private tours, and day trips.
    </div>
    <a href="https://www.viator.com/searchResults/all?text=${encodeURIComponent(name)}&pid=YOURAFFID" class="aff-btn" rel="nofollow sponsored" target="_blank">Browse Tours →</a>
  </div>

  <div class="aff-box">
    <div class="aff-box-text">
      <strong>Travel insurance for ${name}</strong>
      Protect your trip against cancellations, medical emergencies, and delays.
    </div>
    <a href="https://www.worldnomads.com/?utm_source=Faresparks" class="aff-btn" rel="nofollow sponsored" target="_blank">Get a Quote →</a>
  </div>

  <!-- Related pages: internal linking -->
  <div class="related">
    <h3>More ${name} Travel Guides</h3>
    <div class="related-links">
      ${related.map(r => `<a href="${r.url}" class="related-link">${r.label}</a>`).join("\n      ")}
      <a href="${appUrl}" class="related-link">Plan with AI ✨</a>
    </div>
  </div>

  <!-- Bottom AI CTA -->
  <div class="ai-cta">
    <h2>Want a personalized ${name} itinerary?</h2>
    <p>Our AI builds a complete day-by-day plan in 30 seconds — tailored to your budget, travel style, and dates. Free, no account required.</p>
    <a href="${appUrl}">Generate My ${name} Trip Free →</a>
  </div>
</main>

<footer>
  <div>
    <a href="/">Faresparks</a>
    <a href="/seo/${slug}/">${name} Guides</a>
    <a href="${appUrl}">Plan a Trip</a>
  </div>
  <div style="margin-top:10px">© ${new Date().getFullYear()} Faresparks · AI Travel Planner · Affiliate links help keep this site free.</div>
</footer>

</body>
</html>`;
}

// ── Main runner ───────────────────────────────────────────────────────────────
async function run() {
  const args = process.argv.slice(2);
  const limitFlag = args.indexOf("--limit");
  const limit = limitFlag !== -1 ? parseInt(args[limitFlag + 1], 10) : Infinity;
  const filterName = args.find(a => !a.startsWith("--") && isNaN(a));

  let destinations = filterName
    ? DESTINATIONS.filter(d => d.name.toLowerCase().includes(filterName.toLowerCase()))
    : DESTINATIONS;

  if (destinations.length === 0) {
    console.error(`No destination found matching "${filterName}"`);
    process.exit(1);
  }

  destinations = destinations.slice(0, limit);

  const outBase = path.join(__dirname, "..", "public", "seo");
  if (!fs.existsSync(outBase)) fs.mkdirSync(outBase, { recursive: true });

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const dest of destinations) {
    const slug = slugify(dest.name);
    for (const template of TEMPLATES) {
      const pageSlug = `${template.type}${template.days ? `-${template.days}d` : ""}`;
      const outDir  = path.join(outBase, slug, pageSlug);
      const outFile = path.join(outDir, "index.html");

      // Skip if already generated (re-run won't overwrite unless --force)
      if (fs.existsSync(outFile) && !args.includes("--force")) {
        skipped++;
        continue;
      }

      process.stdout.write(`Generating: ${dest.name} / ${template.label} ... `);
      try {
        const { system, user } = buildPrompt(dest, template);
        const content = await callClaude(system, user);

        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outFile, buildHtmlPage(dest, template, content), "utf8");
        console.log("done");
        generated++;

        // Small delay to stay within rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.log(`ERROR: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${errors} errors`);
  console.log(`Pages saved to: public/seo/`);
  console.log(`Run "node scripts/generate-sitemap.js" to update sitemap.xml`);
}

run().catch(err => { console.error(err); process.exit(1); });
