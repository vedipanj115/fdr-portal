// Modal asking the institution why it wants the deposit refunded.
import { useEffect, useState } from 'react';
import { formatDate, formatINR } from '../utils/format';

export default function RefundRequestDialog({ fdr, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onSubmit(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 px-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="refund-title" className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 id="refund-title" className="text-lg font-semibold">Request refund</h2>
        <p className="mt-1 text-sm text-gray-600">
          {fdr.fdrNumber} · {fdr.bankName} · {formatINR(fdr.amount)} · matures {formatDate(fdr.maturityDate)}
        </p>
        <label htmlFor="refund-reason" className="mt-4 block text-sm font-medium text-gray-700">Reason for refund</label>
        <textarea
          id="refund-reason"
          autoFocus
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Programme closed from AY 2026-27; security deposit no longer required"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">A Scrutiny Officer will review the request. The original FDR document must be returned to AICTE before the refund is released.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm">Cancel</button>
          <button disabled={busy || !reason.trim()} className="rounded-md bg-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50">
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  );
}
