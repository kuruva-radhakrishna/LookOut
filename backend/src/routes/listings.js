const express = require("express");
const Joi = require("joi");
const Listing = require("../models/Listing");
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const BookedNight = require("../models/BookedNight");
const Favorite = require("../models/Favorite");
const AppError = require("../utils/AppError");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { geocode } = require("../utils/geocode");
const { parseDay, today } = require("../utils/dates");
const bookings = require("../services/bookingService");
const listingSearch = require("../services/listingSearch");
const { MAX_IMAGES, normalizeImages, primaryOf, withImages } = require("../services/listingImages");

const router = express.Router();

const imageItem = Joi.object({
  url: Joi.string().trim().max(500).uri({ scheme: ["http", "https"] }).required(),
  filename: Joi.string().trim().max(200).allow(""),
}).unknown(true); // client may echo back attribution fields; the server only trusts what it already stores
const listingFields = {
  title: Joi.string().trim().max(80),
  description: Joi.string().trim().allow("").max(3000),
  cost: Joi.number().min(1).max(1000000),
  place: Joi.string().trim(),
  country: Joi.string().trim(),
  category: Joi.string().valid(...Listing.CATEGORIES),
  maxGuests: Joi.number().integer().min(1).max(20),
  images: Joi.array().items(imageItem).min(1).max(MAX_IMAGES),
  primary: Joi.number().integer().min(0).max(MAX_IMAGES - 1), // index into `images` of the primary photo (default 0)
  imageUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).allow(""), // older single-photo form
};
const createSchema = Joi.object({
  ...listingFields,
  title: listingFields.title.required(),
  cost: listingFields.cost.required(),
  place: listingFields.place.required(),
  country: listingFields.country.required(),
});
const updateSchema = Joi.object(listingFields);

/** Applies `images` / `primary` (or the legacy `imageUrl`) from a request body to a listing document; strips them from the body. */
function applyImages(listing, body) {
  const list = body.images || (body.imageUrl ? [{ url: body.imageUrl }] : null);
  const primary = body.primary;
  delete body.images;
  delete body.primary;
  delete body.imageUrl;
  if (!list) return;
  // photos the listing already has (their attribution is carried over); older listings only have `img`
  const existing = listing.images?.length ? listing.images : listing.img?.url ? [listing.img] : [];
  const images = normalizeImages(list, primary, existing);
  listing.images = images;
  listing.img = primaryOf(images);
}

async function loadOwned(req) {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw new AppError(404, "Listing not found");
  if (String(listing.owner) !== String(req.user._id)) throw new AppError(403, "You don't own this listing");
  return listing;
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

router.get("/:id/similar", async (req, res) => {
  res.json(await listingSearch.similar(req.params.id, req.query.limit));
});

router.get("/:id", async (req, res) => {
  const listing = await Listing.findById(req.params.id).populate("owner", "username createdAt").lean();
  if (!listing) throw new AppError(404, "Listing not found");
  res.json(withImages(listing));
});

router.post("/", requireAuth, validate(createSchema), async (req, res) => {
  const body = { ...req.body };
  const listing = new Listing({ ...body, images: undefined, owner: req.user._id });
  applyImages(listing, body);
  if (!listing.img?.url) throw new AppError(400, "Please add at least one photo");
  listing.geometry = (await geocode(`${listing.place}, ${listing.country}`)) || undefined;
  await listing.save();
  res.status(201).json(withImages(listing.toObject()));
});

router.put("/:id", requireAuth, validate(updateSchema), async (req, res) => {
  const listing = await loadOwned(req);
  const body = { ...req.body };
  const placeChanged = (body.place && body.place !== listing.place) || (body.country && body.country !== listing.country);
  applyImages(listing, body);
  Object.assign(listing, body);
  if (placeChanged) listing.geometry = (await geocode(`${listing.place}, ${listing.country}`)) || listing.geometry;
  await listing.save();
  res.json(withImages(listing.toObject()));
});

router.delete("/:id", requireAuth, async (req, res) => {
  const listing = await loadOwned(req);
  const upcoming = await Booking.countDocuments({ listing: listing._id, status: "confirmed", checkOut: { $gt: today() } });
  if (upcoming) throw new AppError(409, "This listing has upcoming paid bookings and can't be deleted yet");
  await Promise.all([
    Listing.deleteOne({ _id: listing._id }),
    Review.deleteMany({ listing: listing._id }),
    Favorite.deleteMany({ listing: listing._id }),
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

// Reviews (with replies, photos and reactions) are in routes/reviews.js, mounted at /api/listings/:id/reviews.
module.exports = router;
