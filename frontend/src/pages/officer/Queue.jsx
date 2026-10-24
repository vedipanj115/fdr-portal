import { useEffect, useMemo, useState } from 'react';
import { getFdrs } from '../../api/client';
import FdrTable from '../../components/FdrTable';

const FILTERS = [
  ['pending', 'Pending scrutiny', (f) => ['SUBMITTED', 'UNDER_SCRUTINY'].includes(f.status)],
  ['flagged', 'Flagged', (f) => f.verification.score < f.verification.total],
  ['all', 'All', () => true],
];

export default function Queue() {
  const [fdrs, setFdrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');

  useEffect(() => { getFdrs().then((d) => { setFdrs(d); setLoading(false); }); }, []);

  const shown = useMemo(() => {
    const test = FILTERS.find(([k]) => k === filter)[2];
    const q = search.toLowerCase();
    return fdrs.filter(test).filter((f) => !q || [f.fdrNumber, f.institution.name, f.bankName, f.id].some((s) => s.toLowerCase().includes(q)));
  }, [fdrs, filter, search]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Scrutiny queue</h1>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, label, test]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-sm ${filter === k ? 'bg-navy-700 text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>
            {label} ({fdrs.filter(test).length})
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search institution, FDR no., bank" className="ml-auto w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm sm:w-72" />
      </div>
      <FdrTable fdrs={shown} loading={loading} linkTo={(f) => `/officer/fdr/${f.id}`} />
    </div>
  );
}
