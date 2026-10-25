import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getFdrs, requestRefund } from '../../api/client';
import { useAuth } from '../../auth';
import FdrTable from '../../components/FdrTable';
import RefundRequestDialog from '../../components/RefundRequestDialog';

const CAN_CLOSE = ['ACTIVE', 'EXPIRING', 'EXPIRED']; // statuses that can be renewed or refunded

export default function MyFdrs() {
  const { user } = useAuth();
  const { state } = useLocation(); // { highlightId } after a fresh upload or renewal
  const [fdrs, setFdrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(null); // FDR whose refund dialog is open
  const [message, setMessage] = useState('');

  const load = () => getFdrs({ institutionId: user.institutionId }).then((d) => { setFdrs(d); setLoading(false); });
  useEffect(() => { load(); }, [user.institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitRefund = async (reason) => {
    const fdr = await requestRefund(refunding.id, reason);
    setRefunding(null);
    setMessage(`Refund requested for ${fdr.fdrNumber}. A Scrutiny Officer will review it.`);
    load();
  };

  const actions = (f) => (CAN_CLOSE.includes(f.status) ? (
    <div className="flex flex-wrap gap-2">
      <Link to={`/institution/fdrs/${f.id}/renew`} className="rounded-md border border-navy-600 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-50">Renew</Link>
      <button onClick={() => setRefunding(f)} className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Request refund</button>
    </div>
  ) : <span className="text-xs text-gray-400">—</span>);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My FDRs</h1>
      {message && (
        <p role="status" className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">{message}</p>
      )}
      <FdrTable fdrs={fdrs} loading={loading} showInstitution={false} highlightId={state?.highlightId} actions={actions} />
      {refunding && <RefundRequestDialog fdr={refunding} onSubmit={submitRefund} onClose={() => setRefunding(null)} />}
    </div>
  );
}
