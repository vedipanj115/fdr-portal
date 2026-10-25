import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAuditLog, getFdr, verifyFdr } from '../../api/client';
import TrustCard from '../../components/TrustCard';
import FdrTimeline from '../../components/FdrTimeline';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatINR } from '../../utils/format';

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

  const info = [
    ['Institution', `${fdr.institution.name} (${fdr.institution.id})`],
    ['State', fdr.institution.state],
    ['Bank / branch', `${fdr.bankName}, ${fdr.branch}`],
    ['IFSC', fdr.ifsc],
    ['Amount', formatINR(fdr.amount)],
    ['Issue → maturity', `${formatDate(fdr.issueDate)} → ${formatDate(fdr.maturityDate)}`],
  ];

  return (
    <div className="space-y-6">
      <Link to="/officer" className="text-sm text-navy-600 hover:underline">← Back to queue</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{fdr.fdrNumber}</h1>
        <StatusBadge status={fdr.status} />
        <span className="text-sm text-gray-500">{fdr.id}</span>
      </div>

      <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        {info.map(([k, v]) => (
          <div key={k}><dt className="text-xs text-gray-500">{k}</dt><dd className="text-sm font-medium text-gray-900">{v}</dd></div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <TrustCard verification={fdr.verification} />

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="font-semibold">Decision</h2>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Remarks for the institution (required for rejection or correction)" className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => decide('APPROVE')} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Approve</button>
              <button disabled={busy || !remarks} onClick={() => decide('CORRECTION')} className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">Ask for correction</button>
              <button disabled={busy || !remarks} onClick={() => decide('REJECT')} className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button>
            </div>
          </section>
        </div>

        <FdrTimeline fdr={fdr} events={events} />
      </div>
    </div>
  );
}
