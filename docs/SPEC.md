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
4. **Decided: the owner sets the unit per product.** Each product has a selling unit (e.g. "case", "pack", "tray") and what is inside it (e.g. "10 × 50 pcs"). Stock, production and sales are counted in that unit. Part of add/edit products (2.8). Until then the prototype counts cases.
5. **Decided: both riders and vans.** Refrigerated vans on routes for big accounts (keeping temperature logs), riders on motorbikes for small drops. A delivery is assigned to either a van route or a rider.
6. **Decided: a sale counts when the order is delivered or paid** (see 6.3).
7. **E-commerce scope:** is this a public online store, or ordering for regular accounts only (restaurants, carts)? These are very different builds.

---

## 1. General and navigation

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1.1 | Header with page title on every screen | Done | |
| 1.2 | **[changed]** Works on phones *and* on desktop/tablet. Phones get a bottom navigation bar; wider screens keep the sidebar. | Partial | Original said "mobile app layout". POS and the inventory tables are used at the counter on a bigger screen, so the app must work there as well. Phones currently get a scrolling top tab bar. |
| 1.3 | Bottom nav on phones: Inventory · Production · **Home** (center) · Delivery · Sales | Missing | |
| 1.4 | **[changed]** Screens with no bottom-nav slot (POS counter, Orders, Customers, Driver view) sit under **Sales** or a "More" menu | Missing | The original five tabs leave out the POS counter, orders and customers. |
| 1.5 | Home/Dashboard is the default landing screen | Done | `/` Today |

## 2. Dashboard / Home

| # | Requirement | Status | Notes |
|---|---|---|---|
| 2.1 | **[changed]** Grid of product cards: **2 per row on phones, 4 per row on tablet/desktop** | Done | Original said 4 per row. On a phone that makes each card about 80 px wide holding 3 numbers, which is unreadable. `components/ProductGrid.tsx`. Shows the top 8 sellers, with "Show all". Each card opens the product in Inventory. |
| 2.2 | Each card: product name, **products sold** (big number) | Done | Cases sold |
| 2.3 | **[changed]** "Products sold" means **sold today**, with a date switch (today / 7 days / 30 days) | Done | The original didn't say over what period. Counts orders placed for now; switches to delivered/paid with 6.3. |
| 2.4 | Upper-left box: price (decision 0.3) | Done | List price per case, or per kg for catch weight |
| 2.5 | Lower-right box: stock left (*bilin nga stock*). Shows **free to sell** stock, i.e. on hand minus already reserved for orders | Done | **[changed]** Raw on-hand would overstate what can be sold. |
| 2.6 | Low stock is highlighted on the card | Done | Amber below reorder point, red when out |
| 2.7 | **[changed]** With many products: search and category filter on the grid | Done | The sketch shows 4 products; the catalogue has 48 SKUs. |
| 2.8 | Owner can add / edit / deactivate products: name, price, **selling unit and its contents** (decision 0.4), reorder level, par level | Missing | Products come from the seed only. |
| 2.9 | Current dashboard content (headline figures, routes, freezer temps, sales chart, "needs attention") stays below the product grid | Done | Keep it. It covers delivery tracking and alerts. |

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
| 4.3 | Produced quantity adds to inventory and shows on the Dashboard | Done | **[changed]** Each batch becomes a stock lot with a best-by date, the same way receiving from a supplier does (`receive` in `lib/store.ts`), so first-expiry-first-out and expiry alerts work for in-house products too. |
| 4.4 | Batch blast-freezes before it is put away | Partial | Batches land in a blast-freezer bin; staff move them to a freezer bin from Inventory. Nothing yet stops selling a lot that is still blast freezing. |
| 4.6 | Seeded history comes from production batches, not supplier POs (decision 0.1) | Missing | Demo stock and the Inventory "Reorder" tab still use suppliers and purchase orders. Turn Reorder into a link to Production. |
| 4.5 | Consumes raw materials per recipe | Deferred | Decision 0.2 |

## 5. Delivery

| # | Requirement | Status | Notes |
|---|---|---|---|
| 5.1 | Delivery table: Rider · Customer · Amount | Partial | Dispatch shows the same data grouped by route and driver as a stop line, not a flat table. Add a table view. |
| 5.2 | One rider can have several deliveries | Done | Several stops per route/driver |
| 5.3 | **[changed]** Deliveries are **created from an order**, not typed in freely. Editable on a delivery: rider, delivery date, status, notes. **Amount comes from the order** and can't be edited on the delivery. | Partial | Original said "add / edit delivery entries". A free-typed amount can't be tied to sales and inventory, which breaks 6.4. Deliveries are created from Counter orders today. Changing the rider isn't possible yet. |
| 5.4 | Status per delivery: pending → out for delivery → delivered (plus "problem") | Done | Prototype has finer steps: Scheduled, Picking, Loaded, En route, Arrived, Delivered, Exception. Show the simple three on the phone table. |
| 5.5 | Proof of delivery: who received, signature, amount collected (COD) | Done | |
| 5.6 | Rider's own phone view | Done | `/driver` |
| 5.7 | Rider list (add / edit riders) | Missing | Drivers are fixed per route in the seed |
| 5.8 | **[changed]** A delivery goes either on a van route or to a rider (decision 0.5). Van routes keep temperature logs; rider drops track status and proof of delivery only. | Missing | Only van routes exist today |

## 6. Orders and sales

| # | Requirement | Status | Notes |
|---|---|---|---|
| 6.1 | Sales table: Products sold · Amount | Partial | Orders lists each order with its total. A per-product summary is missing. |
| 6.2 | Total sales at the bottom, computed automatically | Partial | Dashboard shows "Sold today". The sales table needs a total row. |
| 6.3 | **[changed]** Sales rules: **order placed → stock reserved**; **loaded / handed over → stock deducted**; **delivered (or paid at the counter) → counted as a sale**. Cancelled orders release the stock. Refused cases come back to stock and are credited. | Partial | Original said "a delivered order counts toward sales and deducts from inventory". Deducting only on delivery lets the counter sell stock that is already on a truck. The prototype does reserve and deduct correctly, but it counts a sale when the order is placed. Change that to delivered/paid. |
| 6.4 | Orders, delivery and sales are linked | Done | One order → one delivery, with shared status |
| 6.5 | **[changed]** Sales table can be filtered by date range and shows sales with and without VAT | Missing | Needed for BIR reporting |
| 6.6 | Customers list with terms, credit limit and balance | Done | `/clients` |

## 7. Receipts and invoicing

| # | Requirement | Status | Notes |
|---|---|---|---|
| 7.1 | **[changed]** Invoice/receipt with the details BIR requires: seller name, TIN and address; serial number; date; buyer; items; VATable sales, 12% VAT, total | Partial | Printable invoice with VAT breakdown exists. It still needs TIN, registered name/address and BIR serial numbering. |
| 7.2 | **[changed]** "BIR-accredited" is a **registration the business does**, not a feature. The software has to meet BIR rules for a computerized POS/invoicing system. The owner (with their accountant) applies for the permit before going live. | Missing | Original listed "BIR-accredited receipt generation" as a feature. Plan time for this process and confirm current requirements with the client's accountant. |
| 7.3 | Print a receipt for every sale | Done | Invoice view prints |
| 7.4 | Send the receipt by SMS or email | Missing | |

## 8. POS

| # | Requirement | Status | Notes |
|---|---|---|---|
| 8.1 | Counter POS for recording sales | Done | `/counter`: tier pricing, payment method (cash, GCash, card, check, on account), credit hold |
| 8.2 | Each sale deducts from inventory | Done | Walk-in deducts right away; delivery reserves and then deducts on loading (see 6.3) |

## 9. E-commerce

| # | Requirement | Status | Notes |
|---|---|---|---|
| 9.1 | Online ordering for customers | Missing | Scope depends on decision 0.7 |
| 9.2 | Online orders go into the same orders, sales and inventory | Missing | Online orders should go through the same order step the counter uses (`placeOrder`), so reservations and sales rules match |
| 9.3 | **[changed]** Online payment (GCash / card) or cash on delivery | Missing | Not in the original list but needed for online orders |

## 10. Centralized system

| # | Requirement | Status | Notes |
|---|---|---|---|
| 10.1 | One system for POS, inventory, production, delivery, sales, e-commerce | Partial | Everything except production and e-commerce is in one app |
| 10.2 | Single shared database so every device stays in sync | Missing (deferred) | Prototype data lives in each browser's local storage, so two phones don't share data. A real database is deferred until the client signs off on the prototype. |
| 10.3 | **[changed]** Logins and roles: owner, counter, production, rider | Missing | Needed once data is shared, so riders can't edit prices and so on. |

---

## Keeping the prototype ready for a real API

The prototype has no backend yet, but every feature follows three rules. When the database lands, only `lib/store.ts` changes; the screens stay the same.

1. **Rules live in `lib/logic.ts`** as pure functions: pricing, fees, first-expiry-first-out allocation, stock rollups, sold-per-product. The server reuses the same functions, so prototype and production behave identically.
2. **Writes go through a store action** (`placeOrder`, `advance`, `receive`, …). Each action becomes one API endpoint, so components never change data directly.
3. **Shapes live in `lib/types.ts`**, and the API returns exactly those types. The seed (`lib/seed.ts`) is the test fixture for the database.

New features (Production, riders, products admin) add a type, a logic function where there is a rule, and a store action. They don't put logic inside a page.

## Future notes for the main app

Not built in the prototype. Do these once the client approves the prototype and the main app (with a real database) starts.

- **Offline delivery.** The rider/driver side must keep working with no signal: view stops, mark arrived/delivered, capture proof of delivery and COD collected. Store data on the phone in **IndexedDB** and queue each change. When the phone is back online, sync the queue to the database. Each queued change carries an id, so a retry doesn't apply it twice. Conflicts (e.g. dispatch reassigned a stop while the rider was offline) are flagged for dispatch to resolve rather than silently overwritten. The prototype's store actions (`advance`, `completeDelivery`, `reportException`) are the operations to queue.
- **Shared database and API**, logins and roles (10.2, 10.3).
- **E-commerce** (section 9) once its scope is decided (0.7).
- **BIR registration** of the invoicing system (7.2).

## Suggested build order (prototype, no database)

1. Get the open decision (0.7, e-commerce scope) from the client.
2. ~~Dashboard product grid (2.1–2.7)~~ Done.
3. ~~Production page (4.1–4.3)~~ Done. Next: rework the seed and the Reorder tab so finished goods come from production instead of supplier POs (4.6).
4. Phone bottom navigation (1.3–1.4).
5. Delivery table view and rider editing (5.1, 5.3, 5.7).
6. Sales table with totals; count a sale on delivery (6.1–6.3).
7. Add/edit products (2.8).
8. Later, with the database: logins, e-commerce, BIR fields, sending receipts.
