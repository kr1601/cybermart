const pool = require('../db');

const TAX_RATE = 0.0825;

function lineItemsTotals(cartItems) {
  const subtotal = cartItems.reduce(
    (s, i) => s + Number(i.price) * Number(i.quantity),
    0
  );
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const totalCents = Math.round(total * 100);
  return { subtotal, tax, total, totalCents };
}

async function computeCartTotals(userId) {
  const [cartItems] = await pool.query(
    `SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = ?`,
    [userId]
  );
  if (!cartItems.length) return null;
  return { cartItems, ...lineItemsTotals(cartItems) };
}

module.exports = {
  TAX_RATE,
  lineItemsTotals,
  computeCartTotals
};
