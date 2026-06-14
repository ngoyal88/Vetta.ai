import { Navigate, Route } from 'react-router-dom';

import ContactPage from 'features/website/pages/ContactPage';
import HomePage from 'features/website/pages/HomePage';
import PricingPage from 'features/website/pages/PricingPage';

export const websiteRoutes = (
  <>
    <Route path="/" element={<HomePage />} />
    <Route path="/contact" element={<ContactPage />} />
    <Route path="/pricing" element={<PricingPage />} />
    <Route
      path="/docs"
      element={<Navigate to={{ pathname: '/', hash: '#assessment' }} replace />}
    />
    <Route
      path="/privacy"
      element={<Navigate to={{ pathname: '/', hash: '#privacy' }} replace />}
    />
    <Route
      path="/terminal"
      element={<Navigate to={{ pathname: '/', hash: '#system-status' }} replace />}
    />
  </>
);
