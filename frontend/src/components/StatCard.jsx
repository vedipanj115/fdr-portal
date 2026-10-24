const TONES = {
  default: 'border-gray-200',
  good: 'border-l-4 border-l-emerald-500 border-gray-200',
  warn: 'border-l-4 border-l-amber-500 border-gray-200',
  bad: 'border-l-4 border-l-red-500 border-gray-200',
};

export default function StatCard({ label, value, hint, tone = 'default' }) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${TONES[tone]}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
