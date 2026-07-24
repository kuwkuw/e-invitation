import { Route, Routes, useParams } from "react-router-dom";
import App from "./App";
import { GuestPage } from "./GuestPage";
import { LandingPage } from "./LandingPage";
import { ManagePage } from "./ManagePage";

/** Four flat screens, no nesting and no shared chrome — declarative mode is
 *  the whole of it (adr-011 §1):
 *
 *    /i/:id      → public guest page behind the share link
 *    /manage/:id → host response dashboard (needs the manage token)
 *    /create     → the editor
 *    /           → marketing landing page
 */

/** `:id` matches any non-empty segment, so an id that doesn't fit the server's
 *  shape still arrives here. The screens handle it: their hooks treat it as a
 *  dead link and never call the API with it (adr-011 §3), which is a better
 *  answer than the marketing page — someone following a broken share link
 *  needs to be told the link is broken. */
function GuestRoute() {
  const { id } = useParams();
  return <GuestPage id={id ?? ""} />;
}

function ManageRoute() {
  const { id } = useParams();
  return <ManagePage id={id ?? ""} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create" element={<App />} />
      <Route path="/i/:id" element={<GuestRoute />} />
      <Route path="/manage/:id" element={<ManageRoute />} />
      {/* Unknown paths land on the marketing page, as they did before. */}
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}
