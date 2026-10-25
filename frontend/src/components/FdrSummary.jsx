// FDR heading + key facts, shared by the officer's scrutiny and refund pages.
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { formatDate, formatINR } from '../utils/format';

export default function FdrSummary({ fdr }) {
  const info = [
    ['Institution', `${fdr.institution.name} (${fdr.institution.id})`],
    ['State', fdr.institution.state],
    ['Bank / branch', `${fdr.bankName}, ${fdr.branch}`],
    ['IFSC', fdr.ifsc],
    ['Amount', formatINR(fdr.amount)],
    ['Issue → maturity', `${formatDate(fdr.issueDate)} → ${formatDate(fdr.maturityDate)}`],
  ];
  if (fdr.renewalOf) info.push(['Renewal of', <Link key="of" to={`/officer/fdr/${fdr.renewalOf}`} className="text-navy-600 hover:underline">{fdr.renewalOf}</Link>]);
  if (fdr.renewedBy) info.push(['Renewed by', <Link key="by" to={`/officer/fdr/${fdr.renewedBy}`} className="text-navy-600 hover:underline">{fdr.renewedBy}</Link>]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{fdr.fdrNumber}</h1>
        <StatusBadge status={fdr.status} />
        <span className="text-sm text-gray-500">{fdr.id}</span>
      </div>
      <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        {info.map(([k, v]) => (
          <div key={k}><dt className="text-xs text-gray-500">{k}</dt><dd className="text-sm font-medium text-gray-900">{v}</dd></div>
        ))}
      </dl>
    </>
  );
}
