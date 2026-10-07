import { Bike, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicFrame } from "./PublicFrame";
import { AboutFilm } from "./AboutFilm";
import { Hero } from "./Hero";
import { MenuBoard } from "./MenuBoard";
import { DayCards, FoodMark, Headline, MenuTicker, RoadBand } from "./motifs";
import { NextDeliveryStamp } from "./NextDeliveryStamp";
import { money0, temp } from "@/lib/format";
import { DROP_FEE, DROP_MIN, FUEL_FEE, SERVICE_AREAS } from "@/lib/logic";
import { ROUTES, catalogue } from "@/lib/seed";


/** Title and description for search engines; used by the home page, which shows this page to logged-out visitors. */
export const LANDING_METADATA: Metadata = {
  title: "Clairon's Food | Frozen siopao, siomai and merienda, delivered across Iloilo and Western Visayas",
  description: "Clairon's Food makes siopao, siomai, fishballs, tocino and more, and delivers them frozen, Monday to Saturday.",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VAN_TEMP = temp(ROUTES[0].setPointC, 0);
const CITIES = Object.keys(SERVICE_AREAS);

/** The public home page (spec 11). Shown at / to anyone not logged in. Styled after the About film. */
export function LandingPage() {
  return (
    <PublicFrame page="home">
      <Hero />
      <MenuTicker />
      <Film />
      <Contents />
      <ColdChain />
      <Doors />
      <About />
    </PublicFrame>
  );
}

/** The About film, right under the hero. */
function Film() {
  return (
    <section id="film" className="lp-ink-field lp-grain relative scroll-mt-20">
      <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:py-16">
        <AboutFilm />
      </div>
    </section>
  );
}

function Contents() {
  const products = catalogue().filter((p) => p.active);
  return (
    <section id="products" className="lp-paper scroll-mt-20">
      <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid items-end gap-6 lg:grid-cols-12">
          <Headline text="The menu, by the case" className="lp-display lp-mega lg:col-span-7" />
          <div className="lg:col-span-5">
            <p className="text-[1.1rem] text-[var(--lp-ink-2)]">
              {products.length} frozen favourites, packed in cases of ready-to-cook packs. Prices are what you pay online, with what each piece or kilo works out to. Wholesale
              accounts get their own price list.
            </p>
          </div>
        </div>
        <div className="mt-10">
          <MenuBoard products={products} />
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
        <div className="grid gap-10 lg:grid-cols-12">
          <Headline text="Who makes it" className="lp-display lp-mega lg:col-span-5" />
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="text-[1.15rem] leading-relaxed text-white/90">
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
