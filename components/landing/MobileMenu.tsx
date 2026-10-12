"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/** The header's links on phones, where the nav row is hidden: a button that drops the same links below the bar. */
export function MobileMenu({ links, current }: { links: { href: string; label: string }[]; current?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="lp-menu-btn"
        aria-expanded={open}
        aria-controls="lp-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={22} strokeWidth={2.5} aria-hidden /> : <Menu size={22} strokeWidth={2.5} aria-hidden />}
      </button>
      {open && (
        <nav id="lp-mobile-nav" aria-label="Main" className="lp-mobile-nav">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="lp-navlink" aria-current={current === l.href ? "page" : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
