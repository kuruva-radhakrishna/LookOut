const express = require("express");
const router = express.Router({ mergeParams: true });
const mongoose = require("mongoose");
const methodOverride = require("method-override");
let { isLoggedin, isOwner, reviewvalidate,  savePathReview } = require("../middlewares.js");
let { newReview, destroy } = require("../controller/review.js");

router.use(methodOverride("_method"));
router.use(express.urlencoded({ extended: true }));


//Review
//Post review
router.post("/", isLoggedin, reviewvalidate, newReview);

//Delete review

router.delete("/:reviewId", isLoggedin, isOwner, destroy);

module.exports = router;
