"use client";

import { useContext, useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Dashboard } from "./Dashboard";
import { Boot, BootedContext } from "./Shell";

const APP_TITLE = "Coldline | Clairon's Foods";

/**
 * Picks what / shows. Logins live in the browser, so the server always sends the landing page. Until the
 * app has loaded, the script in app/layout.tsx marks a saved login and CSS (`.home-public`, `.home-boot` in
 * globals.css) swaps the landing page for the loading line, so a logged-in owner never sees it flash.
 */
export function HomeGate({ landing }: { landing: ReactNode }) {
  const booted = useContext(BootedContext);
  const user = useAuth((s) => s.user);

  // Once loaded the gate decides, so the mark must not hide the landing page after logging out.
  useEffect(() => {
    if (booted) delete document.documentElement.dataset.auth;
  }, [booted]);

  if (booted && user) return <AppHome />;
  return (
    <>
      <div className="home-public">{landing}</div>
      {!booted && (
        <div className="home-boot">
          <Boot />
        </div>
      )}
    </>
  );
}

function AppHome() {
  // The page's metadata is the landing page's; staff should see the app's name on the tab.
  useEffect(() => {
    document.title = APP_TITLE;
  }, []);
  return <Dashboard />;
}
