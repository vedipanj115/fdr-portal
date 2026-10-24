import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import InstitutionDashboard from './pages/institution/Dashboard';
import MyFdrs from './pages/institution/MyFdrs';
import UploadFdr from './pages/institution/UploadFdr';
import Queue from './pages/officer/Queue';
import FdrDetail from './pages/officer/FdrDetail';
import AdminDashboard from './pages/admin/Dashboard';
import AuditLog from './pages/admin/AuditLog';

function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to={{ INSTITUTION: '/institution', OFFICER: '/officer', ADMIN: '/admin' }[user.role]} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route element={<RequireRole role="INSTITUTION"><Layout /></RequireRole>}>
        <Route path="/institution" element={<InstitutionDashboard />} />
        <Route path="/institution/fdrs" element={<MyFdrs />} />
        <Route path="/institution/upload" element={<UploadFdr />} />
      </Route>
      <Route element={<RequireRole role="OFFICER"><Layout /></RequireRole>}>
        <Route path="/officer" element={<Queue />} />
        <Route path="/officer/fdr/:id" element={<FdrDetail />} />
      </Route>
      <Route element={<RequireRole role="ADMIN"><Layout /></RequireRole>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/audit" element={<AuditLog />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
