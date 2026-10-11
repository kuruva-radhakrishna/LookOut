const Review = require("../models/Review");
const Listing = require("../models/Listing");
const Booking = require("../models/Booking");
const AppError = require("../utils/AppError");
const { today } = require("../utils/dates");

const DEFAULT_LIMIT = 6; // two columns of three
const MAX_LIMIT = 24;
const SORTS = {
  recent: { createdAt: -1, _id: -1 },
  high: { rating: -1, createdAt: -1 },
  low: { rating: 1, createdAt: -1 },
};

const sizeOf = (a) => (Array.isArray(a) ? a.length : 0);

/** Recomputes a listing's average and count from its top-level reviews (replies don't count). */
async function refreshRating(listingId) {
  const [agg] = await Review.aggregate([
    { $match: { listing: listingId, parent: null } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Listing.findByIdAndUpdate(listingId, { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg ? agg.count : 0 });
}

/** Average, count and how many reviews gave each star rating. */
async function summary(listingId) {
  const rows = await Review.aggregate([
    { $match: { listing: listingId, parent: null } },
    { $group: { _id: "$rating", n: { $sum: 1 } } },
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let total = 0;
  for (const r of rows) {
    distribution[r._id] = r.n;
    count += r.n;
    total += r._id * r.n;
  }
  return { count, avg: count ? Math.round((total / count) * 10) / 10 : 0, distribution };
}

/** Shape one review for the client: counts instead of voter lists, plus what the viewer did and who wrote it. */
function present(r, { userId, ownerId, verified }) {
  const mine = userId && (r.likes || []).some((id) => String(id) === String(userId)) ? "like" : userId && (r.dislikes || []).some((id) => String(id) === String(userId)) ? "dislike" : null;
  return {
    _id: r._id,
    listing: r.listing,
    parent: r.parent || null,
    depth: r.depth || 0,
    author: r.author ? { _id: r.author._id, username: r.author.username, memberSince: r.author.createdAt } : null,
    isHost: Boolean(r.author && String(r.author._id) === String(ownerId)),
    verifiedStay: Boolean(r.author && verified.has(String(r.author._id))),
    rating: r.rating ?? null,
    comment: r.comment,
    images: r.images || [],
    likes: sizeOf(r.likes),
    dislikes: sizeOf(r.dislikes),
    myReaction: mine,
    createdAt: r.createdAt,
    replies: [],
  };
}

/** A page of top-level reviews, each with its full reply tree attached. */
async function list(listingId, { sort = "recent", limit, offset } = {}, userId = null) {
  const listing = await Listing.findById(listingId).select("owner").lean();
  if (!listing) throw new AppError(404, "Listing not found");

  const n = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT));
  const skip = Math.max(0, parseInt(offset, 10) || 0);
  const match = { listing: listing._id, parent: null };

  let top;
  if (sort === "helpful") {
    top = await Review.aggregate([
      { $match: match },
      { $addFields: { score: { $subtract: [{ $size: { $ifNull: ["$likes", []] } }, { $size: { $ifNull: ["$dislikes", []] } }] } } },
      { $sort: { score: -1, createdAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: n },
    ]);
    await Review.populate(top, { path: "author", select: "username createdAt" });
  } else {
    top = await Review.find(match).sort(SORTS[sort] || SORTS.recent).skip(skip).limit(n).populate("author", "username createdAt").lean();
  }

  const topIds = top.map((r) => r._id);
  const replies = topIds.length ? await Review.find({ root: { $in: topIds } }).sort({ createdAt: 1 }).populate("author", "username createdAt").lean() : [];

  // who among the authors has actually completed a stay here: a trust signal shown on the review
  const authorIds = [...new Set([...top, ...replies].map((r) => String(r.author?._id)).filter(Boolean))];
  const verified = new Set(
    (await Booking.find({ listing: listing._id, guest: { $in: authorIds }, status: "confirmed", checkOut: { $lt: today() } }).distinct("guest")).map(String)
  );
  const ctx = { userId, ownerId: listing.owner, verified };

  const byId = new Map();
  const roots = top.map((r) => {
    const p = present(r, ctx);
    byId.set(String(r._id), p);
    return p;
  });
  for (const r of replies) {
    const p = present(r, ctx);
    byId.set(String(r._id), p);
    byId.get(String(r.parent))?.replies.push(p); // replies are sorted oldest first, so each thread reads in order
  }

  return { items: roots, total: (await summary(listing._id)).count, limit: n, offset: skip };
}

async function create({ listingId, user, rating, comment, images = [] }) {
  const listing = await Listing.findById(listingId);
  if (!listing) throw new AppError(404, "Listing not found");
  if (String(listing.owner) === String(user._id)) throw new AppError(400, "You can't review your own listing");
  if (await Review.exists({ listing: listing._id, author: user._id, parent: null })) {
    throw new AppError(409, "You've already reviewed this place. You can reply to a review instead.");
  }
  const review = await Review.create({ listing: listing._id, author: user._id, rating, comment, images, depth: 0 });
  await refreshRating(listing._id);
  return review;
}

async function reply({ parentId, user, comment, images = [] }) {
  const parent = await Review.findById(parentId);
  if (!parent) throw new AppError(404, "Review not found");
  if ((parent.depth || 0) >= Review.MAX_DEPTH) throw new AppError(400, "Replies can only go three levels deep");
  return Review.create({
    listing: parent.listing,
    author: user._id,
    comment,
    images,
    parent: parent._id,
    root: parent.root || parent._id,
    depth: (parent.depth || 0) + 1,
  });
}

/** Deletes a review or reply and everything beneath it. Only the author may. */
async function remove(reviewId, user) {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError(404, "Review not found");
  if (String(review.author) !== String(user._id)) throw new AppError(403, "You can only delete your own reviews");

  const ids = [review._id];
  if (!review.parent) {
    await Review.deleteMany({ root: review._id });
  } else {
    // collect the subtree level by level (depth is capped at three)
    let frontier = [review._id];
    while (frontier.length) {
      const kids = await Review.find({ parent: { $in: frontier } }).distinct("_id");
      ids.push(...kids);
      frontier = kids;
    }
    await Review.deleteMany({ _id: { $in: ids } });
    return review;
  }
  await review.deleteOne();
  await refreshRating(review.listing);
  return review;
}

/** Sets the viewer's reaction (like / dislike / none); one reaction per person, never on your own review. */
async function react(reviewId, user, value) {
  const review = await Review.findById(reviewId).select("author");
  if (!review) throw new AppError(404, "Review not found");
  if (String(review.author) === String(user._id)) throw new AppError(400, "You can't react to your own review");
  const uid = user._id;
  const update =
    value === "like" ? { $addToSet: { likes: uid }, $pull: { dislikes: uid } } : value === "dislike" ? { $addToSet: { dislikes: uid }, $pull: { likes: uid } } : { $pull: { likes: uid, dislikes: uid } };
  const updated = await Review.findByIdAndUpdate(reviewId, update, { new: true }).select("likes dislikes").lean();
  return { likes: sizeOf(updated.likes), dislikes: sizeOf(updated.dislikes), myReaction: value === "like" || value === "dislike" ? value : null };
}

module.exports = { list, summary, create, reply, remove, react, refreshRating };
