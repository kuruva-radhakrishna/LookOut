const mongoose = require("mongoose");

const CATEGORIES = ["trending", "castles", "mountains", "beaches", "mansion", "rooms", "pools", "farmhouses"];

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: "" },
    // The primary photo, denormalised from `images` so cards, bookings and search results can keep reading `img`.
    img: { url: String, filename: String, credit: String, license: String, source: String }, // credit/license/source: photo attribution
    // All photos, in display order, exactly one flagged primary. Older listings only have `img` (the API fills this in).
    images: {
      type: [{ url: String, filename: String, credit: String, license: String, source: String, primary: Boolean }],
      default: undefined,
    },
    cost: { type: Number, required: true, min: 1 }, // rupees per night
    place: { type: String, required: true },
    country: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, default: "trending" },
    maxGuests: { type: Number, default: 4, min: 1, max: 20 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    geometry: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
    // denormalised so list pages need no aggregation per request
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

listingSchema.index({ category: 1, cost: 1 });
listingSchema.index({ cost: 1 });
listingSchema.index({ createdAt: -1 });
listingSchema.index({ ratingAvg: -1, ratingCount: -1 });
listingSchema.index({ place: 1 });

const Listing = mongoose.model("Listing", listingSchema);
Listing.CATEGORIES = CATEGORIES;
module.exports = Listing;
