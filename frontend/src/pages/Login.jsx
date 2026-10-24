import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const HOME = { INSTITUTION: '/institution', OFFICER: '/officer', ADMIN: '/admin' };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('INSTITUTION');

  const submit = (e) => {
    e.preventDefault();
    login(role);
    navigate(HOME[role]);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-1 bg-[linear-gradient(90deg,#ff9933_33%,#ffffff_33%_66%,#138808_66%)]" />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-navy-600">AICTE</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">Security Deposit / FDR Portal</h1>
          <p className="mt-1 text-sm text-gray-500">Demo login — choose a role to explore.</p>

          <label className="mt-6 block text-sm font-medium text-gray-700">Email</label>
          <input type="email" placeholder="you@institute.edu.in" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none" />

          <label className="mt-4 block text-sm font-medium text-gray-700">Password</label>
          <input type="password" placeholder="••••••••" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none" />

          <label className="mt-4 block text-sm font-medium text-gray-700">Log in as</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="INSTITUTION">Institution</option>
            <option value="OFFICER">Scrutiny Officer</option>
            <option value="ADMIN">AICTE Admin</option>
          </select>

          <button className="mt-6 w-full rounded-md bg-navy-700 py-2 text-sm font-semibold text-white hover:bg-navy-800">Log in</button>
        </form>
      </div>
    </div>
  );
}
