const express = require("express");
const Joi = require("joi");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const AppError = require("../utils/AppError");
const env = require("../config/env");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const reviews = require("../services/reviewService");

// Reviews live under two prefixes: /api/listings/:id/reviews (list, create) and /api/reviews/:id/... (reply, react, delete)
const listingRouter = express.Router({ mergeParams: true });
const router = express.Router();

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.nodeEnv === "test",
  message: { error: "You're posting too fast, please try again in a few minutes" },
});

// Review photos must be ones we host (or Cloudinary): user-generated content shouldn't hot-link arbitrary sites.
const ownImage = Joi.object({
  url: Joi.string()
    .trim()
    .max(500)
    .custom((value, helpers) => {
      try {
        const u = new URL(value);
        if (/^\/api\/media\/[0-9a-f]{24}$/i.test(u.pathname) || u.hostname === "res.cloudinary.com") return value;
      } catch {
        /* fall through */
      }
      return helpers.error("any.invalid");
    })
    .message("Photos must be uploaded through LookOut")
    .required(),
  filename: Joi.string().trim().max(200).allow(""),
});
const body = { comment: Joi.string().trim().min(1).max(1000).required(), images: Joi.array().items(ownImage).max(4).default([]) };
const reviewSchema = Joi.object({ rating: Joi.number().integer().min(1).max(5).required(), ...body });
const replySchema = Joi.object(body);
const reactionSchema = Joi.object({ value: Joi.string().valid("like", "dislike", "none").required() });

const idParam = (req, _res, next) => (mongoose.isValidObjectId(req.params.id) ? next() : next(new AppError(404, "Not found")));

listingRouter.get("/", idParam, optionalAuth, async (req, res) => {
  const [page, summary] = await Promise.all([reviews.list(req.params.id, req.query, req.user?._id), reviews.summary(new mongoose.Types.ObjectId(req.params.id))]);
  res.json({ ...page, summary });
});

listingRouter.post("/", idParam, requireAuth, writeLimiter, validate(reviewSchema), async (req, res) => {
  const review = await reviews.create({ listingId: req.params.id, user: req.user, ...req.body });
  res.status(201).json({ _id: review._id });
});

router.post("/:id/replies", idParam, requireAuth, writeLimiter, validate(replySchema), async (req, res) => {
  const reply = await reviews.reply({ parentId: req.params.id, user: req.user, ...req.body });
  res.status(201).json({ _id: reply._id });
});

router.post("/:id/reaction", idParam, requireAuth, writeLimiter, validate(reactionSchema), async (req, res) => {
  res.json(await reviews.react(req.params.id, req.user, req.body.value));
});

router.delete("/:id", idParam, requireAuth, async (req, res) => {
  await reviews.remove(req.params.id, req.user);
  res.json({ ok: true });
});

module.exports = router;
module.exports.listingRouter = listingRouter;
