"use client";

import { ChevronDown } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { FOOD, Frost } from "./motifs";

/**
 * The landing page's opening screen, after the film's first scene: their building pushing in under a dark
 * shade, red slashes, the logo slamming in, and drawn food floating around it that drifts with the
 * pointer. No headline, at the client's request (spec 11.2). With reduced motion everything sits still.
 */

// Where each food floats, as % of the hero, how big, how deep (parallax), and whether phones show it.
const FLOATERS = [
  { food: "Siopao", x: 13, y: 24, size: 1.15, depth: 34, phone: true },
  { food: "Siomai", x: 84, y: 20, size: 1, depth: 26, phone: true },
  { food: "Fish balls", x: 7, y: 66, size: 0.9, depth: 18, phone: false },
  { food: "Hakaw", x: 90, y: 62, size: 1.1, depth: 30, phone: false },
  { food: "Longganisa", x: 22, y: 86, size: 0.85, depth: 14, phone: true },
  { food: "Turon", x: 76, y: 86, size: 0.9, depth: 22, phone: true },
] as const;

export function Hero() {
  const still = useReducedMotion() ?? false;
  // Pointer position, −0.5 to 0.5 across the hero, eased so the food glides rather than jumps.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 18 });
  const sy = useSpring(py, { stiffness: 60, damping: 18 });

  return (
    <section
      className="lp-hero lp-grain relative isolate overflow-hidden"
      onPointerMove={(e) => {
        if (still || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
    >
      <div className="lp-hero-photo absolute inset-0 -z-20">
        <Image
          src="/landing/clairons-building.jpg"
          alt="The Clairon's Food Product building, its white sign listing siopao, siomai, meatball, patties, shanghai and flake ice."
          fill
          preload
          loading="eager"
          sizes="100vw"
          className="object-cover object-[30%_50%]"
        />
      </div>
      <div className="lp-hero-shade absolute inset-0 -z-10" aria-hidden />
      <span className="lp-hero-slash -z-10" aria-hidden />
      <span className="lp-hero-slash lp-hero-slash-2 -z-10" aria-hidden />
      <span className="lp-hero-flash -z-10" aria-hidden />
      <Frost still={still} />

      {FLOATERS.map((f, i) => (
        <Floater key={f.food} {...f} index={i} still={still} sx={sx} sy={sy} />
      ))}

      <div className="relative z-[2] mx-auto flex min-h-[calc(100dvh-72px)] max-w-[1440px] flex-col items-center justify-center px-6 py-16">
        <h1 className="lp-hero-logo w-[min(80vw,580px)]">
          <Image src="/brand/clairons-logo-reverse.png" alt="Clairon's Food" width={1478} height={596} preload sizes="(min-width: 1024px) 580px, 80vw" className="h-auto w-full drop-shadow-[0_12px_32px_rgb(0_0_0/0.6)]" />
        </h1>
        <div className="lp-hero-actions mt-10 flex flex-wrap justify-center gap-4 lg:mt-12">
          <Link href="/shop" className="lp-btn lp-btn-red lp-btn-lg lp-btn-pop">
            Shop online
          </Link>
          <Link href="/contact#wholesale" className="lp-btn lp-btn-light lp-btn-lg">
            Order wholesale
          </Link>
        </div>
      </div>

      <a href="#film" className="lp-hero-cue" aria-label="Scroll down">
        <ChevronDown size={28} strokeWidth={2.5} aria-hidden />
      </a>
    </section>
  );
}

function Floater({
  food,
  x,
  y,
  size,
  depth,
  phone,
  index,
  still,
  sx,
  sy,
}: {
  food: string;
  x: number;
  y: number;
  size: number;
  depth: number;
  phone: boolean;
  index: number;
  still: boolean;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
}) {
  // Deeper food moves further with the pointer, so the layers separate.
  const tx = useTransform(sx, (v) => v * -depth * 2);
  const ty = useTransform(sy, (v) => v * -depth * 2);
  return (
    <motion.div
      className={`lp-floater ${phone ? "" : "lp-floater-wide"}`}
      style={{ left: `${x}%`, top: `${y}%`, x: still ? 0 : tx, y: still ? 0 : ty, ["--s" as string]: size }}
      aria-hidden
    >
      <motion.div
        initial={still ? false : { scale: 0, rotate: -60, opacity: 0 }}
        animate={{ scale: 1, rotate: index % 2 ? 8 : -8, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 14, delay: 1.1 + index * 0.12 }}
      >
        <motion.svg
          viewBox="0 0 120 120"
          className="lp-floater-badge"
          animate={still ? undefined : { y: [0, -12, 0], rotate: [0, index % 2 ? 6 : -6, 0] }}
          transition={{ duration: 3.6 + index * 0.4, repeat: Infinity, ease: "easeInOut", delay: index * 0.3 }}
        >
          {FOOD[food]}
        </motion.svg>
      </motion.div>
    </motion.div>
  );
}

