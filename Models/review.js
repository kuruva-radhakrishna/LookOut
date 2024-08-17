const mongoose=require("mongoose");

let Schema = mongoose.Schema;

const ReviewSchema = new Schema({
    rating :{
        type : Number,
        min : 1,
        max : 5
    },
    comment : {
        type : String,
    },
    created_At : {
        type : Date,
        default : Date.now()
    },
    author : {
        type : Schema.Types.ObjectId,
        ref : "User"
    }
});

const Review = mongoose.model("Review",ReviewSchema);
module.exports = Review;