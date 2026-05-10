import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/**
 * Wraps a route so only the admin account can access it.
 * Non-admins are silently redirected to /dashboard.
 */
export function AdminRoute({ children }) {
  const { user, userLoading } = useContext(AuthContext);
  if (userLoading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (user.username !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}
