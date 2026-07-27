import { Route, Routes, useLocation, useParams } from "react-router-dom";
import App from "./App";
import { CrashScreen } from "./components/CrashScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
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

/** The route table sits behind one error boundary, here rather than in
 *  `main.tsx`, so the tests' MemoryRouter is under the same net as the browser
 *  entry point. Declarative mode has no `errorElement` (adr-011 §1), so an
 *  uncaught render throw on any of the four screens takes the whole tree down
 *  to a blank `<body>` — this is what stands between that and the user.
 *
 *  The guest gets its own wording: someone following a share link can't retry
 *  as a host would, and the only thing they can do is ask for a fresh link. */
export function AppRoutes() {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary
      // Recovery for a navigation the fallback itself didn't start — the
      // browser's back button, most of all, which would otherwise leave the
      // crash screen sitting at a perfectly healthy URL.
      resetKey={pathname}
      fallback={<CrashScreen audience={pathname.startsWith("/i/") ? "guest" : "host"} />}
    >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<App />} />
        <Route path="/i/:id" element={<GuestRoute />} />
        <Route path="/manage/:id" element={<ManageRoute />} />
        {/* Unknown paths land on the marketing page, as they did before. */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
