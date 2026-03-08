import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { ConfirmDialogProvider } from "./context/ConfirmDialogContext";
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
      <ConfirmDialogProvider>
        <App />
      </ConfirmDialogProvider>
    </BrowserRouter>
  </AuthProvider>
);
