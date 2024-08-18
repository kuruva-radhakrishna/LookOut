const Listing = require("../Models/Listings");
const wrapAsync=require("../util/wrapAsync.js");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

module.exports.index=wrapAsync(async (req,res)=>{
    let listings = await Listing.find({});
    res.render("Listings/index.ejs",{listings});
});

module.exports.newListingForm = wrapAsync(async (req,res)=>{
    res.render("Listings/new.ejs");
});

module.exports.filter = wrapAsync(async  (req,res)=>{
    let {category }= req.params;
    console.log(category);
    let listings = await Listing.find({category});
    res.render("Listings/index.ejs",{listings});
});

module.exports.search = wrapAsync(async (req,res)=>{
    const searchQuery = req.query.search || ""; // Extract the search query from the query string
    const keywords = searchQuery.split(" "); // Split the query into individual keywords
    console.log(searchQuery);

    const searchConditions = keywords.map(keyword => ({
        $or: [
            { title: { $regex: keyword, $options: "i" } },      // Search in title
            { description: { $regex: keyword, $options: "i" } }, // Search in description
            { location: { $regex: keyword, $options: "i" } },    // Search in location
            { category: { $regex: keyword, $options: "i" } },    // Search in category
        ]
    }));

    let listings;
    if (keywords.length > 0) {
        listings = await Listing.find({ $and: searchConditions });
    } else {
        listings = await Listing.find({}); // Return all listings if no search query is provided
    }
    if(listings.length === 0) {
        req.flash("error","listings based on your search doesn't exist");
        res.redirect("/listings");
    }
    res.render("Listings/index", { listings });
});

module.exports.newListing = wrapAsync(async (req,res,next)=>{ 
    console.log(req.body);
    let newListing = new Listing(req.body.listing);
    let filename = req.file.filename;
    let url =  req.file.path;
    newListing.img = {filename,url};
    newListing.owner=req.user._id;
    let result=await geocodingClient.forwardGeocode({
                    query: newListing.place,
                    limit: 1
                }).send();
    newListing.geometry=result.body.features[0].geometry;
    console.log(newListing);
    await newListing.save();
    req.flash("success","New Listing created successfully");
    return res.redirect("/listings");
});

module.exports.show =wrapAsync(async (req,res)=>{
    let {id}=req.params;
    let listing=await Listing.findById(id).populate({path : "reviews" , populate : {path : "author"}}).populate("owner");
    if(!listing){
        req.flash("error","listing doesn't exist");
        res.redirect("/listings");
    } else {  
        return res.render("Listings/show.ejs",{listing});
    }
});

module.exports.editForm = wrapAsync(async (req,res)=>{
    let {id}=req.params;
    let listing=await Listing.findById(id);
    if(!listing){
        req.flash("error","listings doesn't exist");
        return res.redirect("/listings");
    } else {
        let originalUrl = listing.img.url;
        originalUrl = originalUrl.replace("/upload","/upload/w_100,h_250");
        return res.render("Listings/edit.ejs",{listing,originalUrl});
    }
});

module.exports.edit = wrapAsync(async (req,res)=>{
    let {id}=req.params;
    let listing=await Listing.findByIdAndUpdate(id,{...req.body});
    if(typeof req.file!="undefined"){
        console.log(req.file);
        let filename = req.file.filename;
        let url =  req.file.path;
        listing.img = {filename,url};
        await listing.save();
    }
    req.flash("success","Listing editted successfully");
    return res.redirect(`/listings/${id}`);
});

module.exports.destroy = wrapAsync(async (req,res)=>{
    let {id}=req.params;
    const listing = await Listing.findByIdAndDelete(id);
    if(!listing){
        req.flash("error","Listing doesn't exist");
        return res.redirect("/listings");
    } else {
        req.flash("success","Listing deleted successfully");
    }
    return res.redirect("/listings");
});
