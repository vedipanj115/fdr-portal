// Admin dashboard panel: reminders and escalations due in the next 90 days from the Time Machine date.
import { daysUntil, formatDate } from '../utils/format';
import ReminderBadge from './ReminderBadge';

function when(at, asOf) {
  const d = daysUntil(at.slice(0, 10), asOf);
  if (d === 0) return { text: 'Today', cls: 'text-amber-700' };
  if (d < 0) return { text: `${-d} days ago`, cls: 'text-red-600' };
  return { text: `in ${d} days`, cls: 'text-gray-500' };
}

export default function UpcomingReminders({ reminders, fdrs, asOf, days }) {
  const byId = Object.fromEntries((fdrs || []).map((f) => [f.id, f]));

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold">Upcoming reminders</h2>
        <p className="text-xs text-gray-500">{formatDate(asOf.toISOString())} – {formatDate(new Date(asOf.getTime() + days * 864e5).toISOString())} · open escalations included</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">FDR</th>
              <th className="px-4 py-2 font-medium">Institution</th>
              <th className="px-4 py-2 font-medium">Reminder</th>
              <th className="px-4 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!reminders && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>}
            {reminders?.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No reminders due in the next {days} days.</td></tr>}
            {reminders?.map((n) => {
              const f = byId[n.fdrId];
              const w = when(n.at, asOf);
              return (
                <tr key={n.id} className={n.type === 'ESCALATED' ? 'bg-red-50/40' : ''}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{f?.fdrNumber || n.fdrId}</span>
                    <p className="text-xs text-gray-500">{n.fdrId}</p>
                  </td>
                  <td className="px-4 py-2.5">{f?.institution.name || '—'}{f && <p className="text-xs text-gray-500">{f.institution.state}</p>}</td>
                  <td className="px-4 py-2.5"><ReminderBadge type={n.type} /></td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {formatDate(n.at)}
                    <p className={`text-xs ${w.cls}`}>{w.text}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
