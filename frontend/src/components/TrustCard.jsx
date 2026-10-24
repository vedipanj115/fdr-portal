// The Trust Card: for every FDR field, compare what the institution CLAIMED,
// what OCR EXTRACTED from the uploaded document, and what the BANK confirms.
import StatusBadge from './StatusBadge';
import { formatDate, formatINR } from '../utils/format';

const LABELS = {
  fdrNumber: 'FDR number',
  bankName: 'Bank',
  amount: 'Amount',
  issueDate: 'Issue date',
  maturityDate: 'Maturity date',
  beneficiary: 'In favour of',
};

function show(field, value) {
  if (value == null) return <span className="italic text-gray-400">not found</span>;
  if (field === 'amount') return formatINR(value);
  if (field.endsWith('Date')) return formatDate(value);
  return value;
}

export default function TrustCard({ verification }) {
  const { fields = [], score = 0, total = 0 } = verification || {};
  const allGood = total > 0 && score === total;

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div>
          <h2 className="font-semibold text-gray-900">Trust Card</h2>
          <p className="text-xs text-gray-500">Claimed by institution vs read from document vs confirmed by bank</p>
        </div>
        <div className={`rounded-md px-3 py-1 text-sm font-semibold ${allGood ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
          {score}/{total} fields verified
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">Claimed</th>
              <th className="px-4 py-2 font-medium">From document (OCR)</th>
              <th className="px-4 py-2 font-medium">Bank record</th>
              <th className="px-4 py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fields.map((f) => {
              const off = (v) => (f.result === 'MISMATCH' && v !== f.claimed ? 'font-semibold text-red-700' : '');
              return (
                <tr key={f.field} className={f.result === 'MATCH' ? '' : 'bg-red-50/30'}>
                  <td className="px-4 py-2.5 font-medium text-gray-700">{LABELS[f.field] || f.field}</td>
                  <td className="px-4 py-2.5">{show(f.field, f.claimed)}</td>
                  <td className={`px-4 py-2.5 ${off(f.extracted)}`}>{show(f.field, f.extracted)}</td>
                  <td className={`px-4 py-2.5 ${off(f.bank)}`}>{show(f.field, f.bank)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={f.result} /></td>
                </tr>
              );
            })}
            {fields.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Verification has not run yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
