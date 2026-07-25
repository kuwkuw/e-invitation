import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./AppRoutes";
import "./styles.css";

// The route table lives in AppRoutes so tests can drive it through a
// MemoryRouter; this file is only the browser entry point.
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Root element "#root" not found in index.html');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>,
);
