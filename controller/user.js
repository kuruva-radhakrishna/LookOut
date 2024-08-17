const User = require("../Models/user");
const wrapAsync = require("../util/wrapAsync.js");

module.exports.signUpForm = async (req, res) => {
  return res.render("users/signup.ejs");
};

module.exports.signUp = wrapAsync(async (req, res) => {
  let { username, email, password } = req.body;
  let newUser = new User({
    email: email,
    username: username,
  });
  let user = await User.register(newUser, password);
  req.login(user, (err) => {
    if (err) {
      next(err);
    } else {
      req.flash("success", "Successfully signedup");
      return res.redirect("/listings");
    }
  });
});

module.exports.loginForm = (req, res) => {
  return res.render("users/login.ejs");
};

module.exports.login = (req, res) => {
  req.flash("success", "Welcome back!!");
  let URL = res.locals.reDirectURL || "/listings";
  URL= URL.replace("/reviews","/");
  return res.redirect(URL);
};

module.exports.logout = wrapAsync(async (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "Logged out successfully");
    return res.redirect("/listings");
  });
});
