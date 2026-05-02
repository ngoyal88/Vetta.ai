import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "shared/context/AuthContext";

type PrivateRouteProps = {
  children: ReactNode;
};

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/signin" />;
};

export default PrivateRoute;
