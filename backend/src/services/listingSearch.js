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

module.exports = { search, places, facets, parsePaging };
