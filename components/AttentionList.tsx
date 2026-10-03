import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Panel, cx } from "./ui";

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
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span className={cx(tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "accent" ? "text-accent" : "text-ink-3")}>{icon}</span>
          {title}
        </span>
      }
      actions={items.length ? <Badge tone={tone}>{items.length}</Badge> : undefined}
      bodyClass="max-h-[260px] overflow-y-auto scroll-thin"
    >
      {items.length === 0 ? (
        <p className="px-4 py-4 text-[14px] text-ink-3">{empty}</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {items.map((it) => (
            <li key={it.key}>
              <Link href={it.href} className="block px-4 py-2 hover:bg-sunk">
                <div className="truncate text-[14px] font-semibold">{it.main}</div>
                <div className="truncate text-[13px] text-ink-3">{it.side}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
