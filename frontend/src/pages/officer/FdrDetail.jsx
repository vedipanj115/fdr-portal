import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAuditLog, getFdr, verifyFdr } from '../../api/client';
import TrustCard from '../../components/TrustCard';
import FdrTimeline from '../../components/FdrTimeline';
import FdrSummary from '../../components/FdrSummary';

// The scrutiny decision only applies before an FDR is accepted
const AWAITING_SCRUTINY = ['SUBMITTED', 'UNDER_SCRUTINY', 'CORRECTION_REQUESTED'];

export default function FdrDetail() {
  const { id } = useParams();
  const [fdr, setFdr] = useState(undefined);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState(null);

  useEffect(() => {
    getFdr(id).then(setFdr);
    getAuditLog({ fdrId: id }).then(setEvents);
  }, [id]);

  if (fdr === undefined) return <p className="text-gray-500">Loading…</p>;
  if (fdr === null) return <p className="text-gray-500">FDR not found.</p>;

  const decide = async (decision) => {
    setBusy(true);
    setFdr(await verifyFdr(fdr.id, decision, remarks));
    setEvents(await getAuditLog({ fdrId: fdr.id }));
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <Link to="/officer" className="text-sm text-navy-600 hover:underline">← Back to queue</Link>
      <FdrSummary fdr={fdr} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <TrustCard verification={fdr.verification} />

          {fdr.status === 'REFUND_REQUESTED' && (
            <p className="rounded-md bg-violet-50 px-4 py-3 text-sm text-violet-800 ring-1 ring-violet-200">
              The institution has asked for a refund. <Link to={`/officer/refunds/${fdr.id}`} className="font-semibold underline">Review the refund request</Link>
            </p>
          )}

          {AWAITING_SCRUTINY.includes(fdr.status) && (
            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="font-semibold">Decision</h2>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Remarks for the institution (required for rejection or correction)" className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => decide('APPROVE')} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Approve</button>
                <button disabled={busy || !remarks} onClick={() => decide('CORRECTION')} className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">Ask for correction</button>
                <button disabled={busy || !remarks} onClick={() => decide('REJECT')} className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button>
              </div>
            </section>
          )}
        </div>

        <FdrTimeline fdr={fdr} events={events} />
      </div>
    </div>
  );
}
