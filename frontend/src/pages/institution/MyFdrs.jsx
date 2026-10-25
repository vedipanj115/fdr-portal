import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getFdrs } from '../../api/client';
import { useAuth } from '../../auth';
import FdrTable from '../../components/FdrTable';

// TODO (Vedika): add Renew and Request refund buttons per row.
export default function MyFdrs() {
  const { user } = useAuth();
  const { state } = useLocation(); // { highlightId } after a fresh upload
  const [fdrs, setFdrs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFdrs({ institutionId: user.institutionId }).then((d) => { setFdrs(d); setLoading(false); });
  }, [user.institutionId]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My FDRs</h1>
      <FdrTable fdrs={fdrs} loading={loading} showInstitution={false} highlightId={state?.highlightId} />
    </div>
  );
}
