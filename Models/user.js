const mongoose=require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

let Schema = mongoose.Schema;

let UserSchema = new Schema({
    email : {
        type : String,
        require : true,
    }
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User",UserSchema);