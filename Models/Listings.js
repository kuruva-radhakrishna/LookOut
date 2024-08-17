const mongoose = require("mongoose");
const Review = require("./review");

let Schema = mongoose.Schema;

let listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  img: {
    url: String,
    filename: String,
  },
  cost: {
    type: Number,
    required: true,
  },
  place: {
    type: String,
  },
  country: {
    type: String,
  },
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  category : {
    type : String,
    enum : ["trending","castles","mountains","beaches","mansion","rooms","pools","farmhouses"],
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  geometry: {
    type: {
      type: String, // Don't do `{ location: { type: String } }`
      enum: ["Point"], // 'location.type' must be 'Point'
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
});

//Listing Deletion middleware
listingSchema.post("findOneAndDelete", async (listing) => {
  console.log("middle ware");
  await Review.deleteMany({ _id: { $in: listing.reviews } });
});

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
