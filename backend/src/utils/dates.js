const AppError = require("./AppError");

const DAY = 24 * 60 * 60 * 1000;
const MAX_NIGHTS = 30;

// "YYYY-MM-DD" -> Date at 00:00 UTC. Bookings are whole nights, so we never deal with time of day.
function parseDay(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, `${field} must be a YYYY-MM-DD date`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new AppError(400, `${field} is not a valid date`);
  }
  return d;
}

function today() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

// Nights occupied by a stay: checkIn (inclusive) .. checkOut (exclusive), ascending.
function nightsBetween(checkIn, checkOut) {
  const out = [];
  for (let t = checkIn.getTime(); t < checkOut.getTime(); t += DAY) out.push(new Date(t));
  return out;
}

module.exports = { DAY, MAX_NIGHTS, parseDay, today, nightsBetween };
