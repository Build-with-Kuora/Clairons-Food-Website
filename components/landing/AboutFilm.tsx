"use client";

import { Pause, Play, Snowflake, Truck } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { temp } from "@/lib/format";
import { ROUTES } from "@/lib/seed";
import { EASE, FOOD, Frost, INK, MENU, RED, Van, Wheel, Words } from "./motifs";

/**
 * A short motion piece about Clairon's for the About section: who they are, what they make, how it is
 * packed and delivered, and the two ways to order. Plays when it scrolls into view, loops, and can be
 * paused or stepped. With reduced motion it waits for the viewer and shows each scene at rest.
 * Everything it says is already on the page; it makes no new claims.
 */
const SCENES = [
  { id: "open", label: "Who we are", ms: 4600 },
  { id: "menu", label: "What we make", ms: 5600 },
  { id: "case", label: "How it is packed", ms: 5400 },
  { id: "road", label: "How it gets to you", ms: 6200 },
  { id: "week", label: "When we deliver", ms: 4600 },
  { id: "end", label: "How to order", ms: 6000 },
] as const;
type SceneId = (typeof SCENES)[number]["id"];

const TICK = 100;
const WIPE = [0.76, 0, 0.24, 1] as const;
const VAN_TEMP = temp(ROUTES[0].setPointC, 0);

export function AboutFilm() {
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { amount: 0.5 });
  const still = useReducedMotion() ?? false;
  // `cut` counts every scene change, so the newest scene always stacks on top and wipes in over the last.
  const [{ scene, elapsed, cut }, setClock] = useState({ scene: 0, elapsed: 0, cut: 0 });
  const [paused, setPaused] = useState(false);
  const playing = inView && !paused && !still;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () =>
        setClock((c) =>
          c.elapsed + TICK < SCENES[c.scene].ms ? { ...c, elapsed: c.elapsed + TICK } : { scene: (c.scene + 1) % SCENES.length, elapsed: 0, cut: c.cut + 1 },
        ),
      TICK,
    );
    return () => clearInterval(t);
  }, [playing]);

  const go = (i: number) => setClock((c) => ({ scene: i, elapsed: 0, cut: c.cut + 1 }));
  const s = SCENES[scene];

  return (
    <figure className="lp-film" aria-roledescription="animation" aria-label="About Clairon's Food, a short animation">
      <div ref={box} className="lp-film-stage">
        <AnimatePresence initial={false}>
          <motion.div
            key={cut}
            className="absolute inset-0"
            style={{ zIndex: cut }}
            initial={still ? false : { clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            exit={{ opacity: 1, transition: { duration: 0.8 } }}
            transition={{ duration: 0.75, ease: WIPE }}
          >
            <Scene id={s.id} still={still} play={playing || still} />
          </motion.div>
          {!still && cut > 0 && (
            <motion.span
              key={`edge-${cut}`}
              className="lp-film-edge"
              style={{ zIndex: cut + 1 }}
              initial={{ left: "0%" }}
              animate={{ left: "100%" }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.75, ease: WIPE }}
              aria-hidden
            />
          )}
        </AnimatePresence>
        <div className="lp-film-grain" aria-hidden />
      </div>

      <figcaption className="lp-film-bar">
        <button
          type="button"
          className="lp-film-play"
          onClick={() => (still ? go((scene + 1) % SCENES.length) : setPaused((p) => !p))}
          aria-label={still ? "Next scene" : paused ? "Play" : "Pause"}
        >
          {still || paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
        </button>
        <ol className="lp-film-track">
          {SCENES.map((x, i) => (
            <li key={x.id} className="flex-1">
              <button type="button" className="lp-film-seg" onClick={() => go(i)} aria-label={x.label} aria-current={i === scene ? "step" : undefined}>
                <span className="lp-film-fill" style={{ width: i < scene ? "100%" : i === scene ? `${still ? 100 : (elapsed / x.ms) * 100}%` : "0%" }} />
              </button>
            </li>
          ))}
        </ol>
        <span className="lp-film-label" aria-live="polite">
          {s.label}
        </span>
      </figcaption>
    </figure>
  );
}

// Each word gets its own field, so the cuts read as cuts.
const FIELDS = ["red", "ink", "paper"] as const;

/* ---------- Scenes ---------- */

function Scene({ id, still, play }: { id: SceneId; still: boolean; play: boolean }) {
  switch (id) {
    case "open":
      return <Open still={still} />;
    case "menu":
      return <Menu still={still} play={play} />;
    case "case":
      return <Carton still={still} />;
    case "road":
      return <Road still={still} />;
    case "week":
      return <Week still={still} />;
    case "end":
      return <End still={still} />;
  }
}

function Open({ still }: { still: boolean }) {
  return (
    <div className="lp-film-field lp-film-ink">
      <motion.div className="absolute inset-0" initial={still ? false : { scale: 1.2 }} animate={{ scale: 1.02 }} transition={{ duration: 5.2, ease: "linear" }}>
        <Image src="/landing/clairons-building.jpg" alt="" fill sizes="(min-width: 1320px) 1272px, 100vw" className="object-cover object-[20%_55%]" />
      </motion.div>
      <div className="lp-film-shade absolute inset-0" />
      <motion.span
        className="lp-film-slash"
        initial={still ? false : { x: "-120%", skewX: -14 }}
        animate={{ x: "0%", skewX: -14 }}
        transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
        aria-hidden
      />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <motion.div
          className="w-[min(70%,480px)]"
          initial={still ? false : { opacity: 0, scale: 1.4, filter: "blur(16px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1, delay: 0.5, ease: EASE }}
        >
          <Image src="/brand/clairons-logo-reverse.png" alt="Clairon's Food" width={1478} height={596} sizes="480px" className="h-auto w-full drop-shadow-[0_10px_30px_rgb(0_0_0/0.55)]" />
        </motion.div>
        <p className="lp-display mt-5 text-[clamp(1.15rem,2.8vw,2.1rem)] leading-tight font-extrabold text-white">
          <Words text="Merienda and streetfood, made by us." delay={1.3} still={still} />
        </p>
        <p className="mt-2 text-[clamp(0.9rem,1.4vw,1.1rem)] text-white/85">
          <Words text="A Filipino-owned food maker." delay={1.9} step={0.05} still={still} />
        </p>
      </div>
    </div>
  );
}

function Menu({ still, play }: { still: boolean; play: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (still || !play) return;
    const t = setInterval(() => setI((n) => (n + 1) % MENU.length), 660);
    return () => clearInterval(t);
  }, [still, play]);

  if (still)
    return (
      <div className="lp-film-field lp-film-red">
        <div className="lp-film-pad flex h-full flex-col justify-center">
          <p className="lp-film-kicker">What we make</p>
          <p className="lp-display lp-film-list">{MENU.join(", ")}.</p>
        </div>
      </div>
    );

  const word = MENU[i];
  return (
    <div className={`lp-film-field lp-film-${FIELDS[i % FIELDS.length]}`}>
      <div className="lp-film-marquee" aria-hidden>
        <motion.div className="flex w-max gap-10" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
          {[...MENU, ...MENU].map((w, k) => (
            <span key={k}>{w}</span>
          ))}
        </motion.div>
      </div>
      <div className="lp-film-pad relative grid h-full grid-cols-1 content-center items-center gap-2 sm:grid-cols-[1fr_auto] sm:gap-6">
        <div className="order-2 sm:order-1">
          <p className="lp-film-kicker">What we make</p>
          <span className="lp-film-mask block">
            <motion.span
              key={word}
              className="lp-display lp-film-giant block"
              initial={{ y: "100%", skewY: 6 }}
              animate={{ y: "0%", skewY: 0 }}
              transition={{ duration: 0.42, ease: EASE }}
            >
              {word}
            </motion.span>
          </span>
        </div>
        <motion.svg
          key={word}
          viewBox="0 0 120 120"
          className="lp-film-food order-1 sm:order-2"
          initial={{ scale: 0.2, rotate: -45, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 15 }}
          aria-hidden
        >
          {FOOD[word]}
        </motion.svg>
      </div>
      <span className="lp-film-count" aria-hidden>
        {i + 1} of {MENU.length}
      </span>
    </div>
  );
}

function Carton({ still }: { still: boolean }) {
  const at = (delay: number) => (still ? { duration: 0 } : { delay });
  return (
    <motion.div
      className="lp-film-field lp-film-paper"
      animate={still ? undefined : { x: [0, 0, -12, 10, -7, 4, 0] }}
      transition={{ duration: 0.45, delay: 2.7, times: [0, 0.05, 0.25, 0.45, 0.65, 0.85, 1] }}
    >
      <Frost still={still} tone="dark" />
      <div className="lp-film-pad relative grid h-full content-center items-center gap-6 sm:grid-cols-[1fr_1fr] sm:gap-10">
        <div className="lp-film-box-wrap">
          <motion.div className="lp-film-box" initial={still ? false : { y: -320, rotate: -10 }} animate={{ y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 130, damping: 12 }}>
            <motion.span className="lp-film-flap lp-film-flap-l" initial={still ? false : { rotateX: 160 }} animate={{ rotateX: 0 }} transition={{ ...at(0.55), duration: 0.4, ease: EASE }} />
            <motion.span className="lp-film-flap lp-film-flap-r" initial={still ? false : { rotateX: 160 }} animate={{ rotateX: 0 }} transition={{ ...at(0.75), duration: 0.4, ease: EASE }} />
            <motion.span className="lp-film-tape" initial={still ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ ...at(1.15), duration: 0.45, ease: EASE }} />
            <motion.div
              className="lp-film-sticker"
              initial={still ? false : { scale: 1.7, rotate: -16, opacity: 0 }}
              animate={{ scale: 1, rotate: -3, opacity: 1 }}
              transition={{ ...at(1.6), type: "spring", stiffness: 380, damping: 18 }}
            >
              <div className="lp-display text-[1.15em] leading-tight font-extrabold">Siomai, pork</div>
              <div className="text-[0.8em] opacity-70">10 × 50 pcs</div>
              <div className="lp-film-rule">
                <span>Batch</span>
                <b>26279-04</b>
              </div>
              <div className="lp-film-rule">
                <span>Best by</span>
                <b>Apr 2027</b>
              </div>
            </motion.div>
            <motion.div
              className="lp-film-stamp"
              initial={still ? false : { scale: 2.8, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, opacity: 1, rotate: -12 }}
              transition={{ ...at(2.6), duration: 0.16, ease: "easeIn" }}
            >
              Keep frozen
              <span className="block text-[0.72em]">−18°C</span>
            </motion.div>
          </motion.div>
        </div>
        <div>
          <p className="lp-display lp-film-head">
            <Words text="Packed by the case." delay={0.4} still={still} />
          </p>
          <p className="lp-film-line mt-3">
            <Words text="Every batch gets its own number and a best-by date, so the oldest stock goes out first." delay={1} step={0.035} still={still} />
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function Road({ still }: { still: boolean }) {
  return (
    <div className="lp-film-field lp-film-ink">
      {/* Two layers of city scrolling at different speeds, then the road */}
      <div className="lp-film-city lp-film-city-far" aria-hidden />
      <div className="lp-film-city lp-film-city-near" aria-hidden />
      <div className="lp-film-road" aria-hidden>
        <div className="lp-film-lane" />
      </div>

      <div className="lp-film-pad relative">
        <p className="lp-display lp-film-head">
          <Words text="Our own refrigerated vans." delay={0.3} still={still} />
        </p>
        <p className="lp-film-line mt-2">
          <Words text="The temperature is logged at every stop. Riders take the small drops." delay={0.8} step={0.04} still={still} />
        </p>
      </div>

      <motion.div className="lp-film-van" initial={still ? false : { x: "-140%" }} animate={{ x: "0%" }} transition={{ duration: 1.5, ease: EASE }}>
        <motion.div animate={still ? undefined : { y: [0, -3, 0, -1.5, 0] }} transition={{ duration: 0.55, repeat: Infinity }}>
          <Van />
        </motion.div>
        <Wheel x="9%" still={still} />
        <Wheel x="72%" still={still} />
        <motion.span
          className="lp-film-temp"
          initial={still ? false : { scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={still ? { duration: 0 } : { delay: 1.6, type: "spring", stiffness: 420, damping: 13 }}
        >
          <Snowflake size={16} aria-hidden /> {VAN_TEMP}
        </motion.span>
      </motion.div>

      {!still && (
        <motion.span className="lp-film-rider" initial={{ left: "-20%" }} animate={{ left: "115%" }} transition={{ duration: 2.8, delay: 2.4, ease: [0.5, 0, 0.8, 0.6] }} aria-hidden>
          <svg viewBox="0 0 80 50" className="h-full w-auto">
            <circle cx="16" cy="38" r="10" fill={INK} stroke="#fff" strokeWidth="4" />
            <circle cx="64" cy="38" r="10" fill={INK} stroke="#fff" strokeWidth="4" />
            <path d="M16 38 L34 24 H52 L64 38 M34 24 L28 12 M52 24 L58 8" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
            <rect x="2" y="12" width="24" height="18" rx="3" fill={RED} stroke="#fff" strokeWidth="2" />
          </svg>
        </motion.span>
      )}
      <Frost still={still} />
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Week({ still }: { still: boolean }) {
  return (
    <div className="lp-film-field lp-film-red">
      <div className="lp-film-pad flex h-full flex-col justify-center">
        <p className="lp-display lp-film-giant">
          <Words text="Monday to Saturday." step={0.12} still={still} />
        </p>
        <ul className="lp-film-week" aria-hidden>
          {DAYS.map((d, i) => {
            const off = d === "Sun";
            return (
              <motion.li
                key={d}
                className={`lp-film-day ${off ? "lp-film-day-off" : ""}`}
                initial={still ? false : { rotateX: -100, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.13, duration: 0.5, ease: EASE }}
              >
                <span className="lp-display">{d}</span>
                {off ? (
                  <span className="text-[0.7em] font-bold">Rest</span>
                ) : (
                  <motion.span initial={still ? false : { x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 1 + i * 0.13 }}>
                    <Truck size={22} strokeWidth={2.4} />
                  </motion.span>
                )}
              </motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function End({ still }: { still: boolean }) {
  return (
    <div className="lp-film-field lp-film-ink">
      <div className="lp-film-marquee lp-film-marquee-big" aria-hidden>
        <motion.div className="flex w-max gap-12" animate={still ? undefined : { x: ["0%", "-50%"] }} transition={{ duration: 18, repeat: Infinity, ease: "linear" }}>
          {Array.from({ length: 6 }, (_, k) => (
            <span key={k}>Clairon&rsquo;s Food</span>
          ))}
        </motion.div>
      </div>
      <div className="lp-film-pad relative grid h-full content-center gap-4 sm:grid-cols-2 sm:gap-6">
        <motion.div initial={still ? false : { y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, delay: 0.2, ease: EASE }} className="lp-film-door lp-film-door-red">
          <p className="lp-display lp-film-head">For home</p>
          <p className="lp-film-line mt-2">A case or two from the online store. GCash, card, or cash on delivery.</p>
          <Link href="/shop" className="lp-btn lp-btn-paper mt-5">
            Shop online
          </Link>
        </motion.div>
        <motion.div initial={still ? false : { y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, delay: 0.45, ease: EASE }} className="lp-film-door lp-film-door-paper">
          <p className="lp-display lp-film-head">For your business</p>
          <p className="lp-film-line mt-2">Price lists, terms, and a spot on our van route.</p>
          <Link href="/contact#wholesale" className="lp-btn lp-btn-ink mt-5">
            Order wholesale
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
