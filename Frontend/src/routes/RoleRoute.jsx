import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_REDIRECTS } from "../utils/constants";
import Spinner from "../components/ui/Spinner";

export default function RoleRoute({ allowedRoles = [], children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8faf5] gap-3">
        <Spinner size="lg" className="text-[#166534]" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const fallback = ROLE_REDIRECTS[user.role] || "/";
    return <Navigate to={fallback} replace />;
  }

  return children ? children : <Outlet />;
}
