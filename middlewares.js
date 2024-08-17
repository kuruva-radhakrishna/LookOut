let Listing = require("./Models/Listings");
let {reviewSchema } = require("./schema.js");
let {listingSchema } = require("./schema.js");
const ExpressError=require("./util/ExpressError.js");

module.exports.isLoggedin = (req,res,next)=>{
    if(!req.user){
        req.session.reDirectURL = req.originalUrl;
        req.flash("error","you should be logged in");
        res.redirect("/login");
    } else {
        console.log(req.user);
        next();
    }
};
module.exports.savePathReview =  (req,res,next)=>{
    let {id} = req.params;
    console.log("hi" , "   ",id);
    res.redirect(`/listinngs/${id}`);
    next();
}
module.exports.savePath = (req,res,next)=>{
    if(req.session.reDirectURL){
        res.locals.reDirectURL = req.session.reDirectURL ;
    }
    next();
}

module.exports.isOwner = async (req,res,next)=>{
    let {id} = req.params;
    let listing = await Listing.findById(id).populate("owner");
    if(listing.owner._id.equals(res.locals.currUser._id)){
        next();
    } else {
        req.flash("error","You are not the owner");
        res.redirect(`listings/${id}`);
    }
};

module.exports.validateListing = (req,res,next)=>{
    let {error} = listingSchema.validate(req.body);
    if(error){
        next(new ExpressError(400,"joi "+error));
    } else {
        next();
    }
};

module.exports.reviewvalidate = (req,res,next)=>{
    let {error} = reviewSchema.validate(req.body);
    if(error){
        next(new ExpressError(400,"joi "+error));
    } else {
        next();
    }
};
