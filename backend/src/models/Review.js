const mongoose = require("mongoose");

const MAX_DEPTH = 3; // review (0) -> reply (1) -> reply to reply (2) -> (3)

/**
 * One document type for both reviews and replies. A top-level review has a rating and no parent; a reply
 * has a parent and no rating. `root` points at the top-level review of the thread so a whole thread can be
 * fetched with one query. Only top-level reviews count towards a listing's rating.
 */
const reviewSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: function () { return !this.parent; } },
    comment: { type: String, required: true, maxlength: 1000 },
    images: { type: [{ url: String, filename: String, _id: false }], default: [] },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Review", default: null },
    root: { type: mongoose.Schema.Types.ObjectId, ref: "Review", default: null },
    depth: { type: Number, default: 0, min: 0, max: MAX_DEPTH },
    // who reacted; kept as id lists so a user can hold at most one reaction, never exposed to clients
    likes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    dislikes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

reviewSchema.index({ listing: 1, parent: 1, createdAt: -1 });
reviewSchema.index({ root: 1, createdAt: 1 });
// a guest can leave one top-level review per listing (replies are unlimited)
reviewSchema.index({ listing: 1, author: 1 }, { unique: true, partialFilterExpression: { depth: 0 } });

const Review = mongoose.model("Review", reviewSchema);
Review.MAX_DEPTH = MAX_DEPTH;
module.exports = Review;
