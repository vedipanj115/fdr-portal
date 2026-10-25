import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getFdr } from '../../api/client';
import { useAuth } from '../../auth';
import UploadFdr from './UploadFdr';

// Renewal = the Upload FDR form pre-filled from the FDR being replaced.
export default function RenewFdr() {
  const { id } = useParams();
  const { user } = useAuth();
  const [old, setOld] = useState(undefined);

  useEffect(() => { getFdr(id).then(setOld); }, [id]);

  if (old === undefined) return <p className="text-gray-500">Loading…</p>;
  if (!old || old.institution.id !== user.institutionId || !['ACTIVE', 'EXPIRING', 'EXPIRED'].includes(old.status)) {
    return (
      <div className="space-y-3">
        <p className="text-gray-700">This FDR can't be renewed.</p>
        <Link to="/institution/fdrs" className="text-sm text-navy-600 hover:underline">← Back to My FDRs</Link>
      </div>
    );
  }
  return <UploadFdr renewOf={old} />;
}
