// Shown after an FDR is uploaded: the automated checks ticking off, then the Trust Card.
import { Link } from 'react-router-dom';
import TrustCard from './TrustCard';

function StepIcon({ state }) {
  if (state === 'done') return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">✓</span>;
  if (state === 'running') return <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy-100 border-t-navy-700" />;
  return <span className="h-4 w-4 rounded-full border-2 border-gray-300" />;
}

export default function VerificationProgress({ fdr, steps, done, result, onUploadAnother }) {
  const running = steps.find((s) => !done.includes(s.key))?.key;
  const mismatches = result?.verification.fields.filter((f) => f.result !== 'MATCH').length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{result ? 'Verification complete' : 'Verifying your FDR…'}</h1>
        <p className="text-sm text-gray-500">{fdr.fdrNumber} · {fdr.bankName} · {fdr.id}</p>
      </div>

      <ol className="space-y-3 rounded-lg border border-gray-200 bg-white p-5" aria-live="polite">
        {steps.map((s) => {
          const state = done.includes(s.key) ? 'done' : s.key === running ? 'running' : 'pending';
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center"><StepIcon state={state} /></span>
              <span className={`text-sm ${state === 'pending' ? 'text-gray-400' : state === 'running' ? 'font-medium text-navy-800' : 'text-gray-900'}`}>
                {s.label}
                <span className="sr-only">{state === 'done' ? ' — done' : state === 'running' ? ' — in progress' : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {result && (
        <>
          {mismatches === 0 ? (
            <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
              All fields match the document and the bank's records. Your FDR has been sent to AICTE for scrutiny.
            </p>
          ) : (
            <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              {mismatches} {mismatches === 1 ? "field doesn't" : "fields don't"} match. Your FDR has been sent to AICTE; a Scrutiny Officer will review it and may ask you to correct it.
            </p>
          )}
          <TrustCard verification={result.verification} />
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onUploadAnother} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm">Upload another</button>
            <Link to="/institution/fdrs" state={{ highlightId: result.id }} className="rounded-md bg-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">
              View in My FDRs
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
