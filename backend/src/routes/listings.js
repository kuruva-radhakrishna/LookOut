const express = require("express");
const Joi = require("joi");
const Listing = require("../models/Listing");
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const BookedNight = require("../models/BookedNight");
const AppError = require("../utils/AppError");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { upload, uploadBuffer } = require("../utils/upload");
const { geocode } = require("../utils/geocode");
const { parseDay, today } = require("../utils/dates");
const bookings = require("../services/bookingService");
const listingSearch = require("../services/listingSearch");

const router = express.Router();

const listingFields = {
  title: Joi.string().trim().max(80),
  description: Joi.string().trim().allow("").max(3000),
  cost: Joi.number().min(1).max(1000000),
  place: Joi.string().trim(),
  country: Joi.string().trim(),
  category: Joi.string().valid(...Listing.CATEGORIES),
  maxGuests: Joi.number().integer().min(1).max(20),
  imageUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).allow(""),
};
const createSchema = Joi.object({
  ...listingFields,
  title: listingFields.title.required(),
  cost: listingFields.cost.required(),
  place: listingFields.place.required(),
  country: listingFields.country.required(),
});
const updateSchema = Joi.object(listingFields);

const reviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().min(1).max(1000).required(),
});

// Multipart bodies arrive as strings and `listing` fields are sent flat (title, cost, ...).
async function applyImage(req, doc) {
  if (req.file) doc.img = await uploadBuffer(req.file.buffer);
  else if (req.body.imageUrl) doc.img = { url: req.body.imageUrl, filename: "external" };
}

async function loadOwned(req) {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw new AppError(404, "Listing not found");
  if (String(listing.owner) !== String(req.user._id)) throw new AppError(403, "You don't own this listing");
  return listing;
}

async function refreshRating(listingId) {
  const [agg] = await Review.aggregate([
    { $match: { listing: listingId } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Listing.findByIdAndUpdate(listingId, {
    ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0,
    ratingCount: agg ? agg.count : 0,
  });
}

router.get("/", async (req, res) => {
  res.json(await listingSearch.search(req.query));
});

// These must be declared before "/:id" so they are not mistaken for an id.
router.get("/places", async (req, res) => {
  res.json(await listingSearch.places(req.query.q));
});

router.get("/facets", async (_req, res) => {
  res.json(await listingSearch.facets());
});

router.get("/:id", async (req, res) => {
  const listing = await Listing.findById(req.params.id).populate("owner", "username").lean();
  if (!listing) throw new AppError(404, "Listing not found");
  res.json(listing);
});

router.post("/", requireAuth, upload.single("image"), validate(createSchema), async (req, res) => {
  const listing = new Listing({ ...req.body, owner: req.user._id });
  await applyImage(req, listing);
  if (!listing.img?.url) throw new AppError(400, "Please add a photo (upload or image URL)");
  listing.geometry = (await geocode(`${listing.place}, ${listing.country}`)) || undefined;
  await listing.save();
  res.status(201).json(listing);
});

router.put("/:id", requireAuth, upload.single("image"), validate(updateSchema), async (req, res) => {
  const listing = await loadOwned(req);
  const placeChanged = (req.body.place && req.body.place !== listing.place) || (req.body.country && req.body.country !== listing.country);
  Object.assign(listing, req.body);
  await applyImage(req, listing);
  if (placeChanged) listing.geometry = (await geocode(`${listing.place}, ${listing.country}`)) || listing.geometry;
  await listing.save();
  res.json(listing);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const listing = await loadOwned(req);
  const upcoming = await Booking.countDocuments({ listing: listing._id, status: "confirmed", checkOut: { $gt: today() } });
  if (upcoming) throw new AppError(409, "This listing has upcoming paid bookings and can't be deleted yet");
  await Promise.all([
    Listing.deleteOne({ _id: listing._id }),
    Review.deleteMany({ listing: listing._id }),
    BookedNight.deleteMany({ listing: listing._id }),
    Booking.updateMany({ listing: listing._id, status: "pending" }, { status: "cancelled" }),
  ]);
  res.json({ ok: true });
});

// Booked/held nights so the calendar can grey them out.
router.get("/:id/availability", async (req, res) => {
  const from = req.query.from ? parseDay(req.query.from, "from") : today();
  const to = req.query.to ? parseDay(req.query.to, "to") : new Date(from.getTime() + 365 * 86400000);
  res.json({ booked: await bookings.bookedDays(req.params.id, from, to) });
});

router.get("/:id/reviews", async (req, res) => {
  const reviews = await Review.find({ listing: req.params.id }).sort({ createdAt: -1 }).populate("author", "username").lean();
  res.json(reviews);
});

router.post("/:id/reviews", requireAuth, validate(reviewSchema), async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw new AppError(404, "Listing not found");
  if (String(listing.owner) === String(req.user._id)) throw new AppError(400, "You can't review your own listing");
  const review = await Review.create({ ...req.body, listing: listing._id, author: req.user._id });
  await refreshRating(listing._id);
  res.status(201).json(await review.populate("author", "username"));
});

module.exports = router;
module.exports.refreshRating = refreshRating;
