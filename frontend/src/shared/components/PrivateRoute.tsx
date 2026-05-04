import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "shared/context/AuthContext";

type PrivateRouteProps = {
  children: ReactNode;
};

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  return currentUser ? (
    <>{children}</>
  ) : (
    <Navigate
      to="/signin"
      replace
      state={{
        from: `${location.pathname}${location.search}${location.hash}`,
      }}
    />
  );
};

export default PrivateRoute;
