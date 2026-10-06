import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import Shell from "@/components/Shell";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Coldline | Clairon's Foods",
  description: "Order entry, cold-storage inventory and delivery tracking for Clairon's Foods.",
};

// Cover the whole screen so the phone bottom bar can pad for the home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Runs before the page paints: marks a login saved in this browser so / can hide the landing page until
 * the app has loaded (see components/HomeGate.tsx). "coldline-auth" is AUTH_KEY in lib/auth.ts.
 */
const SAVED_LOGIN = `try{var a=JSON.parse(localStorage.getItem("coldline-auth"));if(a&&a.state&&a.state.user)document.documentElement.dataset.auth="in"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script adds data-auth before React loads, so <html> differs from the server's on purpose.
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} ${plexMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SAVED_LOGIN }} />
      </head>
      <body className="min-h-full">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
