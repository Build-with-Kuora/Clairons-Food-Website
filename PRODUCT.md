# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, equal weight on the public side:

- **Wholesale buyers** in Metro Manila: restaurants and dimsum houses, carinderias, food-cart franchisees (fishball and siomai carts), school and hospital canteens, caterers, supermarkets, convenience stores and sari-sari stores. They order by the case, on terms or COD, and receive on a refrigerated van route or by motorbike rider.
- **Households and walk-in shoppers** buying frozen food for home through the online store (`/shop`): browse, check out with GCash, card or cash on delivery, and track the order.

Inside the app (not the public side): the owner (admin), staff (counter, warehouse, production, dispatch) and riders/van drivers.

## Product Purpose

Clairon's Food makes frozen Chinese-Filipino food and streetfood in Metro Manila and sells it wholesale and online: siopao, siomai, hakaw, fish balls, kikiam, tocino, longganisa, lumpia, ice cream and more. Coldline is their all-in-one system: POS counter, cold-storage inventory, production batches, delivery tracking, sales, receipts and a public online store.

The public landing page introduces the business (about), gives contact details, and sends visitors to the online store; wholesale buyers get a route to set up an account or call.

## Positioning

A manufacturer, not a reseller: Clairon's makes every product in-house and delivers frozen on its own refrigerated vans (temperature-logged) and riders, Monday to Saturday across Metro Manila. One maker for the whole Chinese-Filipino frozen menu a carinderia or cart needs.

## Operating Context

- Delivery: three ref van routes (Binondo & Manila, Quezon City loop, Makati/Pasig & south) plus motorbike riders for small drops. Monday to Saturday.
- Wholesale ordering: tier pricing per account, ₱150 fuel surcharge, ₱300 small-drop fee under ₱5,000, terms (COD, NET15, NET30).
- Online store: list price, same delivery fees as the counter, GCash/card simulated, COD collected on delivery.
- Prices in Philippine pesos, VAT-inclusive. Temperatures in °C.

## Capabilities and Constraints

- Catalogue: 48 SKUs across Dimsum, Streetfood, Tocino & longganisa, Pork, Poultry, Seafood, Desserts, Bakery, Fries, Chiller (`lib/seed.ts`). Sold by the case (ice cream by the 3-gal tub).
- Stack: Next.js 16 App Router, React 19, Tailwind v4, Zustand. No backend yet; data in `localStorage`.
- `/` is currently the logged-in dashboard. The landing page is intended to live at `/` for logged-out visitors; design-only for now, integration later.
- Open: where Clairon's is. The sign on their building (photo in `public/landing/clairons-building.jpg`) says "Iloilo Fish Port Complex" and lists siopao, siomai, meatball, patties, shanghai and flake ice, while the prototype's routes and cities assume Metro Manila. Make no location claim on public pages until confirmed.
- Open: whether every catalogue item is made in-house (some look bought-in: fries, vannamei shrimp, ice cream, quick-melt cheese). Do not claim "everything made in-house" per item on the page until confirmed.

## Brand Commitments

- Logo: heavy black condensed wordmark "CLAIRON'S" with oversized C, red brush-script "Food" (`public/brand/clairons-logo.png`). Brand red `#d71f26`, ink `#141518`.
- Trading name on public surfaces: "Clairon's Food". "Coldline" is the internal system name.
- Do not feature blast freezing on public pages (client's request, 2026-10-05). It is an internal process, not a selling point.
- Filipino-owned. The food is Filipino merienda and streetfood staples (siopao and siomai included); do not frame the brand or its owner as Chinese.

## Evidence on Hand

- The client has real product and facility photos and real contact details; not yet supplied. Use clearly labeled placeholders until they arrive.
- No testimonials, customer logos, years in business, volumes or certifications have been supplied. Do not invent them. Seeded client names in `lib/seed.ts` are demo data, not real customers.

## Product Principles

- Frozen right is the promise: made in our own kitchen and delivered frozen.
- Two doors, one maker: wholesale and household buyers both find their way in from the first screen.
- Speak like the merienda counter, not a corporate catalogue: real Filipino food names, peso prices, Metro Manila places.
- No invented proof. Every claim on a public page must be something Clairon's can stand behind.
