// Creates ~120 demo guest users, then reviews written by those users, then refreshes each listing's rating.
// Safe to re-run: guests are matched by username, and only reviews written by seeded guests are replaced.
const bcrypt = require("bcryptjs");
const User = require("../../src/models/User");
const Listing = require("../../src/models/Listing");
const Review = require("../../src/models/Review");

const GUEST_COUNT = Number(process.env.SEED_GUESTS) || 120;
const GUEST_DOMAIN = "lookout.demo";

// small seeded PRNG so a re-run produces the same people and the same reviews
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
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const shuffle = (rng, a) => {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
};

const FIRST = ["Aarav", "Vivaan", "Aditya", "Arjun", "Rohan", "Karthik", "Siddharth", "Rahul", "Nikhil", "Varun", "Kabir", "Ishaan", "Manish", "Suresh", "Ramesh", "Anil", "Deepak", "Harsh", "Pranav", "Yash",
  "Priya", "Ananya", "Diya", "Isha", "Meera", "Kavya", "Sneha", "Pooja", "Neha", "Riya", "Aditi", "Shreya", "Divya", "Lakshmi", "Nandini", "Tanvi", "Swati", "Anjali", "Rhea", "Sana",
  "Imran", "Farhan", "Zoya", "Ayesha", "Gurpreet", "Harpreet", "Simran", "Jaspreet", "Joseph", "Maria", "Thomas", "Anita", "Ritu", "Vikram", "Tarun", "Mohit", "Ankit", "Kunal", "Sanjay", "Rajesh"];
const LAST = ["Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Shah", "Mehta", "Joshi", "Desai", "Reddy", "Naidu", "Iyer", "Nair", "Menon", "Pillai", "Rao", "Kulkarni", "Deshmukh", "Patil",
  "Chatterjee", "Banerjee", "Mukherjee", "Das", "Bose", "Ghosh", "Sen", "Khan", "Ansari", "Qureshi", "Kapoor", "Malhotra", "Khanna", "Bhatia", "Arora", "Chopra", "Thakur", "Yadav", "Mishra", "Pandey",
  "Fernandes", "D'Souza", "Thomas", "George", "Gill", "Sandhu", "Bhat", "Hegde", "Shetty", "Kamath"];

function buildGuests(rng) {
  const combos = shuffle(rng, FIRST.flatMap((f) => LAST.map((l) => [f, l])));
  const seen = new Set();
  const out = [];
  for (const [f, l] of combos) {
    const base = `${f}_${l}`.toLowerCase().replace(/[^a-z_]/g, "");
    if (seen.has(base)) continue;
    seen.add(base);
    out.push({ username: base, email: `${base.replace("_", ".")}@${GUEST_DOMAIN}`, display: `${f} ${l}` });
    if (out.length === GUEST_COUNT) break;
  }
  return out;
}

// ---------- review text ----------
const RATING_WEIGHTS = [0.02, 0.05, 0.13, 0.35, 0.45]; // 1..5 stars
const LEVEL_SHIFT = { budget: [0.02, 0.03, 0.05, 0, -0.1], comfort: [0, 0, 0, 0, 0], premium: [-0.01, -0.02, -0.03, 0.01, 0.05], luxury: [-0.01, -0.03, -0.06, -0.02, 0.12] };

const OPEN = {
  5: ["Absolutely loved it!", "One of the best stays we've had.", "Exceeded every expectation.", "Perfect from start to finish.", "Couldn't have asked for more.", "A real gem."],
  4: ["Really enjoyed our stay.", "A lovely place overall.", "Great stay, would come back.", "Very good experience.", "Pleasant stay with a few small niggles."],
  3: ["Decent stay, but not without issues.", "It was okay overall.", "Mixed feelings about this one.", "Fine for the price, nothing special."],
  2: ["Honestly a bit disappointing.", "Didn't quite match the photos.", "Expected more for what we paid."],
  1: ["Sadly a poor experience.", "Would not stay here again."],
};
const CATEGORY_LINES = {
  rooms: { pos: ["The room was spotless and the bed very comfortable.", "Quiet, well-kept and in a handy location.", "The AC worked well and the bathroom was clean.", "Great value for a room this tidy."], neg: ["The room was smaller than it looked in the pictures.", "Noise from the corridor kept us up a little.", "The bathroom needed better upkeep."] },
  beaches: { pos: ["Waking up so close to the beach was magical.", "We caught every sunset from the veranda.", "The sea breeze and the sound of the waves made it.", "Walking to the sand barefoot was the highlight."], neg: ["The beach access was a bit of a trek.", "It got noisy in the evenings from nearby shacks.", "Humidity made the room feel damp."] },
  mountains: { pos: ["The mountain views from the window were unreal.", "Cosy at night, with a lovely crisp morning air.", "Perfect base for treks and slow walks.", "Hot water and blankets were more than enough in the cold."], neg: ["The road up was rough and the signal patchy.", "It got really cold at night and the heating was weak.", "Water pressure was low in the mornings."] },
  castles: { pos: ["Staying in a piece of history felt very special.", "The courtyards, arches and painted walls were stunning.", "Every corner of the property had a story.", "Felt like royalty without feeling stuffy."], neg: ["Beautiful building, though some fittings were showing their age.", "The stairs were steep and there was no lift.", "Wi-Fi didn't reach the heritage wing."] },
  pools: { pos: ["The pool was spotless and we practically lived in it.", "Evenings by the water were the best part.", "Great for kids and adults alike.", "The pool area was beautifully lit at night."], neg: ["The pool water was colder than expected.", "The pool area could have used more shade.", "Loungers were worn out."] },
  mansion: { pos: ["Huge rooms, high ceilings and a very calm vibe.", "Plenty of space for the whole family.", "Elegant interiors and a lovely veranda.", "It felt like staying in a private estate."], neg: ["Heating and cooling struggled in the larger rooms.", "Some parts of the house needed a refresh.", "The place is big, so the staff took time to respond."] },
  farmhouses: { pos: ["Fresh produce straight from the farm was a treat.", "The kids loved the open space and animals.", "Star-filled skies and complete quiet.", "A proper digital detox in the best way."], neg: ["Mosquitoes were a nuisance after dark.", "The access road gets muddy after rain.", "Phone signal was patchy."] },
  trending: { pos: ["Beautifully designed with lots of thoughtful touches.", "Every corner was photogenic.", "Stylish, comfortable and full of character.", "The decor and lighting were on point."], neg: ["Style over comfort in a few places.", "Pricey for what it offers.", "Check-in was slower than it should be."] },
};
const LEVEL_LINES = {
  budget: { pos: ["Fantastic value for money.", "Simple and honest, exactly as described."], neg: ["You get what you pay for."] },
  comfort: { pos: ["Everything we needed was there.", "Comfortable beds and reliable Wi-Fi."], neg: ["Ordinary for the price."] },
  premium: { pos: ["The little extras, like the welcome drink, were appreciated.", "Tastefully done and well run."], neg: ["For a premium stay, we expected sharper service."] },
  luxury: { pos: ["The butler service and dining were outstanding.", "Impeccable attention to detail throughout."], neg: ["At this price point the service should be flawless, and it wasn't."] },
};
const PLACE_LINES = [
  "Being close to {n0} made planning easy.",
  "{n0} is nearby and {n1} is an easy drive.",
  "We visited {n1} and {n0} during the stay.",
  "Handy for exploring {place}, especially {n0}.",
  "Location is great for {n0}.",
];
const HOST_LINES = {
  pos: ["The host was warm and super responsive.", "Check-in was smooth and the host gave great local tips.", "Staff went out of their way to help.", "Breakfast was a highlight."],
  neg: ["The host took a while to respond.", "Check-in took longer than expected.", "Housekeeping was inconsistent."],
};
const CLOSE = {
  5: ["Highly recommend!", "We'll be back.", "Already planning our next trip here.", "Five stars, no hesitation."],
  4: ["Recommended.", "Would stay again.", "Good value overall."],
  3: ["Fine for a short stay.", "Might try somewhere else next time."],
  2: ["Hopefully they fix these issues.", "Wouldn't rush back."],
  1: ["Cannot recommend.", "Disappointed overall."],
};

function pickRating(rng, level) {
  const w = RATING_WEIGHTS.map((x, i) => Math.max(0.001, x + LEVEL_SHIFT[level][i]));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) if ((r -= w[i]) < 0) return i + 1;
  return 5;
}

function commentFor(rng, listing, rating, level) {
  const good = rating >= 4;
  const mixed = rating === 3;
  const cat = CATEGORY_LINES[listing.category] || CATEGORY_LINES.trending;
  const [n0, n1] = listing._near;
  const parts = [pick(rng, OPEN[rating])];
  parts.push(pick(rng, good || mixed ? cat.pos : cat.neg));
  if (mixed) parts.push(pick(rng, cat.neg));
  if (rng() < 0.6) parts.push(pick(rng, LEVEL_LINES[level][good ? "pos" : "neg"]));
  if (rng() < 0.55) parts.push(pick(rng, PLACE_LINES).replace("{n0}", n0).replace("{n1}", n1).replace("{place}", listing.place.split(",")[0]));
  if (rng() < 0.5) parts.push(pick(rng, HOST_LINES[good ? "pos" : "neg"]));
  parts.push(pick(rng, CLOSE[rating]));
  return parts.join(" ");
}

// How many reviews a listing gets: ~20% none, most a handful, a few popular ones with many.
function reviewCount(rng) {
  const r = rng();
  if (r < 0.2) return 0;
  if (r < 0.6) return 1 + Math.floor(rng() * 3); // 1-3
  if (r < 0.9) return 4 + Math.floor(rng() * 5); // 4-8
  return 9 + Math.floor(rng() * 8); // 9-16
}

async function seedUsersAndReviews({ password = process.env.SEED_HOST_PASSWORD || "lookout-demo-1", log = console.log } = {}) {
  const rng = mulberry32(20260611);

  // 1. guest users
  const guests = buildGuests(rng);
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await User.find({ username: { $in: guests.map((g) => g.username) } }).select("username");
  const have = new Set(existing.map((u) => u.username));
  const fresh = guests.filter((g) => !have.has(g.username));
  if (fresh.length) await User.insertMany(fresh.map((g) => ({ username: g.username, email: g.email, passwordHash })));
  const guestDocs = await User.find({ email: new RegExp(`@${GUEST_DOMAIN.replace(".", "\\.")}$`), username: { $in: guests.map((g) => g.username) } }).select("_id username");
  log(`Guest users: ${guestDocs.length} (${fresh.length} created, ${have.size} already existed)`);

  // 2. reviews, written by those guests (replace any earlier seeded ones)
  const guestIds = guestDocs.map((g) => g._id);
  const removed = await Review.deleteMany({ author: { $in: guestIds } });
  if (removed.deletedCount) log(`Replaced ${removed.deletedCount} previously seeded reviews`);

  const places = require("./places");
  const nearOf = Object.fromEntries(places.map((p) => [p.name, p.near]));
  const listings = await Listing.find({}).select("title place category cost owner createdAt").lean();
  const levelOf = (l) => { // infer comfort level from price relative to the category, for tone only
    const c = l.cost;
    return c < 2500 ? "budget" : c < 6000 ? "comfort" : c < 15000 ? "premium" : "luxury";
  };

  const now = Date.now();
  const reviews = [];
  for (const l of listings) {
    const n = Math.min(reviewCount(rng), guestIds.length - 1);
    if (!n) continue;
    const level = levelOf(l);
    const authors = shuffle(rng, guestIds.filter((id) => String(id) !== String(l.owner))).slice(0, n); // one review per guest per listing
    const listing = { ...l, _near: nearOf[l.place] || ["the town centre", "nearby attractions"] };
    for (const author of authors) {
      const rating = pickRating(rng, level);
      const at = new Date(now - Math.floor(rng() * 540) * 86400000 - Math.floor(rng() * 86400000)); // within ~18 months
      reviews.push({ listing: l._id, author, rating, comment: commentFor(rng, listing, rating, level), createdAt: at, updatedAt: at });
    }
  }
  await Review.insertMany(reviews, { timestamps: false });
  log(`Reviews: ${reviews.length} across ${new Set(reviews.map((r) => String(r.listing))).size} listings`);

  // 3. denormalised rating on each listing (same maths as the API's refreshRating)
  const agg = await Review.aggregate([{ $group: { _id: "$listing", avg: { $avg: "$rating" }, count: { $sum: 1 } } }]);
  await Listing.updateMany({}, { ratingAvg: 0, ratingCount: 0 });
  if (agg.length) {
    await Listing.bulkWrite(agg.map((a) => ({ updateOne: { filter: { _id: a._id }, update: { ratingAvg: Math.round(a.avg * 10) / 10, ratingCount: a.count } } })));
  }
  log(`Updated ratings on ${agg.length} listings`);
  return { guests: guestDocs.length, reviews: reviews.length };
}

module.exports = { seedUsersAndReviews };
