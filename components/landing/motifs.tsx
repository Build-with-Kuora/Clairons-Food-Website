"use client";

import { Snowflake, Truck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * The look shared by the public pages and the About film: masked word reveals, drawn food, drifting
 * snow, and the Clairon's van. Each piece takes `still` for people who turn off animation.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

/* ---------- Building blocks ---------- */

/**
 * Text that slides up out of a mask, the way titles come in on a cut. `onView` lets a parent that is
 * watching the viewport start it (see Headline): the word itself sits clipped by its mask, so it can't
 * be watched directly.
 */
export function Reveal({ children, delay = 0, still, onView, className }: { children: ReactNode; delay?: number; still: boolean; onView?: boolean; className?: string }) {
  const transition = { duration: 0.7, delay, ease: EASE };
  return (
    <span className={`lp-film-mask ${className ?? ""}`}>
      {onView ? (
        <motion.span className="inline-block" variants={still ? undefined : { hidden: { y: "110%" }, shown: { y: "0%", transition } }}>
          {children}
        </motion.span>
      ) : (
        <motion.span className="inline-block" initial={still ? false : { y: "110%" }} animate={{ y: "0%" }} transition={transition}>
          {children}
        </motion.span>
      )}
    </span>
  );
}

/** A line of words, each revealed a beat after the last. */
export function Words({ text, delay = 0, step = 0.08, still, onView }: { text: string; delay?: number; step?: number; still: boolean; onView?: boolean }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <Reveal key={i} delay={delay + i * step} still={still} onView={onView} className={i < words.length - 1 ? "mr-[0.26em]" : undefined}>
          {w}
        </Reveal>
      ))}
    </>
  );
}

/** Slow snow drifting across a scene. Fixed positions, so every play looks the same. */
const FLAKES = [
  [6, 12, 14, 0],
  [18, 70, 10, 1.2],
  [31, 35, 18, 0.4],
  [47, 82, 12, 2],
  [58, 18, 16, 0.8],
  [72, 60, 11, 1.6],
  [84, 28, 15, 0.2],
  [93, 76, 12, 1],
] as const;
export function Frost({ still, tone = "light" }: { still: boolean; tone?: "light" | "dark" }) {
  if (still) return null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {FLAKES.map(([x, y, size, delay], i) => (
        <motion.span
          key={i}
          className={`absolute ${tone === "light" ? "text-white/70" : "text-[#14161a]/25"}`}
          style={{ left: `${x}%`, top: `${y}%` }}
          initial={{ opacity: 0, y: -20, rotate: 0 }}
          animate={{ opacity: [0, 0.9, 0], y: 40, rotate: 120 }}
          transition={{ duration: 4.5, delay, repeat: Infinity, ease: "linear" }}
        >
          <Snowflake size={size} />
        </motion.span>
      ))}
    </div>
  );
}

/* ---------- Food, drawn flat in the logo's colours ---------- */

export const INK = "#14161a";
export const RED = "#d71f26";
const S = { stroke: INK, strokeWidth: 5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export const FOOD: Record<string, ReactNode> = {
  Siopao: (
    <>
      <path d="M14 84 Q14 30 60 28 Q106 30 106 84 Z" fill="#fff" {...S} />
      <path d="M44 40 Q52 48 60 38 Q68 48 76 40" fill="none" {...S} strokeWidth={4} />
      <circle cx="60" cy="58" r="7" fill={RED} />
      <path d="M8 88 H112" {...S} />
    </>
  ),
  Siomai: (
    <>
      <path d="M28 46 L36 96 Q60 104 84 96 L92 46" fill="#fff" {...S} />
      <path d="M26 46 Q34 36 42 46 Q50 36 60 46 Q70 36 78 46 Q86 36 94 46" fill="#fff" {...S} />
      <circle cx="60" cy="44" r="8" fill={RED} stroke={INK} strokeWidth={4} />
    </>
  ),
  Hakaw: (
    <>
      <path d="M12 78 Q60 8 108 78 Q60 96 12 78 Z" fill="#fff" {...S} />
      <path d="M40 42 L46 60 M56 32 L58 56 M70 34 L68 57 M82 44 L76 61" {...S} strokeWidth={4} />
      <path d="M48 76 Q60 66 72 76" fill="none" stroke={RED} strokeWidth={6} strokeLinecap="round" />
    </>
  ),
  "Fish balls": (
    <>
      <path d="M16 108 L104 14" {...S} />
      <circle cx="40" cy="82" r="16" fill="#fff" {...S} />
      <circle cx="60" cy="60" r="16" fill="#fff" {...S} />
      <circle cx="80" cy="38" r="16" fill="#fff" {...S} />
      <path d="M92 88 Q100 96 108 88" fill="none" stroke={RED} strokeWidth={6} strokeLinecap="round" />
    </>
  ),
  Kikiam: (
    <>
      <rect x="18" y="44" width="84" height="32" rx="16" fill={INK} {...S} transform="rotate(-18 60 60)" />
      <path d="M38 56 L44 70 M56 50 L62 64 M74 44 L80 58" stroke="#fff" strokeWidth={4} strokeLinecap="round" transform="rotate(-6 60 60)" />
    </>
  ),
  Tocino: (
    <>
      <path d="M14 70 Q34 42 60 58 Q86 74 106 46 L106 64 Q86 92 60 76 Q34 60 14 88 Z" fill={RED} {...S} />
      <path d="M30 70 Q46 60 60 67" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  Longganisa: (
    <>
      <ellipse cx="32" cy="74" rx="20" ry="13" fill={RED} {...S} transform="rotate(-30 32 74)" />
      <ellipse cx="62" cy="56" rx="20" ry="13" fill={RED} {...S} transform="rotate(-30 62 56)" />
      <ellipse cx="92" cy="38" rx="20" ry="13" fill={RED} {...S} transform="rotate(-30 92 38)" />
      <circle cx="47" cy="65" r="4" fill={INK} />
      <circle cx="77" cy="47" r="4" fill={INK} />
    </>
  ),
  Turon: (
    <>
      <rect x="14" y="44" width="92" height="32" rx="12" fill="#fff" {...S} transform="rotate(-24 60 60)" />
      <path d="M34 66 L40 48 M52 72 L58 52 M70 76 L76 56" stroke={RED} strokeWidth={6} strokeLinecap="round" transform="rotate(-10 60 60)" />
    </>
  ),
  Drumstick: (
    <>
      <path d="M70 18 Q104 18 104 50 Q104 78 74 80 L52 80 Q34 78 40 58 Q46 18 70 18 Z" fill="#fff" {...S} />
      <path d="M44 74 L24 96" {...S} strokeWidth={9} />
      <circle cx="18" cy="96" r="8" fill="#fff" {...S} />
      <circle cx="26" cy="104" r="8" fill="#fff" {...S} />
      <path d="M62 40 Q72 34 84 40" fill="none" stroke={RED} strokeWidth={6} strokeLinecap="round" />
    </>
  ),
  Fish: (
    <>
      <path d="M16 60 Q48 26 86 52 L106 34 L102 60 L106 86 L86 68 Q48 94 16 60 Z" fill="#fff" {...S} />
      <circle cx="36" cy="56" r="5" fill={INK} />
      <path d="M52 50 Q58 60 52 70 M64 48 Q70 60 64 72" fill="none" stroke={RED} strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  "Ice cream": (
    <>
      <path d="M26 50 H94 L88 104 H32 Z" fill="#fff" {...S} />
      <path d="M30 72 H90" stroke={RED} strokeWidth={8} />
      <path d="M30 50 Q30 24 60 24 Q90 24 90 50 Z" fill={RED} {...S} />
      <path d="M44 38 Q52 32 60 38" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  Flan: (
    <>
      <path d="M28 52 Q30 36 60 36 Q90 36 92 52 L98 84 Q60 98 22 84 Z" fill="#fff" {...S} />
      <path d="M28 52 Q60 64 92 52 Q90 36 60 36 Q30 36 28 52 Z" fill={RED} {...S} />
      <path d="M14 88 Q60 104 106 88" fill="none" {...S} />
    </>
  ),
  Fries: (
    <>
      <path d="M38 24 V60 M50 16 V60 M62 22 V60 M74 14 V60 M86 26 V60" stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <path d="M38 24 V60 M50 16 V60 M62 22 V60 M74 14 V60 M86 26 V60" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
      <path d="M28 48 H94 L86 106 H36 Z" fill={RED} {...S} />
      <path d="M44 66 Q61 76 78 66" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  Cheese: (
    <>
      <path d="M14 82 L96 34 L106 46 V86 H14 Z" fill="#fff" {...S} />
      <path d="M14 82 L96 34 L106 46 L24 92 Z" fill="#fff" {...S} />
      <circle cx="52" cy="76" r="6" fill={RED} />
      <circle cx="80" cy="70" r="4" fill={RED} />
      <circle cx="90" cy="80" r="5" fill={RED} />
    </>
  ),
  Buchi: (
    <>
      <circle cx="60" cy="62" r="38" fill="#fff" {...S} />
      <path d="M44 44 l4 2 M62 36 l4 -1 M78 48 l3 3 M40 66 l3 3 M58 58 l4 1 M76 70 l2 4 M50 82 l4 1 M68 86 l3 -2" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M44 100 Q60 108 76 100" fill="none" stroke={RED} strokeWidth={6} strokeLinecap="round" />
    </>
  ),
  Egg: (
    <>
      <ellipse cx="46" cy="64" rx="24" ry="30" fill="#fff" {...S} />
      <ellipse cx="78" cy="68" rx="24" ry="30" fill="#fff" {...S} />
      <circle cx="78" cy="70" r="10" fill={RED} />
    </>
  ),
};

/** Which drawing stands in for a product, by its name, until the client's photos arrive. Used by the menu board and the online store. */
export function foodFor(name: string) {
  const n = name.toLowerCase();
  const rules: [RegExp, string][] = [
    [/siopao|kuapao|mantou|pandesal|ensaymada/, "Siopao"],
    [/siomai/, "Siomai"],
    [/hakaw|machang/, "Hakaw"],
    [/ball|isaw|barbecue/, "Fish balls"],
    [/kikiam|hotdog|embutido|lumpia/, "Kikiam"],
    [/longganisa/, "Longganisa"],
    [/tocino|tapa|liempo|pata|spareribs/, "Tocino"],
    [/turon/, "Turon"],
    [/chicken|wing/, "Drumstick"],
    [/bangus|tempura|shrimp|squid/, "Fish"],
    [/ice cream/, "Ice cream"],
    [/flan|halaya/, "Flan"],
    [/fries/, "Fries"],
    [/cheese|keso/, "Cheese"],
    [/buchi/, "Buchi"],
    [/egg/, "Egg"],
  ];
  return rules.find(([re]) => re.test(n))?.[1] ?? "Siomai";
}

/** The eight shown in the ticker and the film. FOOD also has drawings for the rest of the catalogue. */
export const MENU = ["Siopao", "Siomai", "Hakaw", "Fish balls", "Kikiam", "Tocino", "Longganisa", "Turon"];

export function Van() {
  return (
    <svg viewBox="0 0 240 104" className="block h-auto w-full" aria-hidden>
      <rect x="6" y="10" width="150" height="80" rx="6" fill="#fff" stroke={INK} strokeWidth="5" />
      <path d="M156 34 H200 L230 62 V90 H156 Z" fill="#fff" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M166 43 H196 L215 62 H166 Z" fill={INK} />
      <rect x="8" y="64" width="146" height="10" fill={RED} />
      <text x="18" y="44" fontFamily="var(--font-manrope), sans-serif" fontWeight="800" fontSize="24" fill={INK}>
        Clairon&rsquo;s
      </text>
      <text x="92" y="60" fontFamily="var(--font-manrope), sans-serif" fontStyle="italic" fontWeight="800" fontSize="15" fill={RED}>
        Food
      </text>
      <rect x="220" y="74" width="10" height="8" fill={RED} />
    </svg>
  );
}

export function Wheel({ x, still }: { x: string; still: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 40 40"
      className="lp-film-wheel"
      style={{ left: x }}
      animate={still ? undefined : { rotate: 360 }}
      transition={{ duration: 0.45, repeat: Infinity, ease: "linear" }}
      aria-hidden
    >
      <circle cx="20" cy="20" r="18" fill={INK} />
      <circle cx="20" cy="20" r="8" fill="#fff" />
      <path d="M20 4 V12 M20 28 V36 M4 20 H12 M28 20 H36" stroke="#fff" strokeWidth="3" />
    </motion.svg>
  );
}

/* ---------- Pieces of the public pages ---------- */

/** A section title that comes in word by word as it scrolls into view. */
export function Headline({ text, className, as: Tag = "h2" }: { text: string; className?: string; as?: "h1" | "h2" | "h3" }) {
  const still = useReducedMotion() ?? false;
  return (
    <Tag className={className} aria-label={text}>
      <motion.span aria-hidden initial={still ? false : "hidden"} whileInView="shown" viewport={{ once: true, amount: 0.4 }}>
        <Words text={text} step={0.07} still={still} onView />
      </motion.span>
    </Tag>
  );
}

/** A band of menu names scrolling past, snowflake between each. */
export function MenuTicker({ outline = false }: { outline?: boolean }) {
  const items = [...MENU, ...MENU];
  return (
    <div className={`lp-ticker ${outline ? "lp-ticker-outline" : ""}`} aria-hidden>
      <div className="lp-ticker-row">
        {items.map((w, i) => (
          <span key={i} className="lp-ticker-item">
            {w}
            <Snowflake className="lp-ticker-flake" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** One drawn food, floating gently. */
export function FoodMark({ name, className }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={`lp-food ${className ?? ""}`} aria-hidden>
      {FOOD[name]}
    </svg>
  );
}

/** The van on the road, city scrolling behind, a rider passing now and then. Pure decoration. */
export function RoadBand({ temp }: { temp: string }) {
  const still = useReducedMotion() ?? false;
  return (
    <div className="lp-roadband" aria-hidden>
      <div className="lp-film-city lp-film-city-far" />
      <div className="lp-film-city lp-film-city-near" />
      <div className="lp-film-road">
        <div className="lp-film-lane" />
      </div>
      <div className="lp-roadband-van">
        <motion.div animate={still ? undefined : { y: [0, -3, 0, -1.5, 0] }} transition={{ duration: 0.55, repeat: Infinity }}>
          <Van />
        </motion.div>
        <Wheel x="9%" still={still} />
        <Wheel x="72%" still={still} />
        <span className="lp-film-temp">
          <Snowflake size={16} /> {temp}
        </span>
      </div>
      <span className="lp-roadband-rider">
        <svg viewBox="0 0 80 50" className="h-full w-auto">
          <circle cx="16" cy="38" r="10" fill={INK} stroke="#fff" strokeWidth="4" />
          <circle cx="64" cy="38" r="10" fill={INK} stroke="#fff" strokeWidth="4" />
          <path d="M16 38 L34 24 H52 L64 38 M34 24 L28 12 M52 24 L58 8" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          <rect x="2" y="12" width="24" height="18" rx="3" fill={RED} stroke="#fff" strokeWidth="2" />
        </svg>
      </span>
    </div>
  );
}

/** The delivery week as cards that flip down one by one when they scroll into view. */
export function DayCards({ days }: { days: string[] }) {
  const still = useReducedMotion() ?? false;
  return (
    <ul className="lp-film-week lp-days" aria-label="Delivery days: Monday to Saturday, no deliveries on Sunday">
      {days.map((d, i) => {
        const off = d === "Sun";
        return (
          <motion.li
            key={d}
            className={`lp-film-day ${off ? "lp-film-day-off" : ""}`}
            initial={still ? false : { rotateX: -100, opacity: 0 }}
            whileInView={{ rotateX: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: i * 0.1, duration: 0.5, ease: EASE }}
          >
            <span className="lp-display">{d}</span>
            {off ? <span className="text-[0.7em] font-bold">Rest</span> : <Truck size={20} strokeWidth={2.4} aria-hidden />}
          </motion.li>
        );
      })}
    </ul>
  );
}
