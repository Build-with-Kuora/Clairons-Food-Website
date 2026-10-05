import { Bike, MapPin, Snowflake, Truck } from "lucide-react";
import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { NextDeliveryStamp } from "@/components/landing/NextDeliveryStamp";
import { WholesaleForm } from "@/components/landing/WholesaleForm";
import { money0 } from "@/lib/format";
import { DROP_FEE, DROP_MIN, FUEL_FEE, SERVICE_AREAS, ZONES } from "@/lib/logic";
import { ROUTES } from "@/lib/seed";
import "./landing.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "Clairon's Food | Frozen siopao, siomai and merienda, delivered in Metro Manila",
  description: "Clairon's Food makes and blast-freezes siopao, siomai, fishballs, tocino and more, and delivers them cold across Metro Manila, Monday to Saturday.",
};

type Item = [name: string, pack: string, price: number];

// Online (tier C) case prices, matching the store's catalogue in lib/seed.ts.
const LABEL: Item[] = [
  ["Siomai, pork", "10 × 50 pcs", 2145],
  ["Siopao asado, large", "6 × 12 pcs", 1738],
  ["Fish balls", "10 × 1 kg", 935],
  ["Pork tocino", "10 × 1 kg", 2640],
];

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

export default function LandingPage() {
  return (
    <div className={`lp ${archivo.variable} min-h-[100dvh]`}>
      <Header />
      <main>
        <Hero />
        <div className="lp-cutedge" aria-hidden />
        <Contents />
        <ColdChain />
        <Doors />
        <About />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="lp-rule-b sticky top-0 z-30 bg-[var(--lp-board)]">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center gap-8 px-4 sm:px-6">
        <Link href="/landing" aria-label="Clairon's Food, home">
          <Logo height={38} />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-7 md:flex">
          <a href="#products" className="lp-navlink">
            Products
          </a>
          <a href="#delivery" className="lp-navlink">
            Delivery
          </a>
          <a href="#about" className="lp-navlink">
            About
          </a>
          <a href="#contact" className="lp-navlink">
            Contact
          </a>
        </nav>
        <Link href="/shop" className="lp-btn lp-btn-red lp-btn-sm ml-auto">
          Shop online
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="lp-flutes">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 pt-10 pb-12 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:pt-16 lg:pb-16">
        <div className="flex flex-col justify-center lg:col-span-7">
          <h1 className="lp-display lp-h1">Merienda by the case.</h1>
          <p className="lp-lede mt-6">
            We make and blast-freeze siopao, siomai, fishballs, tocino and more, then deliver them cold across Metro Manila.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="/shop" className="lp-btn lp-btn-red">
              Shop online
            </Link>
            <a href="#wholesale" className="lp-btn lp-btn-ink">
              Order wholesale
            </a>
          </div>
        </div>

        <CaseLabel />
      </div>

      <div className="lp-rule-t">
        <ul className="mx-auto grid max-w-[1320px] gap-x-8 gap-y-4 px-4 py-5 sm:grid-cols-3 sm:px-6">
          <Mark icon={<Snowflake size={24} strokeWidth={2.25} />} title="Keep frozen" text={`At ${ZONES.FRZ.setPointC}°C or colder`} />
          <Mark icon={<Truck size={24} strokeWidth={2.25} />} title="Delivered Monday to Saturday" text="Between 8 am and 5 pm" />
          <Mark icon={<MapPin size={24} strokeWidth={2.25} />} title="Made in Metro Manila" text="In our own kitchen" />
        </ul>
      </div>
    </section>
  );
}

function CaseLabel() {
  return (
    <aside aria-label="What's in a case" className="lp-label self-center lg:col-span-5">
      <div className="lp-label-head flex items-baseline justify-between px-5 py-3">
        <span className="lp-display text-[1.5rem]">Contents</span>
        <span className="text-[0.85rem] font-semibold">Online price per case</span>
      </div>
      <ul className="px-5">
        {LABEL.map(([name, pack, price]) => (
          <li key={name} className="lp-field flex items-baseline gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{name}</div>
              <div className="text-[0.9rem] text-[var(--lp-ink-2)]">{pack}</div>
            </div>
            <div className="lp-figure text-[1.15rem] font-medium">{money0(price)}</div>
          </li>
        ))}
      </ul>
      <div className="lp-rule-t flex items-center justify-between gap-4 px-5 py-4">
        <div className="text-[0.9rem] leading-snug">
          <div className="font-semibold">Clairon&rsquo;s Food</div>
          <div className="text-[var(--lp-ink-2)]">Prices include VAT</div>
        </div>
        <NextDeliveryStamp />
      </div>
    </aside>
  );
}

function Mark({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <span className="lp-mark" aria-hidden>
        {icon}
      </span>
      <span className="leading-tight">
        <span className="block font-bold">{title}</span>
        <span className="block text-[0.95rem] text-[var(--lp-ink-2)]">{text}</span>
      </span>
    </li>
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
    { verb: "Make", text: "Every batch is made in our own kitchen and gets its own lot number and best-by date." },
    { verb: "Blast-freeze", text: `Batches go into the blast freezer at ${ZONES.BLAST.setPointC}°C and stay 24 hours before they can be sold.` },
    { verb: "Deliver", text: `Refrigerated vans set to ${ROUTES[0].setPointC}°C log the temperature at every stop. Riders take smaller orders.` },
  ];
  return (
    <section id="delivery" className="lp-rule-t lp-flutes scroll-mt-20">
      <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="lp-display lp-h2 max-w-[16ch]">Cold from our kitchen to your freezer</h2>

        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0">
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
            <h3 className="lp-display lp-h3">Delivery days</h3>
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
    <section className="lp-rule-t grid md:grid-cols-2">
      <div className="px-4 py-14 sm:px-6 md:py-20 lg:pl-[max(1.5rem,calc((100vw-1320px)/2+1.5rem))]">
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
      <div className="lp-red-field px-4 py-14 sm:px-6 md:py-20 lg:pr-[max(1.5rem,calc((100vw-1320px)/2+1.5rem))]">
        <h2 className="lp-display lp-h2">For your business</h2>
        <ul className="lp-body mt-6 space-y-2.5">
          <li>Carinderias, food carts, canteens, caterers and stores.</li>
          <li>Wholesale price tiers, and terms for regular accounts.</li>
          <li>A spot on our van route with your own delivery window.</li>
        </ul>
        <a href="#wholesale" className="lp-btn lp-btn-paper mt-8">
          Order wholesale
        </a>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="lp-rule-t scroll-mt-20">
      <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:py-24">
        <Photo note="Photo: the Clairon's kitchen or team at work, wide, about 21:9." className="aspect-[4/3] sm:aspect-[21/9]" />
        <div className="mt-12 grid gap-10 lg:grid-cols-12">
          <h2 className="lp-display lp-h2 lg:col-span-4">Who makes it</h2>
          <div className="lg:col-span-7 lg:col-start-6">
            <p className="lp-body text-[1.1rem]">
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

function Contact() {
  return (
    <section id="contact" className="lp-rule-t lp-flutes scroll-mt-20">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-5">
          <h2 className="lp-display lp-h2">Talk to us</h2>
          <dl className="lp-label mt-8">
            <div className="lp-label-head px-5 py-3">
              <dt className="lp-display text-[1.5rem]">From</dt>
              <dd className="sr-only">Clairon&rsquo;s Food</dd>
            </div>
            <ContactRow label="Address" value="Street, barangay, city" />
            <ContactRow label="Mobile" value="0900 000 0000" />
            <ContactRow label="Messenger" value="facebook.com/your-page" />
            <ContactRow label="E-mail" value="orders@your-domain.ph" />
            <div className="lp-rule-t px-5 py-4">
              <dt className="text-[0.85rem] font-semibold text-[var(--lp-ink-2)]">Deliveries</dt>
              <dd className="font-semibold">Monday to Saturday, 8 am to 5 pm</dd>
            </div>
          </dl>
          <p className="mt-3 text-[0.9rem] text-[var(--lp-ink-2)]">Address, mobile, Messenger and e-mail are placeholders until the real ones are in.</p>
        </div>

        <div id="wholesale" className="scroll-mt-24 lg:col-span-7">
          <h2 className="lp-display lp-h2">Order wholesale</h2>
          <p className="lp-body mt-4 mb-8">Tell us about your business and what you need. We set up your account, prices and delivery day.</p>
          <WholesaleForm />
        </div>
      </div>
    </section>
  );
}

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="lp-field flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="text-[0.85rem] font-semibold text-[var(--lp-ink-2)]">{label}</dt>
      <dd className="lp-todo-inline text-right">{value}</dd>
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <div className="lp-cutedge" aria-hidden />
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-8 gap-y-5 px-4 py-8 sm:px-6">
        <Logo height={44} />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/shop" className="lp-navlink">
            Shop online
          </Link>
          <a href="#products" className="lp-navlink">
            Products
          </a>
          <a href="#delivery" className="lp-navlink">
            Delivery
          </a>
          <a href="#contact" className="lp-navlink">
            Contact
          </a>
          <Link href="/login" className="lp-navlink">
            Staff log in
          </Link>
        </nav>
        <p className="w-full text-[0.9rem] text-[var(--lp-ink-2)] lg:ml-auto lg:w-auto">© 2026 Clairon&rsquo;s Food. Prototype: photos and contact details are placeholders.</p>
      </div>
    </footer>
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
