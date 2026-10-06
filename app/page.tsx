import { HomeGate } from "@/components/HomeGate";
import { LANDING_METADATA, LandingPage } from "@/components/landing/LandingPage";

// Search engines and logged-out visitors get the landing page here, so it carries the landing page's title.
export const metadata = LANDING_METADATA;

/** The landing page for visitors, the Dashboard for admin and staff (spec 11.9). */
export default function Home() {
  return <HomeGate landing={<LandingPage />} />;
}
