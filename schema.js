const joi = require("joi");

module.exports.listingSchema = joi.object({
    listing : joi.object({
        title : joi.string().max(40).required(),
        description : joi.string(),
        img : joi.string().allow(null,""),
        cost : joi.number().min(1).required(),
        place: joi.string().required(),
        country : joi.string().required()
    }).required()
});

module.exports.reviewSchema=joi.object({
    review : joi.object({
        rating : joi.number().min(1).max(5),
        comment : joi.string().required()
    }).required()
})