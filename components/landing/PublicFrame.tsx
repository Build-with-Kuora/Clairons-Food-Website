import { Inter, Manrope } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { MobileMenu } from "./MobileMenu";
import "./landing.css";

/** The light version of the logo (white wordmark, red script), for the black header and footer. */
function ReverseLogo({ height }: { height: number }) {
  return <Image src="/brand/clairons-logo-reverse.png" alt="Clairon's Food" width={1478} height={596} preload unoptimized style={{ width: Math.round((1478 * height) / 596), height }} className="block shrink-0" />;
}

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["600", "700", "800"] });

type Page = "home" | "contact";

/** Header, footer and type for the public pages (landing and contact). */
export function PublicFrame({ page, children }: { page: Page; children: ReactNode }) {
  return (
    <div className={`lp ${inter.variable} ${manrope.variable} flex min-h-[100dvh] flex-col`}>
      <Header page={page} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

const NAV = [
  { href: "/#products", label: "Products" },
  { href: "/#delivery", label: "Delivery" },
  { href: "/#about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function Header({ page }: { page: Page }) {
  const current = page === "contact" ? "/contact" : undefined;
  return (
    <header className="lp-topbar sticky top-0 z-30">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center gap-3 px-4 sm:gap-8 sm:px-6">
        <Link href="/" aria-label="Clairon's Food, home">
          <ReverseLogo height={38} />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className="lp-navlink" aria-current={current === l.href ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/shop" className="lp-btn lp-btn-red lp-btn-sm ml-auto">
          Shop online
        </Link>
        <MobileMenu links={NAV} current={current} />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="lp-footbar">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-8 gap-y-5 px-4 py-10 sm:px-6">
        <ReverseLogo height={44} />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/shop" className="lp-navlink">
            Shop online
          </Link>
          <Link href="/#products" className="lp-navlink">
            Products
          </Link>
          <Link href="/#delivery" className="lp-navlink">
            Delivery
          </Link>
          <Link href="/contact" className="lp-navlink">
            Contact
          </Link>
          <Link href="/login" className="lp-navlink">
            Staff log in
          </Link>
        </nav>
        <p className="w-full text-[0.9rem] text-white/70 lg:ml-auto lg:w-auto">© 2026 Clairon&rsquo;s Food. Prototype: some photos and contact details are placeholders.</p>
      </div>
    </footer>
  );
}
