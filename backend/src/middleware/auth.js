const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const AppError = require("../utils/AppError");

const signToken = (user) => jwt.sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

async function loadUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, env.jwtSecret);
    return await User.findById(sub);
  } catch {
    return null;
  }
}

async function requireAuth(req, _res, next) {
  const user = await loadUser(req);
  if (!user) throw new AppError(401, "Please log in to continue");
  req.user = user;
  next();
}

async function optionalAuth(req, _res, next) {
  req.user = await loadUser(req);
  next();
}

module.exports = { signToken, requireAuth, optionalAuth };
