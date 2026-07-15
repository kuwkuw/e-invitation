import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { GuestPage } from "./GuestPage";
import { LandingPage } from "./LandingPage";
import "./styles.css";

// Routes resolved once at load:
//   /i/:id   → public guest page behind the share link
//   /create  → the editor
//   /        → marketing landing page
const path = window.location.pathname;
const guestId = path.match(/^\/i\/([A-Za-z0-9_-]{6,32})$/)?.[1];

function Root() {
  if (guestId) return <GuestPage id={guestId} />;
  if (path === "/create") return <App />;
  return <LandingPage onStart={() => (window.location.href = "/create")} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
