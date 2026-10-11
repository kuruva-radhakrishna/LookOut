// Turns a plan slot into a listing: title, description, price, capacity and coordinates, all derived from the
// place (price tier, landmarks, vibe), the category and the comfort level, so they agree with each other.
const { rngFor } = require("./plan");

const CAT_MULT = { rooms: 0.6, farmhouses: 0.95, mountains: 0.9, beaches: 1.0, trending: 1.1, pools: 1.45, mansion: 2.0, castles: 2.6 };
const LEVEL_MULT = { budget: 0.65, comfort: 1, premium: 1.5, luxury: 2.3 };
const GUESTS = { rooms: [2, 3], farmhouses: [6, 12], mountains: [3, 6], beaches: [2, 6], pools: [4, 8], trending: [2, 6], mansion: [8, 14], castles: [6, 12] };
const JITTER = { beaches: 0.015, castles: 0.02, rooms: 0.025, mansion: 0.03, pools: 0.03, trending: 0.03, mountains: 0.07, farmhouses: 0.08 };

const ADJ = {
  beaches: ["Sunset", "Coral", "Palm Grove", "Tideline", "Seashell", "Salt & Sand", "Golden Shore", "Blue Lagoon", "Breezy", "Driftwood", "Sandy Toes", "Monsoon Surf", "Casuarina", "Starfish", "Barefoot"],
  mountains: ["Cloud Nine", "Pine Ridge", "Misty Peak", "Snowline", "Highland", "Cedar Crest", "Summit", "Valley View", "Mountain Mist", "Alpine", "Frostwood", "Skyline", "Deodar", "Whispering Pines", "Hilltop"],
  castles: ["Royal", "Heritage", "Maharaja's", "Regal", "Imperial", "Rajwada", "Old Fort", "Sunehri", "Durbar", "Nawabi", "Sheesh", "Darbar", "Kila", "Moti", "Chandra"],
  pools: ["Azure", "Infinity", "Aqua Bliss", "Splash", "Lagoon", "Crystal Water", "Blue Horizon", "Oasis", "Plunge", "Serene Waters", "Turquoise", "Ripple", "Poolside", "Sapphire", "Cascade"],
  mansion: ["Grand", "Heritage", "Colonial", "Elite", "Opulent", "Signature", "Palatial", "Vintage", "Crown", "Regency", "Haveli", "Noble", "Legacy", "Ivory", "Evergreen"],
  rooms: ["Cosy", "Urban Nest", "Snug", "Quiet Corner", "Sunny", "Garden View", "Compact", "Homely", "Charming", "Bright", "Calm", "Little", "Wanderer's", "Courtyard", "Maple"],
  farmhouses: ["Green Acres", "Harvest", "Meadow", "Orchard", "Countryside", "Mango Grove", "Paddy Field", "Village", "Sunrise", "Banyan", "Plantation", "Tulsi", "Coconut Grove", "Haystack", "Peacock"],
  trending: ["Hidden Gem", "Local Favourite", "Insta-worthy", "Boutique", "Artisan", "Scenic", "Quirky", "Sunlit", "Rustic", "Soulful", "Designer", "Handpicked", "Serene", "Artful", "Stylish"],
};
const NOUN = {
  beaches: ["Beach House", "Shack", "Cottage", "Beach Villa", "Bungalow", "Cabana", "Seaside Retreat"],
  mountains: ["Cottage", "Lodge", "Chalet", "Cabin", "Mountain Retreat", "Homestay", "Villa"],
  castles: ["Palace", "Haveli", "Fort Stay", "Mahal", "Heritage Suite", "Darbar", "Royal Residence"],
  pools: ["Pool Villa", "Villa with Pool", "Resort Suite", "Private Pool Retreat", "Poolside Cottage", "Water Villa"],
  mansion: ["Mansion", "Bungalow", "Estate", "Manor", "Residence", "Heritage Home", "Grand Villa"],
  rooms: ["Room", "Studio", "Guest Room", "Suite", "Homestay Room", "Apartment", "Loft"],
  farmhouses: ["Farmstay", "Farmhouse", "Plantation Home", "Country Cottage", "Orchard Stay", "Farm Cottage"],
  trending: ["Stay", "Retreat", "Hideaway", "Villa", "Cottage", "Loft", "Escape"],
};

const OPENERS = {
  beaches: ["Wake up to the sound of waves along {vibe}.", "Just steps from the sand, in the heart of {vibe}.", "Salt air, long walks and slow sunsets: this is {vibe} at its best.", "A relaxed base on {vibe}, made for sandy feet and late breakfasts."],
  mountains: ["Set among the hills, with the quiet of {vibe} at your doorstep.", "Crisp mornings and wood-smoke evenings in {vibe}.", "A warm, wind-sheltered stay in {vibe}, with views that change by the hour.", "Escape the plains and settle into {vibe}."],
  castles: ["Live like royalty in a stay steeped in the history of {vibe}.", "Carved arches, painted walls and courtyards: a slice of {vibe}.", "A heritage property that carries the grandeur of {vibe}.", "Step into a restored piece of {vibe}, where every corridor has a story."],
  pools: ["Your own slice of water in {vibe}: swim, lounge, repeat.", "Designed around a sparkling pool, in the heart of {vibe}.", "Slow afternoons by the water in {vibe}.", "A pool-first getaway in {vibe}, perfect for long weekends."],
  mansion: ["A grand home with generous rooms and character, in {vibe}.", "Spacious, elegant and made for gatherings in {vibe}.", "An expansive residence that brings together comfort and old-world style in {vibe}.", "High ceilings, wide verandas and a calm address in {vibe}."],
  rooms: ["A comfortable, well-kept room in {vibe}.", "A clean, quiet base for exploring {vibe}.", "Simple and welcoming, right where you want to be in {vibe}.", "Everything you need for a short stay in {vibe}, nothing you don't."],
  farmhouses: ["Open fields, fresh produce and quiet nights near {vibe}.", "A working-farm feel with space to roam, close to {vibe}.", "Unplug on a green property in {vibe}.", "Farm-to-table meals and starry skies in {vibe}."],
  trending: ["A well-loved stay that guests keep coming back to in {vibe}.", "Thoughtfully designed and full of character, in {vibe}.", "One of the most-saved places in {vibe}, and easy to see why.", "A stylish, photogenic stay that captures {vibe}."],
};

const AMENITIES = {
  budget: ["simple, spotless rooms", "home-cooked breakfast", "fast Wi-Fi", "hot water round the clock", "friendly host on call", "free parking"],
  comfort: ["a comfortable king bed", "air conditioning", "breakfast included", "fast Wi-Fi", "a private balcony or sit-out", "a fully stocked kitchenette", "free parking"],
  premium: ["tasteful interiors", "a private garden or terrace", "in-house chef on request", "a welcome drink on arrival", "complimentary breakfast", "a curated local experience", "fast Wi-Fi"],
  luxury: ["a dedicated butler", "chef-curated dining", "a private plunge pool or spa", "airport or station pick-up", "bespoke interiors", "a guided heritage or nature walk", "evening cocktails on the terrace"],
};
const AUDIENCE = {
  beaches: ["friends and couples", "families", "a slow solo getaway"],
  mountains: ["couples and trekkers", "families", "remote workers"],
  castles: ["weddings and celebrations", "couples", "history lovers"],
  pools: ["groups of friends", "families", "birthday weekends"],
  mansion: ["large families", "group celebrations", "corporate retreats"],
  rooms: ["solo travellers", "couples", "business trips"],
  farmhouses: ["family reunions", "groups of friends", "digital detoxes"],
  trending: ["couples", "friends", "content creators"],
};
const LEVEL_LABEL = { budget: "budget-friendly", comfort: "comfortable", premium: "premium", luxury: "luxury" };

const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const sample = (rng, a, n) => {
  const c = [...a];
  const out = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(rng() * c.length), 1)[0]);
  return out;
};
const roundPrice = (v) => (v < 2000 ? Math.round(v / 50) * 50 : v < 10000 ? Math.round(v / 100) * 100 : v < 30000 ? Math.round(v / 500) * 500 : Math.round(v / 1000) * 1000);

function describe(slot, usedTitles) {
  const { id, place, category, level } = slot;
  const rng = rngFor(id);
  const short = place.name.split(",")[0];

  let title, tries = 0;
  do {
    const base = `${pick(rng, ADJ[category])} ${pick(rng, NOUN[category])}`;
    const r = rng();
    title = r < 0.4 ? `${base} in ${short}` : r < 0.75 ? `${base} near ${pick(rng, place.near)}` : `${base}, ${short}`;
    const words = base.toLowerCase().split(/\s+/);
    if (new Set(words).size !== words.length) title = ""; // e.g. "Darbar Darbar": adjective repeats the noun, re-roll
  } while ((!title || usedTitles.has(title)) && ++tries < 40);
  if (usedTitles.has(title)) title = `${title} ${tries}`; // practically never reached
  usedTitles.add(title);

  const cost = Math.min(80000, Math.max(700, roundPrice(place.base * CAT_MULT[category] * LEVEL_MULT[level] * (0.9 + rng() * 0.2))));
  const [gmin, gmax] = GUESTS[category];
  const maxGuests = Math.min(20, gmin + Math.floor(rng() * (gmax - gmin + 1)) + (level === "luxury" && gmax > 6 ? 1 : 0));

  const [n0, n1] = place.near;
  const description = [
    pick(rng, OPENERS[category]).replace("{vibe}", place.vibe),
    `This ${LEVEL_LABEL[level]} ${category === "trending" ? "stay" : category === "rooms" ? "room" : "property"} offers ${sample(rng, AMENITIES[level], 4).join(", ").replace(/, ([^,]*)$/, " and $1")}.`,
    `${n0} is about ${5 + Math.floor(rng() * 25)} minutes away, and ${n1} is a ${10 + Math.floor(rng() * 35)}-minute drive.`,
    `Sleeps up to ${maxGuests} guests, a good fit for ${pick(rng, AUDIENCE[category])}.`,
  ].join(" ");

  const j = JITTER[category];
  const lat = +(place.lat + (rng() - 0.5) * 2 * j).toFixed(5);
  const lng = +(place.lng + (rng() - 0.5) * 2 * j).toFixed(5);

  return { title, description, cost, place: place.name, country: "India", category, maxGuests, geometry: { type: "Point", coordinates: [lng, lat] } };
}

module.exports = { describe };
