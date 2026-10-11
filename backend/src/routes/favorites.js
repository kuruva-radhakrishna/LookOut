const express = require("express");
const mongoose = require("mongoose");
const Favorite = require("../models/Favorite");
const Listing = require("../models/Listing");
const AppError = require("../utils/AppError");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// Saved stays, newest first, as full listing cards.
router.get("/", async (req, res) => {
  const rows = await Favorite.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(200).lean();
  const listings = await Listing.find({ _id: { $in: rows.map((r) => r.listing) } }).select("-images").lean();
  const byId = new Map(listings.map((l) => [String(l._id), l]));
  res.json(rows.map((r) => byId.get(String(r.listing))).filter(Boolean)); // a saved listing that was deleted just drops out
});

// Just the ids, so every card on a page can show a filled heart without fetching listings again.
router.get("/ids", async (req, res) => {
  res.json(await Favorite.find({ user: req.user._id }).distinct("listing"));
});

const checkId = async (id) => {
  if (!mongoose.isValidObjectId(id) || !(await Listing.exists({ _id: id }))) throw new AppError(404, "Listing not found");
};

// Idempotent: saving twice or removing something that isn't saved is fine.
router.put("/:listingId", async (req, res) => {
  await checkId(req.params.listingId);
  await Favorite.updateOne({ user: req.user._id, listing: req.params.listingId }, { $setOnInsert: { user: req.user._id, listing: req.params.listingId } }, { upsert: true });
  res.json({ saved: true });
});

router.delete("/:listingId", async (req, res) => {
  if (mongoose.isValidObjectId(req.params.listingId)) await Favorite.deleteOne({ user: req.user._id, listing: req.params.listingId });
  res.json({ saved: false });
});

module.exports = router;
