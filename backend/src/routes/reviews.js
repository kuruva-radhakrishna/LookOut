const express = require("express");
const Review = require("../models/Review");
const AppError = require("../utils/AppError");
const { requireAuth } = require("../middleware/auth");
const { refreshRating } = require("./listings");

const router = express.Router();

router.delete("/:id", requireAuth, async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError(404, "Review not found");
  if (String(review.author) !== String(req.user._id)) throw new AppError(403, "You can only delete your own reviews");
  await review.deleteOne();
  await refreshRating(review.listing);
  res.json({ ok: true });
});

module.exports = router;
