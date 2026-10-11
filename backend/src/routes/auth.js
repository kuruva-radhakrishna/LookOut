const express = require("express");
const bcrypt = require("bcryptjs");
const Joi = require("joi");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const validate = require("../middleware/validate");
const { signToken, requireAuth } = require("../middleware/auth");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

const signupSchema = Joi.object({
  username: Joi.string().trim().min(3).max(30).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).max(100).required(),
});
const loginSchema = Joi.object({
  username: Joi.string().trim().required(), // username or email
  password: Joi.string().required(),
});

const session = (user) => ({ token: signToken(user), user: user.toPublic() });

router.post("/signup", authLimiter, validate(signupSchema), async (req, res) => {
  const { username, email, password } = req.body;
  const taken = await User.findOne({ $or: [{ username }, { email: email.toLowerCase() }] });
  if (taken) throw new AppError(409, "That username or email is already registered");
  const user = await User.create({ username, email, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json(session(user));
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ $or: [{ username }, { email: username.toLowerCase() }] }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, "Incorrect username or password");
  }
  res.json(session(user));
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

module.exports = router;
