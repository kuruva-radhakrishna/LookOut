// One-off harvester: assigns every seed listing a unique, location-relevant, verified-reachable photo from
// Wikimedia Commons (official API, free licences) and writes scripts/seed-images.json with attribution.
//   node scripts/build-images.js
// Re-running is cheap: search results are cached in scripts/.cache/. Delete seed-images.json to reassign.
const fs = require("fs");
const path = require("path");
const { buildPlan } = require("./lib/plan");
const places = require("./lib/places");

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "LookOutSeed/1.0 (https://github.com/kuruva-radhakrishna/LookOut; demo data builder)";
const CACHE_DIR = path.join(__dirname, ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "commons-queries.json");
const OUT = path.join(__dirname, "seed-images.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {};
fs.mkdirSync(CACHE_DIR, { recursive: true });
const saveCache = () => fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));

// What to search for, per category. {n} = place name. Earlier entries are tried first.
const QUERIES = {
  beaches: ["{n} beach", "{n} beach resort"],
  mountains: ["{n} hill station", "{n} cottage", "{n} valley", "{n} resort"],
  castles: ["{n} palace", "{n} fort", "{n} haveli", "{n} heritage hotel"],
  pools: ["{n} resort swimming pool", "{n} hotel pool", "{n} resort"],
  mansion: ["{n} heritage hotel", "{n} villa", "{n} bungalow", "{n} hotel"],
  rooms: ["{n} hotel room", "{n} homestay", "{n} guest house", "{n} hotel"],
  farmhouses: ["{n} farm", "{n} plantation", "{n} village house", "{n} homestay"],
  trending: ["{n} resort", "{n} hotel", "{n} lake", "{n} view"],
};
const EXTRA_BAD =
  /\b(night|skyline|cityscape|old|vintage|historic|archive|postcard|ruins?|lithograph|book|journal|observations|account|museum|exhibit|sculpture|inscription|carvings?|idol|shrine|temple|pillar|crowd|tourists?|visitors?|queue|panoramio|from my)\b/i;
const BAD_TITLE =
  /\b(map|logo|flag|poster|diagram|stamp|coat of arms|seal|portrait|train|railway|station|bus|airport|road|traffic|market|protest|election|rally|statue|church|mosque|cemetery|tomb|hospital|college|school|university|accident|flood|cyclone|damage|tsunami|dam|factory|cow|cattle|dog|bird|butterfly|flower|food|dish|thali|people|festival|procession|wedding|dance|race|ship|vessel|truck|crowd|man|woman|girl|boy|children|monk|priest|sadhu|minister|chief|inauguration|signboard|sign|banner|screenshot|scan|drawing|painting|sketch|engraving|lithograph|illustration|aerial|satellite)\b/i;

async function api(params, attempt = 0) {
  let res;
  try {
    res = await fetch(`${API}?${new URLSearchParams({ format: "json", ...params })}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
  } catch (err) {
    if (attempt > 5) throw err;
    await sleep(1500 * 2 ** attempt); // connection reset / timeout: back off and retry
    return api(params, attempt + 1);
  }
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 5) throw new Error(`Commons API ${res.status}`);
    await sleep(1500 * 2 ** attempt);
    return api(params, attempt + 1);
  }
  return res.json();
}

async function search(q) {
  if (cache[q]) return cache[q];
  await sleep(150);
  const j = await api({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${q} filetype:bitmap`,
    gsrlimit: "40",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "960",
    iiextmetadatafilter: "LicenseShortName|Artist",
  });
  const out = Object.values(j.query?.pages || {})
    .sort((a, b) => a.index - b.index)
    .map((p) => ({ p, i: p.imageinfo?.[0] }))
    .filter(({ p, i }) => i && i.mime === "image/jpeg" && i.width >= 1000 && i.height >= 600 && i.width / i.height >= 1.2 && i.width / i.height <= 2.1 && !BAD_TITLE.test(p.title))
    .map(({ p, i }) => ({
      title: p.title,
      url: i.thumburl,
      source: i.descriptionurl,
      license: i.extmetadata?.LicenseShortName?.value || "See source",
      credit: (i.extmetadata?.Artist?.value || "Wikimedia Commons contributor").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 120),
    }));
  cache[q] = out;
  saveCache();
  return out;
}

async function reachable(url) {
  for (let t = 0; t < 2; t++) {
    try {
      const r = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
      if (r.ok && (r.headers.get("content-type") || "").startsWith("image/")) return true;
      if (r.status === 429) await sleep(3000);
    } catch {
      /* retry once */
    }
    await sleep(500);
  }
  return false;
}

(async () => {
  const slots = buildPlan();
  const used = new Set();
  const bad = new Set();
  const result = {};
  const stats = { place: 0, state: 0, samePlaceOtherCategory: 0, stateOtherCategory: 0 };
  const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const tokensOf = (p) => [...p.q, ...p.near].map(norm);
  const siblings = (p) => places.filter((x) => x.state === p.state);

  // candidate must be a reachable photo whose file name names the place (or a landmark / sibling place)
  async function find(queries, tokens) {
    for (const q of queries) {
      for (const c of await search(q)) {
        if (used.has(c.title) || bad.has(c.title) || EXTRA_BAD.test(c.title)) continue;
        if (!tokens.some((t) => norm(c.title).includes(t))) continue;
        if (await reachable(c.url)) return c;
        bad.add(c.title);
      }
    }
    return null;
  }
  const queriesFor = (cat, names) => names.flatMap((nm) => QUERIES[cat].map((t) => t.replace("{n}", nm)));

  for (const [n, slot] of slots.entries()) {
    const { place, category } = slot;
    const sib = siblings(place);
    const allCats = Object.keys(QUERIES);
    const attempts = [
      ["place", () => find(queriesFor(category, place.q), tokensOf(place))],
      ["state", () => find(sib.flatMap((p) => queriesFor(category, p.q)), sib.flatMap(tokensOf))],
      ["samePlaceOtherCategory", () => find(allCats.flatMap((c) => queriesFor(c, place.q)), tokensOf(place))],
      ["stateOtherCategory", () => find(sib.flatMap((p) => allCats.flatMap((c) => queriesFor(c, p.q))), sib.flatMap(tokensOf))],
    ];
    let chosen = null;
    for (const [how, run] of attempts) {
      if ((chosen = await run())) {
        stats[how]++;
        break;
      }
    }
    if (!chosen) throw new Error(`No photo found for ${slot.id}`);
    used.add(chosen.title);
    result[slot.id] = { url: chosen.url, filename: chosen.title, credit: chosen.credit, license: chosen.license, source: chosen.source };
    if ((n + 1) % 25 === 0) console.log(`${n + 1}/${slots.length}  ${JSON.stringify(stats)}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log(`Wrote ${Object.keys(result).length} images to ${path.relative(process.cwd(), OUT)} ${JSON.stringify(stats)}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
