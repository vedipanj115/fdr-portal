// Fake login for the idea round: pick a role, no password check.
// Replace with POST /auth/login once the backend is ready.
import { createContext, useContext, useState } from 'react';

const DEMO_USERS = {
  INSTITUTION: { name: 'Shree Ganesh Institute of Technology', role: 'INSTITUTION', institutionId: 'INST-1-4412093' },
  OFFICER: { name: 'R. Sharma', role: 'OFFICER' },
  ADMIN: { name: 'AICTE Admin', role: 'ADMIN' },
};

const AuthContext = createContext(null);

function load() {
  try { return JSON.parse(localStorage.getItem('fdr-user')); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(load);
  const login = (role) => {
    const u = DEMO_USERS[role];
    setUser(u);
    try { localStorage.setItem('fdr-user', JSON.stringify(u)); } catch { /* storage unavailable */ }
    return u;
  };
  const logout = () => {
    setUser(null);
    try { localStorage.removeItem('fdr-user'); } catch { /* storage unavailable */ }
  };
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
