
const Listing = require("../Models/Listings.js");
const Review = require("../Models/review.js");
const wrapAsync=require("../util/wrapAsync.js");

module.exports.newReview = wrapAsync(async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  let review = new Review(req.body.review);
  review.author = res.locals.currUser._id;
  listing.reviews.push(review._id);

  await review.save();
  await listing.save();
  req.flash("success", "New review added succesfully");
  return res.redirect(`/listings/${id}`);
});

module.exports.destroy = wrapAsync(async (req, res) => {
  let { id, reviewId } = req.params;
  let listing = await Listing.findById(id);
  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "review deleted succesfully");
  return res.redirect(`/listings/${id}`);
});
