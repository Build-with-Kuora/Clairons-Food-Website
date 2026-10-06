"use client";

import { GripVertical, LayoutGrid, RotateCcw } from "lucide-react";
import { MotionConfig, Reorder, motion, useDragControls } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

export type Block = { id: string; label: string; node: ReactNode };

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

/** The page is scaled with CSS zoom on laptops (--ui-zoom); drag coordinates must be scaled back to match. */
function uiZoom() {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-zoom"));
  return z > 0 ? z : 1;
}

/**
 * A stack of blocks the user can rearrange. Each block keeps its own content and natural height; only the
 * order changes. Turn on "Rearrange" to show a grip on every block, drag by the grip. The order is remembered
 * per browser (a convenience, so storage failures are ignored).
 */
export function SortableBlocks({ storageKey, blocks, className }: { storageKey: string; blocks: Block[]; className?: string }) {
  const ids = blocks.map((b) => b.id);
  const [order, setOrder] = useState(ids);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        if (alive && Array.isArray(saved) && sameSet(saved, ids)) setOrder(saved);
      } catch {}
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const save = (next: string[]) => {
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  const byId = new Map(blocks.map((b) => [b.id, b]));
  const moved = order.some((id, i) => id !== ids[i]);

  return (
    <MotionConfig transformPagePoint={(p) => ({ x: p.x / uiZoom(), y: p.y / uiZoom() })}>
      <div className="mb-3 flex items-center justify-end gap-2">
        {editing && moved && (
          <button className="btn btn-quiet btn-sm" onClick={() => save(ids)}>
            <RotateCcw size={14} /> Reset order
          </button>
        )}
        <button className={cx("btn btn-sm", editing ? "btn-dark" : "btn-ghost")} onClick={() => setEditing(!editing)} aria-pressed={editing}>
          <LayoutGrid size={14} /> {editing ? "Done" : "Rearrange"}
        </button>
      </div>
      <Reorder.Group as="div" axis="y" values={order} onReorder={save} className={className}>
        {order.map((id) => {
          const b = byId.get(id);
          return b ? (
            <Item key={id} id={id} label={b.label} editing={editing}>
              {b.node}
            </Item>
          ) : null;
        })}
      </Reorder.Group>
    </MotionConfig>
  );
}

function Item({ id, label, editing, children }: { id: string; label: string; editing: boolean; children: ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      value={id}
      dragListener={false}
      dragControls={controls}
      className={cx("relative", editing && "rounded-2xl outline-2 outline-dashed outline-offset-4 outline-line-2")}
      whileDrag={{
        scale: 1.01,
        zIndex: 30,
        boxShadow: "0 24px 50px -20px rgba(0,0,0,0.35)",
      }}
    >
      {editing && (
        <button
          className="absolute top-2 left-1/2 z-10 flex h-7 -translate-x-1/2 cursor-grab touch-none items-center gap-1 rounded-full bg-ink px-3 text-[12px] font-semibold text-white active:cursor-grabbing"
          onPointerDown={(e) => controls.start(e)}
          aria-label={`Drag to move ${label}`}
        >
          <GripVertical size={14} aria-hidden /> {label}
        </button>
      )}
      <div className={cx(editing && "pointer-events-none select-none")}>{children}</div>
    </Reorder.Item>
  );
}

export type GridItem = { id: string; label: string; className?: string; node: ReactNode };

/**
 * Cards in a CSS grid the user can rearrange. Turn on "Rearrange", then drag a card onto another to swap
 * places. Cards keep their content and size. `items` may be a filtered subset: the saved order covers every
 * id ever seen, so hidden cards keep their place.
 */
export function SortableGrid({ storageKey, items, className }: { storageKey: string; items: GridItem[]; className?: string }) {
  const [order, setOrder] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const lastSwap = useRef(0);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        if (alive && Array.isArray(saved)) setOrder(saved);
      } catch {}
    });
    return () => {
      alive = false;
    };
  }, [storageKey]);

  const rank = new Map(order.map((id, i) => [id, i]));
  const shown = [...items].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));

  const save = (next: string[]) => {
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  /** Move `id` to where `target` sits, in the full saved order. */
  const swap = (id: string, target: string) => {
    const full = [...order, ...items.map((i) => i.id).filter((x) => !order.includes(x))];
    const from = full.indexOf(id);
    const to = full.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    full.splice(to, 0, full.splice(from, 1)[0]);
    save(full);
  };

  const onDrag = (id: string, x: number, y: number, root: HTMLElement | null, at: number) => {
    if (at - lastSwap.current < 220 || !root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-sort-id]")) {
      const target = el.dataset.sortId!;
      if (target === id) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        lastSwap.current = at;
        swap(id, target);
        return;
      }
    }
  };

  const root = useRef<HTMLDivElement>(null);
  const moved = order.length > 0;

  return (
    <MotionConfig transformPagePoint={(p) => ({ x: p.x / uiZoom(), y: p.y / uiZoom() })}>
      <div className="mb-3 flex items-center justify-end gap-2">
        {editing && moved && (
          <button className="btn btn-quiet btn-sm" onClick={() => save([])}>
            <RotateCcw size={14} /> Reset order
          </button>
        )}
        <button className={cx("btn btn-sm", editing ? "btn-dark" : "btn-ghost")} onClick={() => setEditing(!editing)} aria-pressed={editing}>
          <LayoutGrid size={14} /> {editing ? "Done" : "Rearrange"}
        </button>
      </div>
      <div ref={root} className={className}>
        {shown.map((it) => (
          <motion.div
            key={it.id}
            layout
            data-sort-id={it.id}
            drag={editing}
            dragSnapToOrigin
            dragMomentum={false}
            dragElastic={0}
            onDragStart={() => setDragging(it.id)}
            onDragEnd={() => setDragging(null)}
            onDrag={(e) => onDrag(it.id, (e as PointerEvent).clientX, (e as PointerEvent).clientY, root.current, e.timeStamp)}
            whileDrag={{ scale: 1.03, boxShadow: "0 24px 50px -20px rgba(0,0,0,0.35)" }}
            transition={{ type: "spring", visualDuration: 0.3, bounce: 0.1 }}
            style={{ zIndex: dragging === it.id ? 30 : 0 }}
            aria-label={editing ? `Drag to move ${it.label}` : undefined}
            className={cx("relative min-w-0 rounded-2xl", it.className, editing && "cursor-grab touch-none outline-2 outline-dashed outline-offset-2 outline-line-2 active:cursor-grabbing")}
          >
            <div className={cx("h-full", editing && "pointer-events-none select-none")}>{it.node}</div>
          </motion.div>
        ))}
      </div>
    </MotionConfig>
  );
}
