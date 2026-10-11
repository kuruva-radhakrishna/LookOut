const Listing = require("../models/Listing");
const BookedNight = require("../models/BookedNight");
const AppError = require("../utils/AppError");
const { parseDay, today, nightsBetween, MAX_NIGHTS } = require("../utils/dates");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;
const PAGE_UNIT = 3; // grid is three columns wide, so page sizes are multiples of three

/** limit: a multiple of three between 3 and 48 (rounded down); offset: a non-negative integer. */
function parsePaging({ limit, offset }) {
  const raw = parseInt(limit, 10);
  let l = Number.isFinite(raw) && raw !== 0 ? Math.floor(raw / PAGE_UNIT) * PAGE_UNIT : DEFAULT_LIMIT;
  l = Math.min(MAX_LIMIT, Math.max(PAGE_UNIT, l)); // 1 or 2 -> 3, anything above 48 -> 48
  const o = Math.max(0, parseInt(offset, 10) || 0);
  return { limit: l, offset: o };
}

const SORTS = {
  recommended: { ratingCount: -1, ratingAvg: -1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
  price_asc: { cost: 1, _id: 1 },
  price_desc: { cost: -1, _id: 1 },
  rating: { ratingAvg: -1, ratingCount: -1, _id: 1 },
};

const positive = (v) => (Number(v) > 0 ? Number(v) : null);

/** Listings that have a night in [checkIn, checkOut) already paid for or held. */
async function unavailableListingIds(checkIn, checkOut) {
  if (!checkIn && !checkOut) return null;
  if (!checkIn || !checkOut) throw new AppError(400, "Provide both checkIn and checkOut");
  const start = parseDay(checkIn, "checkIn");
  const end = parseDay(checkOut, "checkOut");
  if (start < today()) throw new AppError(400, "Check-in can't be in the past");
  const nights = nightsBetween(start, end);
  if (nights.length < 1) throw new AppError(400, "Check-out must be after check-in");
  if (nights.length > MAX_NIGHTS) throw new AppError(400, `Stays are limited to ${MAX_NIGHTS} nights`);
  return BookedNight.distinct("listing", {
    date: { $gte: start, $lt: end },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
}

async function search(query) {
  const { limit, offset } = parsePaging(query);
  const filter = {};

  if (query.category && Listing.CATEGORIES.includes(query.category)) filter.category = query.category;

  const min = positive(query.minPrice);
  const max = positive(query.maxPrice);
  if (min || max) filter.cost = { ...(min && { $gte: min }), ...(max && { $lte: max }) };

  const guests = positive(query.guests);
  if (guests) filter.maxGuests = { $gte: Math.floor(guests) };

  const minRating = positive(query.minRating);
  if (minRating) filter.ratingAvg = { $gte: minRating };

  const q = String(query.q || "").trim();
  if (q) {
    // every word must match somewhere (AND), each word against several fields (OR)
    filter.$and = q
      .split(/\s+/)
      .slice(0, 6)
      .map((word) => {
        const re = new RegExp(escapeRegex(word), "i");
        return { $or: [{ title: re }, { description: re }, { place: re }, { country: re }, { category: re }] };
      });
  }

  const taken = await unavailableListingIds(query.checkIn, query.checkOut);
  if (taken?.length) filter._id = { $nin: taken };

  const sort = SORTS[query.sort] || SORTS.recommended;
  const [items, total] = await Promise.all([
    Listing.find(filter).sort(sort).skip(offset).limit(limit).lean(),
    Listing.countDocuments(filter),
  ]);
  return { items, total, limit, offset, page: Math.floor(offset / limit) + 1, pages: Math.ceil(total / limit), hasMore: offset + items.length < total };
}

/** Destination suggestions for the search box: matching places with how many stays each has. */
async function places(q) {
  const match = q ? { place: new RegExp(escapeRegex(String(q).trim()), "i") } : {};
  const rows = await Listing.aggregate([
    { $match: match },
    { $group: { _id: "$place", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 8 },
  ]);
  return rows.map((r) => ({ place: r._id, count: r.count }));
}

/** Bounds for the filter UI. */
async function facets() {
  const [price] = await Listing.aggregate([{ $group: { _id: null, min: { $min: "$cost" }, max: { $max: "$cost" } } }]);
  const categories = await Listing.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]);
  return {
    price: { min: price?.min ?? 0, max: price?.max ?? 0 },
    categories: categories.map((c) => ({ id: c._id, count: c.count })),
  };
}

// "Goa", "Kerala": the part of "Calangute, Goa" after the last comma (or the whole string for places like "Diu")
const regionOf = (place) => String(place).split(",").pop().trim();

/**
 * "More like this": other listings ranked by how close they are to this one.
 * Same place beats same region beats same category; a similar price and good ratings break ties.
 */
async function similar(listingId, limit = 12) {
  const base = await Listing.findById(listingId).lean();
  if (!base) throw new AppError(404, "Listing not found");
  const region = regionOf(base.place);
  const pool = await Listing.find({
    _id: { $ne: base._id },
    $or: [{ place: base.place }, { place: new RegExp("(^|,\\s*)" + escapeRegex(region) + "$", "i") }, { category: base.category }],
  })
    .limit(300)
    .lean();

  const score = (l) => {
    let s = 0;
    if (l.place === base.place) s += 4;
    else if (regionOf(l.place).toLowerCase() === region.toLowerCase()) s += 2.5;
    if (l.category === base.category) s += 2;
    const ratio = l.cost / base.cost;
    if (ratio >= 0.6 && ratio <= 1.6) s += 1.5 - Math.abs(1 - ratio); // closer price, higher score
    s += (l.ratingAvg || 0) / 10; // a small nudge for well-reviewed stays
    return s;
  };
  const n = Math.min(24, Math.max(3, parseInt(limit, 10) || 12));
  return pool
    .map((l) => ({ l, s: score(l) }))
    .sort((a, b) => b.s - a.s || String(a.l._id).localeCompare(String(b.l._id)))
    .slice(0, n)
    .map(({ l }) => l);
}

module.exports = { search, places, facets, similar, parsePaging };
