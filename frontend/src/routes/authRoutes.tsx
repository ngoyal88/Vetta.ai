import { Route } from 'react-router-dom';

import SignIn from 'features/auth/pages/SignIn';
import SignUp from 'features/auth/pages/SignUp';
import GuestRoute from 'shared/components/GuestRoute';

export const authRoutes = (
  <>
    <Route
      path="/signin"
      element={
        <GuestRoute>
          <SignIn />
        </GuestRoute>
      }
    />
    <Route
      path="/signup"
      element={
        <GuestRoute>
          <SignUp />
        </GuestRoute>
      }
    />
  </>
);
