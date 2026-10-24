import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFdrs } from '../../api/client';
import { useAuth } from '../../auth';
import StatCard from '../../components/StatCard';
import FdrTable from '../../components/FdrTable';
import { daysUntil, formatINRShort } from '../../utils/format';

export default function InstitutionDashboard() {
  const { user } = useAuth();
  const [fdrs, setFdrs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFdrs({ institutionId: user.institutionId }).then((d) => { setFdrs(d); setLoading(false); });
  }, [user.institutionId]);

  const expiring = fdrs.filter((f) => { const d = daysUntil(f.maturityDate); return d >= 0 && d <= 90; });
  const total = fdrs.reduce((s, f) => s + f.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
          <p className="text-sm text-gray-500">Your security deposits lodged with AICTE</p>
        </div>
        <Link to="/institution/upload" className="rounded-md bg-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">+ Upload FDR</Link>
      </div>

      {expiring.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {expiring.length} FDR{expiring.length > 1 ? 's' : ''} mature within 90 days. Renew before maturity to stay compliant.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="FDRs lodged" value={fdrs.length} />
        <StatCard label="Total deposit" value={formatINRShort(total)} />
        <StatCard label="Maturing in 90 days" value={expiring.length} tone={expiring.length ? 'warn' : 'default'} />
        <StatCard label="Needs action" value={fdrs.filter((f) => f.status === 'CORRECTION_REQUESTED').length} tone="bad" />
      </div>

      <FdrTable fdrs={fdrs} loading={loading} showInstitution={false} />
    </div>
  );
}
