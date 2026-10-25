import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import NotificationBell from './NotificationBell';

const NAV = {
  INSTITUTION: [
    ['/institution', 'Dashboard'],
    ['/institution/fdrs', 'My FDRs'],
    ['/institution/upload', 'Upload FDR'],
  ],
  OFFICER: [
    ['/officer', 'Scrutiny queue'],
    ['/officer/refunds', 'Refund requests'],
  ],
  ADMIN: [
    ['/admin', 'Dashboard'],
    ['/admin/audit', 'Audit log'],
  ],
};

const ROLE_LABEL = { INSTITUTION: 'Institution', OFFICER: 'Scrutiny Officer', ADMIN: 'AICTE Admin' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <div className="h-1 bg-[linear-gradient(90deg,#ff9933_33%,#ffffff_33%_66%,#138808_66%)]" />
      <header className="bg-navy-800 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs text-navy-100">All India Council for Technical Education</p>
            <p className="font-semibold">Security Deposit / FDR Portal</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <NotificationBell />
            <span className="text-navy-100">{user.name} · {ROLE_LABEL[user.role]}</span>
            <button onClick={() => { logout(); navigate('/'); }} className="rounded-md border border-white/30 px-3 py-1 hover:bg-white/10">
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {NAV[user.role].map(([to, label]) => (
            <NavLink key={to} to={to} end={to.split('/').length === 2} className={({ isActive }) => `whitespace-nowrap border-b-2 px-3 py-2 text-sm ${isActive ? 'border-white font-semibold' : 'border-transparent text-navy-100 hover:text-white'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
