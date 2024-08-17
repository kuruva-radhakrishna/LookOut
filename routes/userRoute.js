const express = require("express");
const router = express.Router({ mergeParams: true });
const passport = require("passport");
const { savePath} = require("../middlewares.js");
const { signUpForm, signUp,loginForm, login, logout } = require("../controller/user.js");

router.route("/signup").get(signUpForm).post(signUp);

router
  .route("/login")
  .get(loginForm)
  .post(
    savePath,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    login
  );

router.get("/logout", logout);

module.exports = router;
