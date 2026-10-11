// Deterministic plan of which listings exist: same input -> same 500 slots, so the image harvester and the
// seeder agree on slot ids without sharing state.
const places = require("./places");

const TOTAL = Number(process.env.SEED_TOTAL) || 500;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const rngFor = (id) => mulberry32(hash(id));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const LEVELS = ["budget", "comfort", "premium", "luxury"];
const LEVEL_WEIGHTS = {
  rooms: [0.35, 0.45, 0.15, 0.05],
  farmhouses: [0.2, 0.45, 0.25, 0.1],
  mountains: [0.2, 0.4, 0.3, 0.1],
  beaches: [0.2, 0.35, 0.3, 0.15],
  pools: [0.05, 0.3, 0.4, 0.25],
  trending: [0.1, 0.4, 0.35, 0.15],
  mansion: [0, 0.15, 0.4, 0.45],
  castles: [0, 0.1, 0.35, 0.55],
};

function pickWeighted(rng, items, weights) {
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) if ((r -= weights[i]) < 0) return items[i];
  return items[items.length - 1];
}

// Largest-remainder allocation so the counts add up to exactly TOTAL.
function allocate() {
  const sum = places.reduce((a, p) => a + p.w, 0);
  const raw = places.map((p) => (p.w / sum) * TOTAL);
  const counts = raw.map(Math.floor);
  let left = TOTAL - counts.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => [r - Math.floor(r), i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, left)
    .forEach(([, i]) => counts[i]++);
  return counts;
}

function buildPlan() {
  const counts = allocate();
  const slots = [];
  places.forEach((place, pi) => {
    const rng = mulberry32(hash(place.name) + 17);
    const n = counts[pi];
    // cycle through the place's categories first so each shows up, then sample freely
    const cats = [];
    for (let i = 0; i < n; i++) cats.push(i < place.cats.length ? place.cats[i] : place.cats[Math.floor(rng() * place.cats.length)]);
    const seen = {};
    cats.forEach((category) => {
      const idx = (seen[category] = (seen[category] || 0) + 1);
      const id = `${slug(place.name)}:${category}:${idx}`;
      const level = pickWeighted(rngFor(id + ":level"), LEVELS, LEVEL_WEIGHTS[category]);
      slots.push({ id, place, category, level });
    });
  });
  return slots;
}

module.exports = { buildPlan, rngFor, LEVELS, TOTAL };
