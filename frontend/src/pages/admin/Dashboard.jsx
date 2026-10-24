import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getDashboardStats } from '../../api/client';
import StatCard from '../../components/StatCard';
import { formatDate, formatINRShort } from '../../utils/format';

// Time Machine: move "today" forward to show which FDRs will expire.
const JUMPS = [0, 30, 60, 90, 180, 365];

export default function AdminDashboard() {
  const [offset, setOffset] = useState(0);
  const [stats, setStats] = useState(null);
  const asOf = new Date(Date.now() + offset * 864e5);

  useEffect(() => { getDashboardStats(asOf).then(setStats); }, [offset]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">AICTE overview</h1>
          <p className="text-sm text-gray-500">All security-deposit FDRs as of {formatDate(asOf.toISOString())}</p>
        </div>
        <div className={`rounded-lg border px-3 py-2 ${offset ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white'}`}>
          <p className="text-xs font-medium text-gray-600">Time Machine {offset > 0 && <span className="text-violet-700">· simulating +{offset} days</span>}</p>
          <div className="mt-1 flex gap-1">
            {JUMPS.map((d) => (
              <button key={d} onClick={() => setOffset(d)} className={`rounded px-2 py-0.5 text-xs ${offset === d ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {d === 0 ? 'Today' : `+${d}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!stats ? <p className="text-gray-500">Loading…</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Total deposit held" value={formatINRShort(stats.totalAmount)} hint={`${stats.total} FDRs`} />
            <StatCard label="Active" value={stats.active} tone="good" />
            <StatCard label="Expiring in 30 days" value={stats.expiring30} tone="warn" />
            <StatCard label="Expired" value={stats.expired} tone="bad" />
            <StatCard label="Pending scrutiny" value={stats.pendingScrutiny} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {[['Deposit by state', stats.byState], ['Deposit by bank', stats.byBank]].map(([title, data]) => (
              <section key={title} className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold text-gray-700">{title}</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="#eef0f3" />
                    <XAxis type="number" tickFormatter={formatINRShort} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatINRShort(v)} />
                    <Bar dataKey="amount" fill="#1f4a8a" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
