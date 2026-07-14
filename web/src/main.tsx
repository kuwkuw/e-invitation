import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { GuestPage } from "./GuestPage";
import "./styles.css";

// Two-route app, resolved once at load: /i/:id is the public guest page
// behind the share link, everything else is the editor.
const guestId = window.location.pathname.match(/^\/i\/([A-Za-z0-9_-]{6,32})$/)?.[1];

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {guestId ? <GuestPage id={guestId} /> : <App />}
  </React.StrictMode>,
);
