import { Route, Routes, useParams } from "react-router-dom";
import App from "./App";
import { GuestPage } from "./GuestPage";
import { isInvitationId } from "./invitationId";
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

/** `:id` matches any non-empty segment, so the id is validated here instead of
 *  by the route pattern (adr-011 §3). An id that doesn't fit the server's shape
 *  renders the landing page without ever reaching `fetchInvitation` — the same
 *  place the old regex resolver sent it. */
function GuestRoute() {
  const { id } = useParams();
  return isInvitationId(id) ? <GuestPage id={id} /> : <LandingPage />;
}

function ManageRoute() {
  const { id } = useParams();
  return isInvitationId(id) ? <ManagePage id={id} /> : <LandingPage />;
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
