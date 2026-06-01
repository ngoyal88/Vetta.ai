import { Navigate, Route } from 'react-router-dom';

export const legacyRedirects = (
  <>
    <Route path="/role-targeted" element={<Navigate to="/ai-interview/role-targeted" replace />} />
    <Route path="/modes" element={<Navigate to="/ai-interview" replace />} />
    <Route path="/modes/role-targeted" element={<Navigate to="/ai-interview/role-targeted" replace />} />
    <Route path="/modes/pressure-mode" element={<Navigate to="/ai-interview/pressure-mode" replace />} />
    <Route path="/modes/resume-deep-dive" element={<Navigate to="/ai-interview/resume-deep-dive" replace />} />
    <Route path="/modes/blind-mode" element={<Navigate to="/ai-interview/blind-mode" replace />} />
    <Route path="/modes/pair-programming" element={<Navigate to="/ai-interview/pair-programming" replace />} />
    <Route path="/history" element={<Navigate to="/ai-interview/history" replace />} />
  </>
);
