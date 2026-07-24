import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { GuestPage } from "./GuestPage";
import { LandingPage } from "./LandingPage";
import { ManagePage } from "./ManagePage";
import "./styles.css";

// Routes resolved once at load:
//   /i/:id      → public guest page behind the share link
//   /manage/:id → host response dashboard (needs the manage token)
//   /create     → the editor
//   /           → marketing landing page
const path = window.location.pathname;
// Same strict id shape as the store's InvitationId — it doubles as the guard.
const guestId = path.match(/^\/i\/([A-Za-z0-9_-]{6,32})$/)?.[1];
const manageId = path.match(/^\/manage\/([A-Za-z0-9_-]{6,32})$/)?.[1];

function Root() {
  if (guestId) return <GuestPage id={guestId} />;
  if (manageId) return <ManagePage id={manageId} />;
  if (path === "/create") return <App />;
  return <LandingPage onStart={() => (window.location.href = "/create")} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
