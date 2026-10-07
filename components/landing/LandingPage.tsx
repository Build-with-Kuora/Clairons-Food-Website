import { Bike, Truck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicFrame } from "./PublicFrame";
import { NextDeliveryStamp } from "./NextDeliveryStamp";
import { money0 } from "@/lib/format";
import { DROP_FEE, DROP_MIN, FUEL_FEE, SERVICE_AREAS } from "@/lib/logic";
import { ROUTES } from "@/lib/seed";


/** Title and description for search engines; used by the home page, which shows this page to logged-out visitors. */
export const LANDING_METADATA: Metadata = {
  title: "Clairon's Food | Frozen siopao, siomai and merienda, delivered across Iloilo and Western Visayas",
  description: "Clairon's Food makes siopao, siomai, fishballs, tocino and more, and delivers them frozen, Monday to Saturday.",
};

type Item = [name: string, pack: string, price: number];

// Online (tier C) case prices, matching the store's catalogue in lib/seed.ts.
const DIMSUM: Item[] = [
  ["Siomai, pork, Japanese style", "10 × 50 pcs", 2145],
  ["Siomai, shrimp and pork", "10 × 40 pcs", 2585],
  ["Siopao asado, large", "6 × 12 pcs", 1738],
  ["Siopao bola-bola, large", "6 × 12 pcs", 1815],
  ["Hakaw, shrimp dumpling", "10 × 30 pcs", 2695],
  ["Lumpiang shanghai", "12 × 20 pcs", 1595],
];
const STREET: Item[] = [
  ["Fish balls", "10 × 1 kg", 935],
  ["Squid balls", "10 × 1 kg", 1210],
  ["Kikiam", "10 × 1 kg", 1045],
  ["Pork barbecue, on stick", "8 × 25 sticks", 2860],
];
const BREAKFAST: Item[] = [
  ["Pork tocino", "10 × 1 kg", 2640],
  ["Longganisa, Vigan garlic", "10 × 1 kg", 2530],
  ["Longganisa, Lucban", "10 × 1 kg", 2420],
  ["Beef tapa", "10 × 1 kg", 4290],
];
const SWEET: Item[] = [
  ["Ice cream, ube", "3 gal tub", 1485],
  ["Leche flan", "12 × 1 pc", 1265],
  ["Turon", "10 × 20 pcs", 2200],
  ["Ensaymada", "6 × 12 pcs", 1595],
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CITIES = Object.keys(SERVICE_AREAS);

/** The public home page (spec 11). Shown at / to anyone not logged in. */
export function LandingPage() {
  return (
    <PublicFrame page="home">
      <Hero />
      <Contents />
      <ColdChain />
      <Doors />
      <About />
    </PublicFrame>
  );
}

function Hero() {
  return (
    <section className="lp-hero relative isolate overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-20 h-[60%] lg:inset-0 lg:h-full">
        <Image
          src="/landing/clairons-building.jpg"
          alt="The Clairon's Food Product building, its white sign listing siopao, siomai, meatball, patties, shanghai and flake ice."
          fill
          preload
          sizes="100vw"
          className="object-cover object-[32%_50%] lg:object-[0%_55%]"
        />
      </div>
      <div className="lp-hero-fade absolute inset-0 -z-10" aria-hidden />

      <div className="mx-auto flex min-h-[calc(100dvh-71px)] max-w-[1440px] flex-col items-center justify-end px-6 pt-12 pb-14 lg:items-end lg:justify-center lg:py-16 lg:pr-[4vw]">
        <div className="flex w-full flex-col items-center lg:w-[40%]">
          <h1 className="lp-hero-logo w-[min(80vw,480px)]">
            <Image src="/brand/clairons-logo-reverse.png" alt="Clairon's Food" width={1478} height={596} preload sizes="(min-width: 1024px) 480px, 80vw" className="h-auto w-full" />
          </h1>
          <div className="lp-hero-actions mt-10 flex flex-wrap justify-center gap-4 lg:mt-12">
            <Link href="/shop" className="lp-btn lp-btn-red">
              Shop online
            </Link>
            <Link href="/contact#wholesale" className="lp-btn lp-btn-light">
              Order wholesale
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ItemList({ items }: { items: Item[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map(([name, pack, price]) => (
        <li key={name} className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{name}</span> <span className="text-[0.9rem] whitespace-nowrap text-[var(--lp-ink-2)]">{pack}</span>
          </span>
          <span className="lp-figure">{money0(price)}</span>
        </li>
      ))}
    </ul>
  );
}

function Shelf({ title, items, className }: { title: string; items: Item[]; className?: string }) {
  return (
    <div className={`lp-keyline bg-[var(--lp-label)] p-5 sm:p-6 ${className ?? ""}`}>
      <h3 className="lp-display lp-h3 mb-4">{title}</h3>
      <ItemList items={items} />
    </div>
  );
}

function Contents() {
  return (
    <section id="products" className="scroll-mt-20">
      <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="lp-display lp-h2 max-w-[14ch]">What comes in the case</h2>
        <p className="lp-body mt-4">Frozen in packs, sold by the case. These are online prices per case; regular wholesale accounts get their own price list.</p>

        <div className="mt-10 grid gap-5 lg:grid-cols-12">
          <div className="lp-keyline grid bg-[var(--lp-label)] lg:col-span-7 lg:row-span-2 lg:grid-rows-[1fr_auto]">
            <Photo note="Photo: siopao and siomai in a bamboo steamer, about 4:3." className="lp-photo-flush min-h-[240px]" />
            <div className="p-5 sm:p-6">
              <h3 className="lp-display lp-h3 mb-4">Dimsum</h3>
              <ItemList items={DIMSUM} />
            </div>
          </div>
          <Shelf title="Streetfood" items={STREET} className="lg:col-span-5" />
          <Shelf title="Breakfast" items={BREAKFAST} className="lg:col-span-5" />
          <Shelf title="Sweets and bakery" items={SWEET} className="lg:col-span-7" />
          <div className="lp-red-field flex flex-col justify-between gap-6 p-6 lg:col-span-5">
            <div>
              <h3 className="lp-display lp-h3">And 30 more</h3>
              <p className="lp-body mt-3">Including pork, chicken, seafood, fries, kesong puti and ube halaya. All 48 are in the store with today&rsquo;s stock.</p>
            </div>
            <Link href="/shop" className="lp-btn lp-btn-paper self-start">
              Shop online
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ColdChain() {
  const steps = [
    { verb: "Make", text: "Every batch is made in our own kitchen, frozen, and given its own lot number and best-by date." },
    { verb: "Deliver", text: `Refrigerated vans set to ${ROUTES[0].setPointC}°C log the temperature at every stop. Riders take smaller orders.` },
  ];
  return (
    <section id="delivery" className="lp-red-field scroll-mt-20">
      <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="lp-display lp-h2 max-w-[16ch]">Cold from our kitchen to your freezer</h2>

        <ol className="mt-12 grid max-w-[880px] gap-10 md:grid-cols-2 md:gap-0">
          {steps.map((s, i) => (
            <li key={s.verb} className="relative md:pr-10">
              <div className="flex items-center gap-3">
                <span className="lp-display text-[2.4rem]">{s.verb}</span>
                {i < steps.length - 1 && <span className="hidden h-[3px] flex-1 bg-[var(--lp-ink)] md:block" aria-hidden />}
              </div>
              <p className="mt-3 max-w-[32ch] text-[var(--lp-ink-2)]">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-16 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="flex items-end justify-between gap-4">
              <h3 className="lp-display lp-h3">Delivery days</h3>
              <NextDeliveryStamp />
            </div>
            <ul className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Delivery days: Monday to Saturday, no deliveries on Sunday">
              {DAYS.map((d) => {
                const off = d === "Sun";
                return (
                  <li key={d} className={`lp-day flex aspect-[3/4] flex-col items-center justify-center gap-1.5 ${off ? "lp-day-off" : ""}`}>
                    <span className="lp-display text-[1.15rem] sm:text-[1.5rem]">{d}</span>
                    {off ? <span className="text-[0.7rem] font-bold sm:text-[0.8rem]">Rest</span> : <Truck size={18} strokeWidth={2.25} aria-hidden />}
                  </li>
                );
              })}
            </ul>
            <p className="lp-body mt-4">
              Delivery fee {money0(FUEL_FEE)}. Orders under {money0(DROP_MIN)} add a {money0(DROP_FEE)} small order fee.
            </p>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <h3 className="lp-display lp-h3">Where the vans go</h3>
            <ul className="mt-4 space-y-3">
              {ROUTES.map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <Truck size={20} strokeWidth={2.25} aria-hidden className="shrink-0" />
                  <span className="font-semibold">{r.name}</span>
                </li>
              ))}
              <li className="flex items-center gap-3">
                <Bike size={20} strokeWidth={2.25} aria-hidden className="shrink-0" />
                <span className="font-semibold">Riders for small drops</span>
              </li>
            </ul>
            <p className="lp-body mt-4 text-[0.95rem]">We deliver to {CITIES.slice(0, -1).join(", ")} and {CITIES.at(-1)}.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Doors() {
  return (
    <section>
      <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:gap-16 lg:py-24">
        <div>
          <h2 className="lp-display lp-h2">For home</h2>
          <ul className="lp-body mt-6 space-y-2.5">
            <li>Order a case or two from the online store.</li>
            <li>Pay by GCash, card, or cash on delivery.</li>
            <li>Follow your order from packed to delivered.</li>
          </ul>
          <Link href="/shop" className="lp-btn lp-btn-red mt-8">
            Shop online
          </Link>
        </div>
        <div>
          <h2 className="lp-display lp-h2">For your business</h2>
          <ul className="lp-body mt-6 space-y-2.5">
            <li>Carinderias, food carts, canteens, caterers and stores.</li>
            <li>Wholesale price tiers, and terms for regular accounts.</li>
            <li>A spot on our van route with your own delivery window.</li>
          </ul>
          <Link href="/contact#wholesale" className="lp-btn lp-btn-ink mt-8">
            Order wholesale
          </Link>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="lp-red-field scroll-mt-20">
      <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:py-24">
        <Photo note="Photo: the Clairon's kitchen or team at work, wide, about 21:9." className="aspect-[4/3] sm:aspect-[21/9]" />
        <div className="mt-12 grid gap-10 lg:grid-cols-12">
          <h2 className="lp-display lp-h2 lg:col-span-4">Who makes it</h2>
          <div className="lg:col-span-7 lg:col-start-6">
            <p className="lp-body text-[1.1rem]">
              Clairon&rsquo;s Food is a Filipino-owned food maker based in Iloilo City. We make the merienda and streetfood favourites that carinderias, carts
              and families buy every week, freeze them ourselves and bring them to you on our own vans.
            </p>
            <p className="lp-todo mt-6 max-w-[65ch]">
              Placeholder: the owner&rsquo;s story goes here. When Clairon&rsquo;s started, who runs the kitchen, and the product that started it all.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Photo({ note, className }: { note: string; className?: string }) {
  return (
    <div className={`lp-photo ${className ?? ""}`} role="img" aria-label={`${note} Placeholder.`}>
      <span className="lp-photo-note" aria-hidden>
        {note} Placeholder until the real photos arrive.
      </span>
    </div>
  );
}
