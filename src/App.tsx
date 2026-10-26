import { AppProvider, useApp } from './lib/store';
import { useGlobalTilt } from './components/fx';
import Login from './pages/Login';
import Shield from './pages/Shield';
import Shell from './components/Shell';
import Overview from './pages/officer/Overview';
import Register from './pages/officer/Register';
import DepositDetail from './pages/DepositDetail';
import { VerifyQueue, Maturity, Releases } from './pages/officer/Workflows';
import { Alerts, Reports, Audit, Integrations, Settings } from './pages/officer/Governance';
import Automation from './pages/officer/Automation';
import { Institutions, InstitutionDetail, Vault } from './pages/officer/Records';
import { InstDashboard, MyDeposits, Submit, Renew, ReleaseRequest, InstDocuments, Notices } from './pages/institution/Institution';
import { BankDashboard, Desk, Lien, Bulk, Esign } from './pages/bank/Bank';

function Router() {
  const { user, route, ready } = useApp();
  useGlobalTilt();
  if (!ready) return <div className="bootload" role="status"><span className="spin" />Connecting to the SDFP server…</div>;
  if (!user) return route.page === 'shield' ? <Shield /> : <Login />;
  const p = route.page, id = route.id;
  let page: JSX.Element;
  if (p === 'deposit' && id) page = <DepositDetail id={id} />;
  else if (user.role === 'officer') {
    page = ({ home: <Overview />, register: <Register />, alerts: <Alerts />, verify: <VerifyQueue />, maturity: <Maturity />, releases: <Releases />, reports: <Reports />, audit: <Audit />, integrations: <Integrations />, settings: <Settings />, automation: <Automation />, institutions: <Institutions />, vault: <Vault /> } as Record<string, JSX.Element>)[p]
      || (p === 'institution' && id ? <InstitutionDetail id={id} /> : <Overview />);
  } else if (user.role === 'institution') {
    page = ({ home: <InstDashboard />, deposits: <MyDeposits />, submit: <Submit key="new" />, renew: <Renew />, release: <ReleaseRequest />, documents: <InstDocuments />, notices: <Notices /> } as Record<string, JSX.Element>)[p] || <InstDashboard />;
  } else {
    page = ({ home: <BankDashboard />, desk: <Desk key={id || 'desk'} />, lien: <Lien />, bulk: <Bulk />, esign: <Esign /> } as Record<string, JSX.Element>)[p] || <BankDashboard />;
  }
  return <Shell key={user.id}>{page}</Shell>;
}

export default function App() { return <AppProvider><Router /></AppProvider>; }
