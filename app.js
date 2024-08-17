if(process.env.NODE_ENV != "production"){
  require("dotenv").config();
}


const express = require("express");
const port = 3000;
const path = require("path");
const methodOverride = require("method-override");
const app = express();
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate");
const ExpressError = require("./util/ExpressError.js");
const reviewRoute = require("./routes/reviewRoute.js");
const listingsRoute = require("./routes/listingsRoute.js");
const userRoute = require("./routes/userRoute.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport = require("passport");
const passportLocal = require("passport-local");
const User = require("./Models/user.js");
let DB_Url = process.env.ATLAS_DB_URL;





const store = MongoStore.create({
  mongoUrl : DB_Url,
  crypto : {
    secret : process.env.SECRET,
  },
  touchAfter : 24*60*60,
});

store.on("error",()=>{
  console.log("error is mongo store");
});


const sesionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  Cookie: {
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
  },
};

app.use(session(sesionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(new passportLocal(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("ejs", ejsMate);

app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

main()
  .then(() => {
    console.log("connection succesfull");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(DB_Url,{
    serverSelectionTimeoutMS: 30000,
});
}

app.get("/",(req,res)=>res.redirect("/listings"));
app.use("/listings", listingsRoute);
app.use("/listings/:id/reviews", reviewRoute);
app.use("/", userRoute);

//Page not found

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page not Found"));
});

///Error

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "something went wrong" } = err;
  res.render("Listings/error.ejs", { message });
});

app.listen(port, () => {
  console.log("App listening on port 3000");
});
