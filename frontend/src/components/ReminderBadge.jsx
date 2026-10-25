// Notification type badge. Amber = needs attention soon, red = escalated, blue = early notice.
const TYPES = {
  REMINDER_90: ['90-day reminder', 'bg-sky-50 text-sky-700 ring-sky-200'],
  REMINDER_60: ['60-day reminder', 'bg-sky-50 text-sky-700 ring-sky-200'],
  REMINDER_30: ['30-day reminder', 'bg-amber-50 text-amber-800 ring-amber-200'],
  REMINDER_7: ['7-day reminder', 'bg-amber-50 text-amber-800 ring-amber-200'],
  ESCALATED: ['Escalated to AICTE', 'bg-red-50 text-red-700 ring-red-200'],
};

export default function ReminderBadge({ type }) {
  const [label, cls] = TYPES[type] || [type, 'bg-gray-100 text-gray-700 ring-gray-200'];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{label}</span>;
}
