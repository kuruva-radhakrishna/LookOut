const mongoose = require("mongoose");

// "Saved stays": one row per (user, listing).
const favoriteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  },
  { timestamps: true }
);

favoriteSchema.index({ user: 1, listing: 1 }, { unique: true });
favoriteSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Favorite", favoriteSchema);
