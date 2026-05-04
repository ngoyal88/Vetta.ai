import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "shared/context/AuthContext";

type GuestRouteProps = {
  children: ReactNode;
};

/**
 * Renders children only when there is no signed-in user.
 * If already authenticated, redirects to the app (avoids /signin and /signup while logged in).
 */
const GuestRoute = ({ children }: GuestRouteProps) => {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

export default GuestRoute;
