const env = require("../config/env");

// All money is integer paise so we never accumulate floating point error.
function priceStay(costPerNightRupees, nights) {
  const subtotal = Math.round(costPerNightRupees * 100) * nights;
  const tax = Math.round(subtotal * env.taxRate);
  return { subtotal, tax, total: subtotal + tax, currency: "INR" };
}

module.exports = { priceStay };
