import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { decideRefund, getAuditLog, getFdr } from '../../api/client';
import FdrSummary from '../../components/FdrSummary';
import FdrTimeline from '../../components/FdrTimeline';
import { daysUntil, formatDate } from '../../utils/format';

const CHECKS = [
  ['matured', 'FDR has matured'],
  ['noComplaints', 'No pending complaints against the institution'],
  ['documentReturned', 'Original FDR document returned to AICTE'],
];

export default function RefundDetail() {
  const { id } = useParams();
  const [fdr, setFdr] = useState(undefined);
  const [events, setEvents] = useState(null);
  const [checked, setChecked] = useState({});
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getFdr(id).then(setFdr);
    getAuditLog({ fdrId: id }).then(setEvents);
  }, [id]);

  if (fdr === undefined) return <p className="text-gray-500">Loading…</p>;
  if (fdr === null) return <p className="text-gray-500">FDR not found.</p>;

  const left = daysUntil(fdr.maturityDate);
  const allTicked = CHECKS.every(([k]) => checked[k]);
  const pending = fdr.status === 'REFUND_REQUESTED';
  const request = fdr.refundRequest;

  const decide = async (decision) => {
    setBusy(true);
    const checklist = Object.fromEntries(CHECKS.map(([k]) => [k, !!checked[k]]));
    setFdr(await decideRefund(fdr.id, decision, remarks.trim(), checklist));
    setEvents(await getAuditLog({ fdrId: fdr.id }));
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <Link to="/officer/refunds" className="text-sm text-navy-600 hover:underline">← Back to refund requests</Link>
      <FdrSummary fdr={fdr} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="font-semibold">Reason given by the institution</h2>
            {request ? (
              <>
                <p className="mt-2 text-sm text-gray-800">{request.reason}</p>
                <p className="mt-2 text-xs text-gray-500">Requested on {formatDate(request.requestedAt)}</p>
              </>
            ) : <p className="mt-2 text-sm text-gray-500">No refund request on this FDR.</p>}
          </section>

          {pending && (
            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="font-semibold">Refund checklist</h2>
              <p className="text-xs text-gray-500">Tick each item once you have confirmed it. Approval needs all three.</p>
              <ul className="mt-3 space-y-2">
                {CHECKS.map(([k, label]) => (
                  <li key={k}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-gray-50">
                      <input type="checkbox" checked={!!checked[k]} onChange={(e) => setChecked({ ...checked, [k]: e.target.checked })} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                      <span className="text-sm">
                        {label}
                        {k === 'matured' && (
                          <span className={`block text-xs ${left > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                            {left > 0 ? `Not yet: matures ${formatDate(fdr.maturityDate)} (in ${left} days)` : `Matured on ${formatDate(fdr.maturityDate)}`}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <label htmlFor="refund-remarks" className="mt-4 block text-sm font-medium text-gray-700">Remarks</label>
              <textarea id="refund-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Required to reject; optional when approving" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy || !allTicked} onClick={() => decide('APPROVE')} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve refund</button>
                <button disabled={busy || !remarks.trim()} onClick={() => decide('REJECT')} className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button>
              </div>
              {!allTicked && <p className="mt-2 text-xs text-gray-500">Approve unlocks when all three items are ticked.</p>}
            </section>
          )}

          {!pending && request?.decision && (
            <section className={`rounded-lg p-5 ring-1 ${request.decision === 'APPROVED' ? 'bg-emerald-50 ring-emerald-200' : 'bg-red-50 ring-red-200'}`}>
              <h2 className={`font-semibold ${request.decision === 'APPROVED' ? 'text-emerald-800' : 'text-red-700'}`}>
                {request.decision === 'APPROVED' ? 'Refund approved: FDR released' : 'Refund rejected: FDR returned to active'}
              </h2>
              {request.remarks && <p className="mt-1 text-sm text-gray-800">{request.remarks}</p>}
            </section>
          )}
        </div>

        <FdrTimeline fdr={fdr} events={events} />
      </div>
    </div>
  );
}
