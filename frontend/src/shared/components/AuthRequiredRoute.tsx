import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from 'shared/context/AuthContext';

type AuthRequiredRouteProps = {
  children: ReactNode;
};

/** Requires a signed-in user; does not enforce email verification. */
const AuthRequiredRoute = ({ children }: AuthRequiredRouteProps) => {
  const { currentUser, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return null;
  }

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

export default AuthRequiredRoute;
