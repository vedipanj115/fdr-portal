// Indian formats used everywhere in the app.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-10-25' -> '25 Oct 2026'
export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// 10000000 -> '₹1,00,00,000'
export function formatINR(amount) {
  if (amount == null) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

// 10000000 -> '₹1 Cr', 2500000 -> '₹25 L'
export function formatINRShort(amount) {
  if (amount >= 1e7) return `₹${+(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${+(amount / 1e5).toFixed(2)} L`;
  return formatINR(amount);
}

// Days from `today` to `iso` (negative = already past)
export function daysUntil(iso, today = new Date()) {
  const t = new Date(today.toISOString().slice(0, 10));
  return Math.round((new Date(iso) - t) / 864e5);
}
