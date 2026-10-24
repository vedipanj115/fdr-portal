// Colour meaning is fixed across the app:
// green = verified/active, amber = needs attention, red = mismatch/expired, blue = in progress.

const STYLES = {
  SUBMITTED: ['Submitted', 'bg-sky-50 text-sky-700 ring-sky-200'],
  UNDER_SCRUTINY: ['Under scrutiny', 'bg-sky-50 text-sky-700 ring-sky-200'],
  CORRECTION_REQUESTED: ['Correction requested', 'bg-amber-50 text-amber-800 ring-amber-200'],
  ACTIVE: ['Active', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  EXPIRING: ['Expiring soon', 'bg-amber-50 text-amber-800 ring-amber-200'],
  EXPIRED: ['Expired', 'bg-red-50 text-red-700 ring-red-200'],
  RENEWED: ['Renewed', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  REFUND_REQUESTED: ['Refund requested', 'bg-violet-50 text-violet-700 ring-violet-200'],
  REFUNDED: ['Refunded', 'bg-gray-100 text-gray-700 ring-gray-200'],
  REJECTED: ['Rejected', 'bg-red-50 text-red-700 ring-red-200'],
  MATCH: ['Match', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  MISMATCH: ['Mismatch', 'bg-red-50 text-red-700 ring-red-200'],
  MISSING: ['Missing', 'bg-amber-50 text-amber-800 ring-amber-200'],
};

export default function StatusBadge({ status }) {
  const [label, cls] = STYLES[status] || [status, 'bg-gray-100 text-gray-700 ring-gray-200'];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{label}</span>;
}
