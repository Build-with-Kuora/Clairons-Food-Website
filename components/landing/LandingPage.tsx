import { Bike, Truck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PublicFrame } from "./PublicFrame";
import { AboutFilm } from "./AboutFilm";
import { DayCards, FoodMark, Headline, MenuTicker, RoadBand } from "./motifs";
import { NextDeliveryStamp } from "./NextDeliveryStamp";
import { money0, temp } from "@/lib/format";
import { DROP_FEE, DROP_MIN, FUEL_FEE, SERVICE_AREAS } from "@/lib/logic";
import { ROUTES } from "@/lib/seed";


/** Title and description for search engines; used by the home page, which shows this page to logged-out visitors. */
export const LANDING_METADATA: Metadata = {
  title: "Clairon's Food | Frozen siopao, siomai and merienda, delivered in Metro Manila",
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
const VAN_TEMP = temp(ROUTES[0].setPointC, 0);
const CITIES = Object.keys(SERVICE_AREAS);

/** The public home page (spec 11). Shown at / to anyone not logged in. Styled after the About film. */
export function LandingPage() {
  return (
    <PublicFrame page="home">
      <Hero />
      <MenuTicker />
      <Contents />
      <ColdChain />
      <Doors />
      <About />
    </PublicFrame>
  );
}

function Hero() {
  return (
    <section className="lp-hero lp-grain relative isolate overflow-hidden">
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

      <div className="mx-auto flex min-h-[calc(100dvh-72px)] max-w-[1440px] flex-col items-center justify-center px-6 py-16">
        <h1 className="lp-hero-logo w-[min(84vw,560px)]">
          <Image src="/brand/clairons-logo-reverse.png" alt="Clairon's Food" width={1478} height={596} preload sizes="(min-width: 1024px) 560px, 84vw" className="h-auto w-full drop-shadow-[0_12px_32px_rgb(0_0_0/0.55)]" />
        </h1>
        <div className="lp-hero-actions mt-10 flex flex-wrap justify-center gap-4 lg:mt-12">
          <Link href="/shop" className="lp-btn lp-btn-red lp-btn-lg">
            Shop online
          </Link>
          <Link href="/contact#wholesale" className="lp-btn lp-btn-light lp-btn-lg">
            Order wholesale
          </Link>
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

/** A shelf of the catalogue, drawn as a case label: thick rule, red tape across the top, the food beside the name. */
function Shelf({ title, food, items, className, children }: { title: string; food: string; items: Item[]; className?: string; children?: ReactNode }) {
  return (
    <div className={`lp-case ${className ?? ""}`}>
      {children}
      <div className="lp-case-tape">
        <h3 className="lp-display lp-h3">{title}</h3>
        <FoodMark name={food} className="lp-case-food" />
      </div>
      <div className="p-5 sm:p-6">
        <ItemList items={items} />
      </div>
    </div>
  );
}

function Contents() {
  return (
    <section id="products" className="lp-paper scroll-mt-20">
      <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:py-24">
        <Headline text="What comes in the case" className="lp-display lp-mega max-w-[12ch]" />
        <p className="lp-body mt-5 text-[1.1rem]">Frozen in packs, sold by the case. These are online prices per case; regular wholesale accounts get their own price list.</p>

        <div className="mt-12 grid gap-7 lg:grid-cols-12">
          <Shelf title="Dimsum" food="Siomai" items={DIMSUM} className="lg:col-span-7 lg:row-span-2">
            <Photo note="Photo: siopao and siomai in a bamboo steamer, about 4:3." className="lp-photo-flush min-h-[240px]" />
          </Shelf>
          <Shelf title="Streetfood" food="Fish balls" items={STREET} className="lg:col-span-5" />
          <Shelf title="Breakfast" food="Longganisa" items={BREAKFAST} className="lg:col-span-5" />
          <Shelf title="Sweets and bakery" food="Turon" items={SWEET} className="lg:col-span-7" />
          <div className="lp-case lp-case-ink flex flex-col justify-between gap-6 p-6 lg:col-span-5">
            <div>
              <p className="lp-display lp-outline text-[clamp(3.5rem,8vw,6rem)] leading-[0.9]">30 more</p>
              <p className="mt-4 text-[1.05rem] text-white/85">Including pork, chicken, seafood, fries, kesong puti and ube halaya. All 48 are in the store with today&rsquo;s stock.</p>
            </div>
            <Link href="/shop" className="lp-btn lp-btn-red self-start">
              Shop online
            </Link>
            <span className="lp-rubber" aria-hidden>
              Keep frozen
              <span className="block text-[0.72em]">−18°C</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ColdChain() {
  const steps = [
    { verb: "Make", text: "Every batch is made in our own kitchen, frozen, and given its own lot number and best-by date." },
    { verb: "Deliver", text: `Refrigerated vans set to ${VAN_TEMP} log the temperature at every stop. Riders take smaller orders.` },
  ];
  return (
    <section id="delivery" className="lp-ink-field lp-grain relative scroll-mt-20 overflow-hidden">
      <div className="mx-auto max-w-[1320px] px-4 pt-16 sm:px-6 lg:pt-24">
        <Headline text="Cold from our kitchen to your freezer" className="lp-display lp-mega max-w-[14ch]" />

        <ol className="mt-12 grid max-w-[920px] gap-10 md:grid-cols-2 md:gap-0">
          {steps.map((s, i) => (
            <li key={s.verb} className="relative md:pr-10">
              <div className="flex items-center gap-4">
                <span className="lp-display text-[clamp(2.6rem,5vw,3.6rem)] leading-none">{s.verb}</span>
                {i < steps.length - 1 && <span className="lp-arrow hidden flex-1 md:block" aria-hidden />}
              </div>
              <p className="mt-3 max-w-[34ch] text-white/80">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <RoadBand temp={VAN_TEMP} />

      <div className="lp-red-field">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-7">
            <div className="flex items-end justify-between gap-4">
              <Headline text="Monday to Saturday." as="h3" className="lp-display text-[clamp(2rem,4.4vw,3.4rem)] leading-none" />
              <NextDeliveryStamp />
            </div>
            <DayCards days={DAYS} />
            <p className="lp-body mt-5">
              Delivery fee {money0(FUEL_FEE)}. Orders under {money0(DROP_MIN)} add a {money0(DROP_FEE)} small order fee.
            </p>
          </div>

          <div className="lg:col-span-4 lg:col-start-9">
            <h3 className="lp-display lp-h3">Where the vans go</h3>
            <ul className="mt-4 space-y-3">
              {ROUTES.map((r) => (
                <li key={r.id} className="lp-route">
                  <Truck size={20} strokeWidth={2.25} aria-hidden className="shrink-0" />
                  <span className="font-semibold">{r.name}</span>
                </li>
              ))}
              <li className="lp-route">
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
    <section className="lp-paper relative overflow-hidden">
      <div className="lp-bigmarquee" aria-hidden>
        <div className="lp-bigmarquee-row">
          {Array.from({ length: 6 }, (_, k) => (
            <span key={k}>Clairon&rsquo;s Food</span>
          ))}
        </div>
      </div>
      <div className="relative mx-auto grid max-w-[1320px] gap-7 px-4 py-16 sm:px-6 md:grid-cols-2 lg:py-24">
        <div className="lp-door lp-door-red">
          <FoodMark name="Siopao" className="lp-door-food" />
          <Headline text="For home" className="lp-display lp-h2" />
          <ul className="mt-6 space-y-2.5 text-white/90">
            <li>Order a case or two from the online store.</li>
            <li>Pay by GCash, card, or cash on delivery.</li>
            <li>Follow your order from packed to delivered.</li>
          </ul>
          <Link href="/shop" className="lp-btn lp-btn-paper mt-8">
            Shop online
          </Link>
        </div>
        <div className="lp-door lp-door-ink">
          <FoodMark name="Hakaw" className="lp-door-food" />
          <Headline text="For your business" className="lp-display lp-h2" />
          <ul className="mt-6 space-y-2.5 text-white/85">
            <li>Carinderias, food carts, canteens, caterers and stores.</li>
            <li>Wholesale price tiers, and terms for regular accounts.</li>
            <li>A spot on our van route with your own delivery window.</li>
          </ul>
          <Link href="/contact#wholesale" className="lp-btn lp-btn-red mt-8">
            Order wholesale
          </Link>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="lp-ink-field lp-grain relative scroll-mt-20">
      <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:py-24">
        <AboutFilm />
        <div className="mt-14 grid gap-10 lg:grid-cols-12">
          <Headline text="Who makes it" className="lp-display lp-mega lg:col-span-5" />
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="text-[1.15rem] leading-relaxed text-white/90">
              Clairon&rsquo;s Food is a Filipino-owned food maker in Metro Manila. We make the merienda and streetfood favourites that carinderias, carts
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
