#!/usr/bin/env node
/**
 * Faresparks Sitemap Generator
 *
 * Scans public/seo/ for all generated HTML pages and builds:
 *   public/sitemap.xml  — full sitemap for Google Search Console
 *   public/robots.txt   — points bots to the sitemap
 *
 * Usage:
 *   node scripts/generate-sitemap.js
 *
 * Run this after generate-seo-pages.js, or add to your build/deploy pipeline.
 */

const fs   = require("fs");
const path = require("path");

const SITE_URL  = "https://Faresparks.com";
const SEO_DIR   = path.join(__dirname, "..", "public", "seo");
const OUT_XML   = path.join(__dirname, "..", "public", "sitemap.xml");
const OUT_ROBOT = path.join(__dirname, "..", "public", "robots.txt");
const TODAY     = new Date().toISOString().split("T")[0];

// ── Collect all static SEO pages ─────────────────────────────────────────────
function collectPages() {
  const pages = [];

  if (!fs.existsSync(SEO_DIR)) {
    console.log("public/seo/ not found — no static pages generated yet.");
    return pages;
  }

  // Walk: public/seo/[dest-slug]/[page-slug]/index.html
  for (const destSlug of fs.readdirSync(SEO_DIR)) {
    const destDir = path.join(SEO_DIR, destSlug);
    if (!fs.statSync(destDir).isDirectory()) continue;

    for (const pageSlug of fs.readdirSync(destDir)) {
      const pageDir  = path.join(destDir, pageSlug);
      const htmlFile = path.join(pageDir, "index.html");
      if (!fs.existsSync(htmlFile)) continue;

      const stat = fs.statSync(htmlFile);
      const lastmod = stat.mtime.toISOString().split("T")[0];

      // Determine priority and change frequency by page type
      let priority = "0.7";
      let changefreq = "monthly";
      if (pageSlug.includes("itinerary-7d")) { priority = "0.9"; changefreq = "monthly"; }
      else if (pageSlug.includes("itinerary-3d")) { priority = "0.85"; changefreq = "monthly"; }
      else if (pageSlug === "guide") { priority = "0.8"; changefreq = "monthly"; }
      else if (pageSlug === "budget") { priority = "0.75"; changefreq = "monthly"; }

      pages.push({
        url: `${SITE_URL}/seo/${destSlug}/${pageSlug}/`,
        lastmod,
        changefreq,
        priority,
      });
    }
  }

  return pages;
}

// ── Core app URLs ─────────────────────────────────────────────────────────────
function coreUrls() {
  return [
    { url: SITE_URL + "/",          lastmod: TODAY, changefreq: "weekly",  priority: "1.0" },
  ];
}

// ── Build sitemap XML ─────────────────────────────────────────────────────────
function buildSitemap(urls) {
  const entries = urls.map(u => `  <url>
    <loc>${escapeXml(u.url)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
    http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${entries}
</urlset>`;
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Build robots.txt ──────────────────────────────────────────────────────────
function buildRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml

# Block API routes from crawlers
Disallow: /api/
`;
}

// ── Run ───────────────────────────────────────────────────────────────────────
function run() {
  const staticPages = collectPages();
  const allUrls     = [...coreUrls(), ...staticPages];

  // Write sitemap.xml
  fs.writeFileSync(OUT_XML, buildSitemap(allUrls), "utf8");
  console.log(`sitemap.xml written: ${allUrls.length} URLs`);

  // Write robots.txt (only if it doesn't already exist or is the default Vite one)
  const existingRobots = fs.existsSync(OUT_ROBOT)
    ? fs.readFileSync(OUT_ROBOT, "utf8") : "";
  if (!existingRobots.includes("Sitemap:")) {
    fs.writeFileSync(OUT_ROBOT, buildRobots(), "utf8");
    console.log("robots.txt written");
  } else {
    console.log("robots.txt already has Sitemap: directive — skipping");
  }

  // Summary by destination
  const bySite = {};
  for (const p of staticPages) {
    const parts = p.url.replace(SITE_URL + "/seo/", "").split("/");
    const dest  = parts[0];
    bySite[dest] = (bySite[dest] || 0) + 1;
  }

  const destCount = Object.keys(bySite).length;
  console.log(`\nIndexed ${staticPages.length} SEO pages across ${destCount} destinations`);

  if (staticPages.length > 0) {
    console.log("\nTop destinations:");
    Object.entries(bySite).slice(0, 5).forEach(([d, n]) => console.log(`  ${d}: ${n} page(s)`));
    if (destCount > 5) console.log(`  ... and ${destCount - 5} more`);
  } else {
    console.log("\nNo static pages found yet. Run: node scripts/generate-seo-pages.js");
  }

  console.log(`\nSubmit your sitemap at: https://search.google.com/search-console`);
  console.log(`Sitemap URL to submit:  ${SITE_URL}/sitemap.xml`);
}

run();
