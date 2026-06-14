import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from 'shared/context/AuthContext';
import {
  isEmailVerificationRequired,
  isUserEmailVerified,
} from 'shared/utils/emailVerificationGate';

type PrivateRouteProps = {
  children: ReactNode;
};

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { currentUser, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return null;
  }

  if (!currentUser) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  if (isEmailVerificationRequired() && !isUserEmailVerified(currentUser)) {
    return (
      <Navigate
        to="/verify-email"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  return <>{children}</>;
};

export default PrivateRoute;
