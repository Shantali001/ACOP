import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

export function HomeRedirectPage() {
  const { user } = useAuth();

  return <Navigate to={user?.role === 'AGENT' ? '/agent/dashboard' : '/admin/dashboard'} replace />;
}
