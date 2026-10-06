import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge, Panel, cx } from "./ui";

/** Items shown before "Show all", so the lists stay short and line up. */
const SHOWN = 5;

/** A short list of things to deal with, each linking to where it gets fixed. Used on both home pages. */
export function AttentionList({
  icon,
  tone,
  title,
  items,
  empty,
}: {
  icon: ReactNode;
  tone: "bad" | "warn" | "neutral" | "accent";
  title: string;
  items: { key: string; href: string; main: string; side: string }[];
  empty: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span className={cx(tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "accent" ? "text-accent" : "text-ink-3")}>{icon}</span>
          {title}
        </span>
      }
      actions={items.length ? <Badge tone={tone}>{items.length}</Badge> : undefined}
      bodyClass=""
    >
      {items.length === 0 ? (
        <p className="px-5 py-5 text-body text-ink-2 sm:px-6">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((it) => (
            <li key={it.key}>
              <Link href={it.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-sunk sm:px-6">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold">{it.main}</span>
                  <span className="mt-0.5 block text-small text-ink-2">{it.side}</span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > SHOWN && (
        <div className="border-t border-line px-5 py-3 sm:px-6">
          <button className="btn btn-ghost btn-sm w-full" onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `Show all ${items.length}`}
          </button>
        </div>
      )}
    </Panel>
  );
}
