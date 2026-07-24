import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";

import App from "./App";
import "./index.css";
import { AuthProvider } from "shared/context/AuthContext";
import { BackendHealthProvider } from "shared/context/BackendHealthContext";
import { ConfirmDialogProvider } from "shared/context/ConfirmDialogContext";
import QueryProvider from "shared/query/QueryProvider";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: 0.0,
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AuthProvider>
      <QueryProvider>
        <BrowserRouter>
          <BackendHealthProvider>
            <ConfirmDialogProvider>
              <App />
            </ConfirmDialogProvider>
          </BackendHealthProvider>
        </BrowserRouter>
      </QueryProvider>
    </AuthProvider>
  </React.StrictMode>,
);
