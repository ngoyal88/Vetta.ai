import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "shared/context/AuthContext";
import { BackendHealthProvider } from "shared/context/BackendHealthContext";
import { ConfirmDialogProvider } from "shared/context/ConfirmDialogContext";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";

if (process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    tracesSampleRate: 0.0,
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <BrowserRouter>
      <BackendHealthProvider>
        <ConfirmDialogProvider>
          <App />
        </ConfirmDialogProvider>
      </BackendHealthProvider>
    </BrowserRouter>
  </AuthProvider>
);
