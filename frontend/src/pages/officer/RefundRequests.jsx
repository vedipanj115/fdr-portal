import { useEffect, useState } from 'react';
import { getFdrs } from '../../api/client';
import FdrTable from '../../components/FdrTable';

export default function RefundRequests() {
  const [fdrs, setFdrs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getFdrs({ status: 'REFUND_REQUESTED' }).then((d) => { setFdrs(d); setLoading(false); }); }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Refund requests</h1>
        <p className="text-sm text-gray-500">Institutions asking for their security deposit back. Open one to run the checklist.</p>
      </div>
      <FdrTable fdrs={fdrs} loading={loading} linkTo={(f) => `/officer/refunds/${f.id}`} />
    </div>
  );
}
