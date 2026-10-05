import { Archivo } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import "@/app/landing/landing.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

type Page = "home" | "contact";

/** Header, footer and type for the public pages (landing and contact). */
export function PublicFrame({ page, children }: { page: Page; children: ReactNode }) {
  return (
    <div className={`lp ${archivo.variable} flex min-h-[100dvh] flex-col`}>
      <Header page={page} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Header({ page }: { page: Page }) {
  return (
    <header className="lp-rule-b sticky top-0 z-30 bg-[var(--lp-board)]">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center gap-8 px-4 sm:px-6">
        <Link href="/landing" aria-label="Clairon's Food, home">
          <Logo height={38} />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          <Link href="/landing#products" className="lp-navlink">
            Products
          </Link>
          <Link href="/landing#delivery" className="lp-navlink">
            Delivery
          </Link>
          <Link href="/landing#about" className="lp-navlink">
            About
          </Link>
          <Link href="/contact" className="lp-navlink" aria-current={page === "contact" ? "page" : undefined}>
            Contact
          </Link>
        </nav>
        <Link href="/shop" className="lp-btn lp-btn-red lp-btn-sm ml-auto">
          Shop online
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="lp-rule-t">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-8 gap-y-5 px-4 py-8 sm:px-6">
        <Logo height={44} />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/shop" className="lp-navlink">
            Shop online
          </Link>
          <Link href="/landing#products" className="lp-navlink">
            Products
          </Link>
          <Link href="/landing#delivery" className="lp-navlink">
            Delivery
          </Link>
          <Link href="/contact" className="lp-navlink">
            Contact
          </Link>
          <Link href="/login" className="lp-navlink">
            Staff log in
          </Link>
        </nav>
        <p className="w-full text-[0.9rem] text-[var(--lp-ink-2)] lg:ml-auto lg:w-auto">© 2026 Clairon&rsquo;s Food. Prototype: some photos and contact details are placeholders.</p>
      </div>
    </footer>
  );
}
