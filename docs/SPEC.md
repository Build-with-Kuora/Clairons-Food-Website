# All-in-One System: Requirements

Source: the client's paper sketches and additional requirements, reviewed against the Coldline prototype on 2026-10-02.
Changes from the original checklist are marked **[changed]** with the reason. Each item has a status against the current prototype:

- **Done**: the prototype already does this
- **Partial**: something close exists but needs work
- **Missing**: not built yet

---

## 0. Decisions needed from the client

These change what we build, so they come first.

1. **Decided: Clairon's is a manufacturer.** They make all their own products and sell them wholesale. The prototype still treats finished goods as bought from suppliers (Ongpin Dimsum Commissary, Valenzuela Fishball Factory…) and received on purchase orders. **Production batches replace that as the way finished goods come in.** The supplier, PO and reorder screens either go away or become purchasing for raw materials (see 0.2).
2. **Decided: finished goods only, for now.** A production batch adds finished stock. Raw materials and recipes can be added later without changing how batches work.
3. **Decided: the Dashboard upper-left box shows price.** Quantity produced belongs on the Production page.
4. **Decided: the owner sets the unit per product.** Each product has a selling unit (e.g. "case", "pack", "tray") and what is inside it (e.g. "10 × 50 pcs"). Stock, production and sales are counted in that unit. Built with add/edit products (2.8). The demo sells ice cream by the tub and everything else by the case.
5. **Decided: both riders and vans.** Refrigerated vans on routes for big accounts (keeping temperature logs), riders on motorbikes for small drops. A delivery is assigned to either a van route or a rider.
6. **Decided: a sale counts when the order is delivered or paid** (see 6.3).
7. **Decided: a public online store** (2026-10-03). Anyone can browse; customers sign up to check out, pay by GCash, card or cash on delivery, and track their orders. Built as `/shop` (section 9).
8. **Decided: a public landing page** (2026-10-05). It introduces Clairon's (what they make, how it arrives frozen, about, contact) and gives two doors: the online store for households and a wholesale inquiry for businesses, both equal weight. Built for now at `/landing`; it moves to `/` for logged-out visitors later (section 11). Clairon's is Filipino-owned: the page never frames the brand as Chinese.
9. **Confirm the catalogue is all made in-house.** Some demo products look bought-in rather than made: imported fries, vannamei shrimp, ice cream tubs, quick-melt cheese. The prototype treats all 48 as produced (decision 0.1). If some are resold, either drop them or bring back a small receiving step for those items only.

---

## 1. General and navigation

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1.1 | Header with page title on every screen | Done | |
| 1.2 | **[changed]** Works on phones *and* on desktop/tablet. Phones get a bottom navigation bar; wider screens keep the sidebar. | Done | Original said "mobile app layout". POS and the inventory tables are used at the counter on a bigger screen, so the app must work there as well. `components/BottomNav.tsx` below desktop width, sidebar above it. |
| 1.3 | Bottom nav on phones: Inventory · Production · **Home** (center) · Delivery · Sales | Done | Delivery opens the Delivery page (`/dispatch`). |
| 1.4 | **[changed]** Screens with no bottom-nav slot (POS counter, Orders, Customers, Driver view) sit under **Sales** or a "More" menu | Done | The original five tabs leave out the POS counter, orders and customers. Sales opens a menu with the sales table first, then Counter, Orders, Clients and Log out. The driver handheld is reached by logging in as a rider. |
| 1.5 | Home/Dashboard is the default landing screen | Done | **[changed]** The app opens on `/login` first (10.3). After logging in, `/` is Home: the owner's Today for admin, Today's work for staff. Riders land on `/driver`. |

## 2. Dashboard / Home

| # | Requirement | Status | Notes |
|---|---|---|---|
| 2.1 | **[changed]** Grid of product cards: **2 per row on phones, 4 per row on tablet/desktop** | Done | Original said 4 per row. On a phone that makes each card about 80 px wide holding 3 numbers, which is unreadable. `components/ProductGrid.tsx`. Shows the top 8 sellers, with "Show all". Each card opens the product in Inventory. |
| 2.2 | Each card: product name, **products sold** (big number) | Done | Cases sold |
| 2.3 | **[changed]** "Products sold" means **sold today**, with a date switch (today / 7 days / 30 days) | Done | The original didn't say over what period. Counts cases when the sale counts (6.3): delivered, or paid when placed. Refused cases are left out. |
| 2.4 | Upper-left box: price (decision 0.3) | Done | List price per case, or per kg for catch weight |
| 2.5 | Lower-right box: stock left (*bilin nga stock*). Shows **free to sell** stock, i.e. on hand minus already reserved for orders | Done | **[changed]** Raw on-hand would overstate what can be sold. |
| 2.6 | Low stock is highlighted on the card | Done | Amber below reorder point, red when out |
| 2.7 | **[changed]** With many products: search and category filter on the grid | Done | The sketch shows 4 products; the catalogue has 48 SKUs. |
| 2.8 | Owner can add / edit / deactivate products: name, price, **selling unit and its contents** (decision 0.4), reorder level, par level | Done | Inventory → Products: add, edit, deactivate. Also tier prices, weight per unit, catch weight, storage zone, home bin and shelf life, which a new product needs to be stocked and sold. New SKUs are numbered by category. Inactive products keep their stock and history but drop off the Counter, the Dashboard grid, "To make" and the batch picker. Rules are `productError` and `nextSku` in `lib/logic.ts`; the store action is `saveProduct`. Price changes are not logged yet. |
| 2.9 | Current dashboard content (headline figures, routes, sales chart, "needs attention") stays below the product grid | Done | Keep it. It covers delivery tracking and alerts. **[changed]** Freezer temperatures are removed from the dashboard, the header and Inventory (2026-10-03): live readings need sensors in the freezers, an embedded system outside this build. |

## 3. Inventory (finished goods)

| # | Requirement | Status | Notes |
|---|---|---|---|
| 3.1 | List of products with how many are left | Done | Inventory → Stock |
| 3.2 | Remaining count updates the Dashboard automatically | Done | Shared store; the Dashboard grid will read the same numbers. |
| 3.3 | Stock adjustments (count corrections, spoilage write-off) with a reason | Done | Count / write-off on each lot |
| 3.4 | Every change is logged (who, when, why) | Done | Movements tab |
| 3.5 | Best-by dates and first-expiry-first-out | Done | Lots, FEFO, short-dated alerts |
| 3.6 | Raw materials inventory | Deferred | Decision 0.2: finished goods only for now |

## 4. Production

| # | Requirement | Status | Notes |
|---|---|---|---|
| 4.1 | List of products with how many were produced (per day) | Done | `/production`: produced by product, today and 7 days |
| 4.2 | Record a production batch: product, quantity, date, made by | Done | Plus an optional note. "To make" suggests what to run next, from reorder point and par. |
| 4.3 | Produced quantity adds to inventory and shows on the Dashboard | Done | **[changed]** Each batch becomes a stock lot with a best-by date (`produce` in `lib/store.ts`), so first-expiry-first-out and expiry alerts work for in-house products too. |
| 4.4 | Batch blast-freezes before it is put away | Done | Batches land in a blast-freezer bin and can't be reserved or sold there; Inventory shows them as "Freezing" with a ready time 24 hours after they are made, then "Frozen, move to freezer". Moving the lot to a freezer bin makes it sellable. Moving stays a manual step. |
| 4.6 | Seeded history comes from production batches, not supplier POs (decision 0.1) | Done | Every demo lot is a batch with a PRODUCE movement. Suppliers, purchase orders and receiving are gone. Inventory links to Production ("To make", "Record batch", "Make a batch" on a product). |
| 4.5 | Consumes raw materials per recipe | Deferred | Decision 0.2 |

## 5. Delivery

| # | Requirement | Status | Notes |
|---|---|---|---|
| 5.1 | Delivery table: Rider · Customer · Amount | Done | Delivery → Table: one row per stop for the chosen day (rider or van driver, customer, order amount, simple status) with a total. Routes view keeps the stop lines per van. |
| 5.2 | One rider can have several deliveries | Done | Several stops per van route or rider |
| 5.3 | **[changed]** Deliveries are **created from an order**, not typed in freely. Editable on a delivery: rider, delivery date, status, notes. **Amount comes from the order** and can't be edited on the delivery. | Done | Original said "add / edit delivery entries". A free-typed amount can't be tied to sales and inventory, which breaks 6.4. Deliveries are created from Counter orders. On the stop detail: the rider (or van) can change until the stop leaves; the day can change until it is loaded (not to a Sunday, a past day, a van that already left, or past a lot's best-by), and it goes back to Scheduled at the end of that day's list; dispatch can leave a note for the driver until the stop is closed. The note shows on the Delivery table and the driver handheld. Every change is logged on the stop. Rules are `rescheduleError` in `lib/logic.ts`; store actions `rescheduleDelivery` and `setDeliveryNote`. |
| 5.4 | Status per delivery: pending → out for delivery → delivered (plus "problem") | Done | Prototype has finer steps: Scheduled, Picking, Loaded, En route, Arrived, Delivered, Exception. The Delivery table shows the simple three plus Problem. |
| 5.5 | Proof of delivery: who received, signature, amount collected (COD) | Done | |
| 5.6 | Rider's own phone view | Done | `/driver`, for van drivers and riders |
| 5.7 | Rider list (add / edit riders) | Done | Delivery → Riders: name, phone, motorbike, on/off roster. Van drivers are still fixed per route in the seed. |
| 5.8 | **[changed]** A delivery goes either on a van route or to a rider (decision 0.5). Van routes keep temperature logs; rider drops track status and proof of delivery only. | Done | New orders go on the client's van route; dispatch hands a stop to a rider. A stop can't move back to a van that has already left. Rider stops are packed, then handed to the rider one at a time. |

## 6. Orders and sales

| # | Requirement | Status | Notes |
|---|---|---|---|
| 6.1 | Sales table: Products sold · Amount | Done | `/sales`: one row per product with cases sold and amount, highest amount first. Uses the sale rule (6.3), so refused cases are left out. `salesSummary` in `lib/logic.ts`. |
| 6.2 | Total sales at the bottom, computed automatically | Done | Footer rows for products, delivery fees (small drop and fuel) and the total. Headline figures above the table. |
| 6.3 | **[changed]** Sales rules: **order placed → stock reserved**; **loaded / handed over → stock deducted**; **delivered (or paid at the counter) → counted as a sale**. Cancelled orders release the stock. Refused cases come back to stock and are credited. | Partial | Original said "a delivered order counts toward sales and deducts from inventory". Deducting only on delivery lets the counter sell stock that is already on a truck. Walk-ins and orders paid upfront (cash, card, GCash, check) count when placed; on-account and COD deliveries count at proof of delivery. Refused cases are not counted. Rule is `salesOf` in `lib/logic.ts`. Left: refused cases are credited to the account only on on-account orders (`completeDelivery`); an order paid upfront records no refund for them yet. |
| 6.4 | Orders, delivery and sales are linked | Done | One order → one delivery, with shared status |
| 6.5 | **[changed]** Sales table can be filtered by date range and shows sales with and without VAT | Done | Needed for BIR reporting. Today, yesterday, 7 days, 30 days, this month, or any from/to dates. Every row shows VATable sales, 12% VAT and the VAT-inclusive amount (`vatSplit`, also used by the invoice). Prints as a report. |
| 6.6 | Customers list with terms, credit limit and balance | Done | `/clients` |

## 7. Receipts and invoicing

| # | Requirement | Status | Notes |
|---|---|---|---|
| 7.1 | **[changed]** Invoice/receipt with the details BIR requires: seller name, TIN and address; serial number; date; buyer; items; VATable sales, 12% VAT, total | Done | Sales invoice shows registered name, VAT Reg. TIN, address, buyer and buyer TIN, VATable / VAT-exempt / zero-rated sales, 12% VAT, total, and the Permit to Use number and series. Every order gets the next serial (SI 000001…) when placed; cancelled invoices keep their number and print "Cancelled". **The seller details, TINs and permit number are made up** (`SELLER` in `lib/seed.ts`) and the invoice says so. Replace them with the registered ones from the client's accountant. |
| 7.2 | **[changed]** "BIR-accredited" is a **registration the business does**, not a feature. The software has to meet BIR rules for a computerized POS/invoicing system. The owner (with their accountant) applies for the permit before going live. | Left out for now | Original listed "BIR-accredited receipt generation" as a feature. Left out of the prototype for now (decided 2026-10-03). Plan time for this process later and confirm current requirements with the client's accountant. |
| 7.3 | Print a receipt for every sale | Done | Invoice view prints |
| 7.4 | Send the receipt by SMS or email | Done | "Send receipt" on Orders and after placing an order on the Counter. With no server, it opens the device's own messages or mail app with the receipt filled in (short text for SMS, full breakdown for e-mail) and logs each send on the order. A real SMS gateway and mail service come with the main app. Clients can have an e-mail and TIN on file. |

## 8. POS

| # | Requirement | Status | Notes |
|---|---|---|---|
| 8.1 | Counter POS for recording sales | Done | `/counter`: tier pricing, payment method (cash, GCash, card, check, on account), credit hold |
| 8.2 | Each sale deducts from inventory | Done | Walk-in deducts right away; delivery reserves and then deducts on loading (see 6.3) |

## 9. E-commerce

| # | Requirement | Status | Notes |
|---|---|---|---|
| 9.1 | Online ordering for customers | Done | Public store (decision 0.7). `/shop`: catalogue by category with search, list price (tier C), in-stock count from free-to-sell stock, cart with the same delivery fees as the counter (`cartQuote`). Browsing needs no login; checkout and My orders need a customer account (sign up, or `customer@clairon.com`). `/shop/orders` tracks each order in four steps. |
| 9.2 | Online orders go into the same orders, sales and inventory | Done | Checkout saves the customer as a client ("Online customer", COD terms, route from their city via `SERVICE_AREAS`; `saveCustomer`), then calls `placeOrder` with `channel: "ONLINE"`. The order reserves stock first-expiry-first-out, gets the next invoice number, lands on Delivery and counts as a sale by rule 6.3. Orders tags it "Online". |
| 9.3 | **[changed]** Online payment (GCash / card) or cash on delivery | Partial | GCash and card are simulated: the order is marked paid and nothing is charged; the checkout says so. Cash on delivery is collected at proof of delivery. Left: a real payment gateway (e.g. PayMongo) with the main app. |

## 10. Centralized system

| # | Requirement | Status | Notes |
|---|---|---|---|
| 10.1 | One system for POS, inventory, production, delivery, sales, e-commerce | Done | All in one app, sharing one store. |
| 10.2 | Single shared database so every device stays in sync | Missing (deferred) | Prototype data lives in each browser's local storage, so two phones don't share data. A real database is deferred until the client signs off on the prototype. |
| 10.3 | **[changed]** Logins and roles: owner, counter, production, rider | Partial | Prototype logins, checked in the browser with no database (`lib/auth.ts`): `admin@clairon.com`, `staff@clairon.com`, `rider@clairon.com`. **Admin** (owner) sees everything: the sales Today, the sales report, add/edit products and prices, approving orders past a credit hold, and resetting the demo. **Staff** (counter, warehouse, production, dispatch) get a work-queue home (to pick and load, move out of blast freezer, to make, delivery problems, sell first, QA hold) and every screen except the sales report; they can't edit products or approve credit holds. **Riders** only get the driver handheld. **Customers** (`customer@clairon.com`) only get the online store. Sign up makes a customer account in that browser only. Forgot password shows a confirmation but sends nothing. Left for the main app: real accounts and passwords on the server, separate counter and production roles, and a reset e-mail. The demo passwords are readable in the page source, so they are for the presentation only. |

## 11. Public landing and contact pages

Product facts behind the page (audience, positioning, what may and may not be claimed) are in `PRODUCT.md`.

**Design direction: "Master Case."** The public pages read like the side of a printed frozen master carton: white-coated board printed in the logo's black (`#141518`) and red (`#d71f26`) only, square corners, a white case label with ruled fields, handling marks, and a red rubber stamp. Display type is Archivo (condensed, extra heavy); body is Barlow, as in the app. Chosen 2026-10-05 over a wall-calendar direction, an illustrated cutaway of the kitchen-to-van chain, and the usual food-photo hero. **[changed 2026-10-05]** The client asked that colours stay with the logo, so the kraft-brown board and the brown cut-edge strips were dropped.

| # | Requirement | Status | Notes |
|---|---|---|---|
| 11.1 | Header with logo, links (Products, Delivery, About, Contact) and a Shop online button | Done | Shared by both public pages (`components/landing/PublicFrame.tsx`). Products, Delivery and About jump to sections of `/landing`; Contact opens `/contact`. Sticky. The links hide on phones; the logo and Shop online stay. |
| 11.2 | Opening screen shows who Clairon's is and both doors | Done | **[changed 2026-10-05]** Fills the screen below the header. The client's photo of the Clairon's Food Product building (`public/landing/clairons-building.jpg`) runs full width and fades into a black field with logo red glowing from the far edge: left to right on desktop, top to bottom on phones. On the dark side: the logo in a light version (`public/brand/clairons-logo-reverse.png`, white wordmark, red script, made from the client's logo) and the two buttons Shop online (`/shop`) and Order wholesale (`/contact#wholesale`). No headline or other wording for now, at the client's request. Handling marks sit below the hero: keep frozen at −18°C, delivered Monday to Saturday 8 am to 5 pm, made in our own kitchen. |
| 11.3 | What they make | Done | Dimsum, Streetfood, Breakfast, and Sweets and bakery, with real pack sizes and online (tier C) prices from `lib/seed.ts`, plus "And 30 more" linking to the store. The prices are copied into `app/landing/page.tsx`, so they must be updated there when catalogue prices change, or read from the store once there is a database. |
| 11.4 | How it stays frozen and where it goes | Done | Make, then deliver, with the van temperature read from `ROUTES` (−20°C). **[changed 2026-10-05]** Blast freezing is left off the page at the client's request. Delivery week with Sunday marked as no deliveries, delivery fees from `FUEL_FEE` / `DROP_FEE` / `DROP_MIN`, the three van routes, riders, and the cities in `SERVICE_AREAS`. |
| 11.5 | Two doors: for home and for your business | Done | Home: online store, GCash / card / COD, order tracking. Business: price tiers, terms, a spot on the van route. |
| 11.6 | About | Partial | Short Filipino-owned maker paragraph. **Placeholder**: the owner's story and a wide kitchen or team photo (the building photo is used in the hero). |
| 11.7 | Contact and wholesale inquiry | Partial | **[changed 2026-10-05]** Its own page, `/contact`, so the landing page stays an overview of the store. Contact card with **placeholder** address, mobile, Messenger and e-mail; delivery hours are real. Wholesale form (`#wholesale`): name, mobile (PH format), business name, kind of business, city we deliver to, what they need. Checks each field and shows a thank-you, but sends nothing yet (the page says so). Left: send it somewhere real (e-mail, Messenger, or a lead in the app). |
| 11.8 | Footer with Staff log in | Done | Links to the store, the landing sections, Contact and `/login`. |
| 11.9 | Lives at `/` for logged-out visitors | Missing | Now at `/landing`, with `/contact` beside it; both are open to everyone (`canOpen` in `lib/auth.ts`), and `Shell` renders them without the app chrome or waiting for the store, since they read no store data. To move it: render the landing page from `app/page.tsx` when no one is logged in, point the logged-out redirect at `/` instead of `/login`, and change the `/landing` links in `PublicFrame`. |
| 11.11 | **Confirm where Clairon's is** | Question for the client | The sign on their building reads "Clairon's Food Product: siopao, siomai, meatball, patties, shanghai, flake ice" with "Iloilo Fish Port Complex" under it, but the prototype (routes, cities, delivery fees, README) assumes Metro Manila. The new hero makes no location claim; the delivery section, page title and app data still say Metro Manila. Also check whether meatballs, patties and flake ice belong in the catalogue. |
| 11.10 | Real photos and contact details | Missing | The client has them. Every placeholder is styled with a dashed red outline or a hatched photo box so none ship by accident. No testimonials, customer names or numbers we can't stand behind. |

Checked in the browser at desktop (1440 × 900) and phone (375 × 812) widths on 2026-10-05: the hero fills the screen at both, and nothing scrolls sideways. The dev server is slow on this machine (several minutes to start, and new image sizes take a while the first time).

---

## Keeping the prototype ready for a real API

The prototype has no backend yet, but every feature follows three rules. When the database lands, only `lib/store.ts` changes; the screens stay the same.

1. **Rules live in `lib/logic.ts`** as pure functions: pricing, fees, first-expiry-first-out allocation, stock rollups, sold-per-product. The server reuses the same functions, so prototype and production behave identically.
2. **Writes go through a store action** (`placeOrder`, `advance`, `produce`, …). Each action becomes one API endpoint, so components never change data directly.
3. **Shapes live in `lib/types.ts`**, and the API returns exactly those types. The seed (`lib/seed.ts`) is the test fixture for the database.

New features (Production, riders, products admin) add a type, a logic function where there is a rule, and a store action. They don't put logic inside a page.

## Future notes for the main app

Not built in the prototype. Do these once the client approves the prototype and the main app (with a real database) starts.

- **Offline delivery.** The rider/driver side must keep working with no signal: view stops, mark arrived/delivered, capture proof of delivery and COD collected. Store data on the phone in **IndexedDB** and queue each change. When the phone is back online, sync the queue to the database. Each queued change carries an id, so a retry doesn't apply it twice. Conflicts (e.g. dispatch reassigned a stop while the rider was offline) are flagged for dispatch to resolve rather than silently overwritten. The prototype's store actions (`advance`, `completeDelivery`, `reportException`) are the operations to queue.
- **Shared database and API**, logins and roles (10.2, 10.3).
- **Online payments** through a real gateway for the store (9.3).
- **Freezer and ref van telemetry** from sensors, if the client wants live temperatures (an embedded system).
- **BIR registration** of the invoicing system (7.2), with the real registered name, TIN, address and Permit to Use replacing the sample `SELLER` details.
- **Sending receipts** through an SMS gateway and mail service instead of the device's own apps (7.4).

## Suggested build order (prototype, no database)

Done: dashboard product grid (2.1–2.7), Production page (4.1–4.3), production replaces suppliers (4.6), sale rule (6.3), no selling stock still blast freezing (4.4), phone bottom navigation (1.3–1.4), delivery table and riders (5.1, 5.7, 5.8, and changing the rider in 5.3), sales table with totals and VAT (6.1, 6.2, 6.5), add/edit products with owner-set units (2.8, decision 0.4), receipts with BIR details and sending by SMS or e-mail (7.1, 7.4; sample seller details for now), delivery date and notes (5.3), prototype logins with an admin, staff, rider and customer view (10.3), public online store (9.1, 9.2; simulated payments for 9.3), sales CSV download for today, 7 days and 30 days.

Built: public landing page at `/landing` and contact page at `/contact` (section 11).

Next for the landing page: drop in the real photos and contact details, confirm where Clairon's is (11.11), decide where wholesale inquiries go, then move it to `/` (11.9).

Left out of the prototype for now: **BIR accreditation** (7.2) and **freezer temperature monitoring** (needs sensors).

1. **Main app** (see Future notes): database and API, logins and roles, offline delivery, online payment gateway, BIR registration.
