import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { formatDate, formatINR, daysUntil } from '../utils/format';

// Reusable FDR table. `linkTo(fdr)` decides where a row's FDR number links; `highlightId` marks a just-added row;
// `actions(fdr)` adds an Actions column.
const CLOSED = ['RENEWED', 'REFUNDED', 'REJECTED']; // maturity no longer matters

export default function FdrTable({ fdrs, loading, linkTo, showInstitution = true, highlightId, actions }) {
  if (loading) return <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">Loading FDRs…</div>;
  if (!fdrs.length) return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">No FDRs to show.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-2 font-medium">FDR</th>
            {showInstitution && <th className="px-4 py-2 font-medium">Institution</th>}
            <th className="px-4 py-2 font-medium">Bank</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
            <th className="px-4 py-2 font-medium">Matures</th>
            <th className="px-4 py-2 font-medium">Status</th>
            {actions && <th className="px-4 py-2 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {fdrs.map((f) => {
            const left = daysUntil(f.maturityDate);
            return (
              <tr key={f.id} className={f.id === highlightId ? 'bg-navy-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-2.5">
                  {linkTo ? <Link to={linkTo(f)} className="font-medium text-navy-600 hover:underline">{f.fdrNumber}</Link> : <span className="font-medium">{f.fdrNumber}</span>}
                  <p className="text-xs text-gray-500">{f.id}{f.id === highlightId && <span className="ml-2 font-semibold text-navy-700">New</span>}</p>
                </td>
                {showInstitution && <td className="px-4 py-2.5">{f.institution.name}<p className="text-xs text-gray-500">{f.institution.state}</p></td>}
                <td className="px-4 py-2.5">{f.bankName}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(f.amount)}</td>
                <td className="px-4 py-2.5">
                  {formatDate(f.maturityDate)}
                  <p className={`text-xs ${CLOSED.includes(f.status) ? 'text-gray-500' : left < 0 ? 'text-red-600' : left <= 30 ? 'text-amber-700' : 'text-gray-500'}`}>
                    {left < 0 ? `${-left} days ago` : `in ${left} days`}
                  </p>
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={f.status} /></td>
                {actions && <td className="px-4 py-2.5">{actions(f)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
