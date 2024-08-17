const express=require("express");
const router = express.Router();
const mongoose=require("mongoose");
const methodOverride=require("method-override");
let { isLoggedin , isOwner,validateListing } = require("../middlewares.js");
let {index,newListingForm,newListing,show, editForm , edit, destroy,filter , search} = require("../controller/listing.js");
router.use(methodOverride("_method"));
router.use(express.urlencoded({extended : true}));
const multer  = require('multer');
const {storage} = require("../cloudConfig.js");
const upload = multer({storage});
const Listing = require("../Models/Listings");
const wrapAsync=require("../util/wrapAsync.js");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

// 
router.route("/")
.get(index)
.post( isLoggedin,upload.single("listing[img]"),validateListing, newListing);

router.get("/filter/:category", filter);

router.get("/search",search);





router.get("/new", isLoggedin,newListingForm );

router.get("/:id",show);

router.route("/:id/edit")
.get( isLoggedin, isOwner, editForm )
.patch(isLoggedin, isOwner,upload.single("listing[img]"),validateListing, edit);

router.delete("/:id/delete", isLoggedin, isOwner, destroy);

module.exports = router;
