import { Navigate, Outlet, useLocation } from 'react-router-dom';

import type { UserRole } from './types';
import { useAuth } from './useAuth';
import { ForbiddenPage } from '../pages/ForbiddenPage';

type RequireAuthProps = {
  roles?: UserRole[];
};

export function RequireAuth({ roles }: RequireAuthProps) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
}
