// Lifecycle of one FDR, built from its audit-log entries (GET /audit-log?fdrId=).
// Each stage is reached when one of its audit actions is logged.
import { daysUntil, formatDate } from '../utils/format';

const STAGES = [
  { key: 'SUBMITTED', label: 'Submitted', actions: ['FDR_SUBMITTED'] },
  { key: 'UNDER_SCRUTINY', label: 'Under scrutiny', actions: ['SCRUTINY_STARTED'] },
  { key: 'VERIFIED', label: 'Verified', actions: ['FDR_APPROVED'] },
  { key: 'ACTIVE', label: 'Active', actions: ['FDR_ACTIVATED'] },
  { key: 'EXPIRING', label: 'Expiring', actions: ['REMINDER_30_SENT'] },
  { key: 'CLOSING', label: 'Renewed / Refund requested', actions: ['FDR_RENEWED', 'REFUND_REQUESTED'] },
  { key: 'REFUNDED', label: 'Refunded', actions: ['FDR_REFUNDED'] },
];

// FDR status -> index of the stage it is currently at
const CURRENT = {
  SUBMITTED: 0, UNDER_SCRUTINY: 1, CORRECTION_REQUESTED: 1, REJECTED: 1,
  ACTIVE: 3, EXPIRING: 4, EXPIRED: 4, RENEWED: 5, REFUND_REQUESTED: 5, REFUNDED: 6,
};

// Colour meaning is fixed: navy = in progress, amber = needs attention, red = rejected/expired.
const TONES = {
  navy: { dot: 'bg-navy-700 ring-navy-100', row: 'bg-navy-50', text: 'text-navy-800' },
  amber: { dot: 'bg-amber-500 ring-amber-200', row: 'bg-amber-50', text: 'text-amber-900' },
  red: { dot: 'bg-red-600 ring-red-200', row: 'bg-red-50', text: 'text-red-700' },
  green: { dot: 'bg-emerald-600 ring-emerald-200', row: 'bg-emerald-50', text: 'text-emerald-700' },
};

function latest(events, actions) {
  return events.find((e) => actions.includes(e.action)); // events are newest first
}

function stagesFor(status) {
  return STAGES
    .filter((s) => !(status === 'RENEWED' && s.key === 'REFUNDED')) // a renewal ends this FDR's lifecycle
    .map((s) => {
      if (s.key === 'EXPIRING' && status === 'EXPIRED') return { ...s, label: 'Expired' };
      if (s.key !== 'CLOSING') return s;
      if (status === 'RENEWED') return { ...s, label: 'Renewed' };
      if (['REFUND_REQUESTED', 'REFUNDED'].includes(status)) return { ...s, label: 'Refund requested' };
      return s;
    });
}

// Extra line and colour for the current stage when the FDR needs attention
function currentNote(fdr, events) {
  const left = daysUntil(fdr.maturityDate);
  switch (fdr.status) {
    case 'CORRECTION_REQUESTED':
      return { tone: 'amber', text: 'Correction requested — waiting for the institution', event: latest(events, ['CORRECTION_REQUESTED']) };
    case 'REJECTED':
      return { tone: 'red', text: 'Rejected', event: latest(events, ['FDR_REJECTED']) };
    case 'EXPIRING':
      return { tone: 'amber', text: `Matures ${formatDate(fdr.maturityDate)} (${left} ${left === 1 ? 'day' : 'days'} left)` };
    case 'EXPIRED':
      return { tone: 'red', text: `Matured ${formatDate(fdr.maturityDate)} — no renewal or refund request`, event: latest(events, ['FDR_EXPIRED']) };
    case 'REFUNDED':
      return { tone: 'green' };
    default:
      return { tone: 'navy' };
  }
}

function EventLine({ event, className = 'text-gray-500' }) {
  if (!event) return null;
  return <p className={`text-xs ${className}`}>{formatDate(event.at)} · {event.actor}</p>;
}

export default function FdrTimeline({ fdr, events }) {
  const stages = stagesFor(fdr.status);
  const current = Math.min(CURRENT[fdr.status] ?? 0, stages.length - 1);
  const note = currentNote(fdr, events || []);
  const tone = TONES[note.tone];

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="font-semibold">Lifecycle</h2>
      {!events ? (
        <p className="mt-3 text-sm text-gray-500">Loading…</p>
      ) : (
        <ol className="mt-4">
          {stages.map((stage, i) => {
            const event = latest(events, stage.actions);
            const state = i < current ? 'done' : i === current ? 'current' : 'upcoming';
            const last = i === stages.length - 1;
            return (
              <li key={stage.key} aria-current={state === 'current' ? 'step' : undefined} className="relative flex gap-3 pb-1">
                {!last && <span aria-hidden className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${i < current ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                <span aria-hidden className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                  {state === 'done' && event && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">✓</span>}
                  {state === 'done' && !event && <span className="h-3 w-3 rounded-full border-2 border-gray-300 bg-white" />}
                  {state === 'current' && <span className={`h-4 w-4 rounded-full ring-4 ${tone.dot}`} />}
                  {state === 'upcoming' && <span className="h-3 w-3 rounded-full border-2 border-gray-300 bg-white" />}
                </span>
                <div className={`mb-3 min-w-0 flex-1 rounded-md px-2 py-1 ${state === 'current' ? tone.row : ''}`}>
                  <p className={`text-sm ${state === 'current' ? `font-semibold ${tone.text}` : state === 'done' ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                    {stage.label}
                    {state === 'current' && <span className="sr-only"> (current stage)</span>}
                  </p>
                  {state === 'done' && (event ? <EventLine event={event} /> : <p className="text-xs italic text-gray-400">Skipped</p>)}
                  {state === 'current' && (
                    <>
                      <EventLine event={event} />
                      {note.text && <p className={`mt-0.5 text-xs font-medium ${tone.text}`}>{note.text}</p>}
                      {note.event && <EventLine event={note.event} />}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
