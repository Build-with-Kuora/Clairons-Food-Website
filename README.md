# Coldline, Clairon's Foods

Prototype POS, cold-storage inventory and delivery tracking for a Metro Manila wholesaler of frozen Chinese-Filipino food and streetfood: siopao, siomai, hakaw, fish balls, kikiam, tocino, longganisa and more.

Prices are in Philippine pesos (₱, VAT-inclusive), temperatures in °C, weights in kg.

```bash
npm install
npm run dev   # http://localhost:3000
```

Everything runs in the browser. Data is seeded relative to the current time and saved in `localStorage`, so the demo always looks like a live morning. Use **Reset demo data** in the sidebar (admin only) to start over.

## Logins

The app opens on `/login`. There is no database yet, so the demo accounts live in `lib/auth.ts` and are checked in the browser. Every demo account uses the password `12345678`. Anyone can read these in the page source, so use them for the demo only.

| Account | Role | Lands on | Sees |
| --- | --- | --- | --- |
| `admin@clairon.com` | Admin (owner) | `/` Today | Everything: sales figures, the sales report, add/edit products and prices, approving orders past a credit hold, Reset demo data. |
| `staff@clairon.com` | Staff | `/` Today's work | A work queue (to pick and load, move out of blast freezer, to make, delivery problems, sell first, QA hold) and every screen except Sales. Products are read-only. |
| `rider@clairon.com` | Rider | `/driver` | The driver handheld only. |
| `customer@clairon.com` | Customer | `/shop` | The online store only: shop, check out, track their own orders. |

Anyone can browse `/shop` without logging in. Sign up makes a customer account, saved in that browser only. Forgot password shows a confirmation but sends nothing.

## Screens

| Route | What it does |
| --- | --- |
| `/login` | Log in, sign up, forgot password, show password. |
| `/` Today | Admin: Sales (counted when delivered, or when paid at the counter), stops delivered, trucks out, live route lines, a 14-day sales chart, and a "needs attention" list (exceptions, low stock, short-dated lots, held lots, accounts past due). Staff: Today's work, a queue of pick and load, blast freezer moves, what to make, delivery problems, sell-first lots and QA holds, with no money figures. |
| `/counter` | Wholesale order entry. Tier pricing per account, catch-weight items, FEFO lot reservation, ₱300 small-drop fee under ₱5,000, ₱150 fuel surcharge, credit hold with manager override, truck delivery or will-call, GCash/cash/card/check/on-account payment, printable invoice with 12% VAT breakdown. Type `SKU qty` (e.g. `DM-1001 4`) and Enter to add fast. Press `/` to focus search. |
| `/inventory` | **Products**: add, edit and deactivate products, each with its own selling unit (case, tub, tray…) and contents. Stock vs reorder point and par, lots with best-by and core temp at put-away, QA hold/release, cycle counts and write-offs, bin moves, movement ledger. Links to Production for what to make. |
| `/production` | Record a batch (it becomes a lot in the blast freezer), what to make next from reorder point and par, batches made, produced per product today and over 7 days. |
| `/dispatch` Delivery | **Routes**: each van route drawn as a line of stops, plus rider drops. **Table**: every stop for the day with rider or driver, customer, amount and status, and the rider can be changed until the stop leaves. **Riders**: add and edit motorbike riders. Per stop: change the delivery day before it is loaded, a note for the driver, status ladder with timestamps, ref van temperature trace against the −15°C frozen limit, proof of delivery (signature, receiver, product temp, shorts, COD collected), activity log. Advance picking, loading and dispatch from here. |
| `/sales` | Sales by product for any date range (today, 7 days, 30 days, this month, or custom): cases sold, VATable sales, 12% VAT and amount per product, with delivery fees and a total row. Prints as a report. Downloads as CSV for today, the last 7 days or the last 30 days. |
| `/orders` | All orders with invoice number, payment and delivery status. Sales invoice with BIR details (sample seller TIN and permit for now), print, send the receipt by SMS or e-mail, cancel (releases reserved stock). |
| `/clients` | Accounts with terms, credit use, past due, and full delivery history showing who signed and at what temperature. |
| `/driver` | Phone-sized handheld for van drivers and riders (log in as the rider): start route, arrive, unload, capture signature and temps, report problems. Open it in a second browser window next to Dispatch to watch updates sync. |
| `/shop` | Public online store: browse by category, search, see what is in stock, add to cart. Delivery fees match the counter (₱150, plus ₱300 under ₱5,000). |
| `/shop/checkout` | Customers only: delivery address (Metro Manila cities mapped to a van route), delivery day, GCash, card or cash on delivery. Payment is simulated; nothing is charged. The order goes through the same `placeOrder` as the counter, so it reserves stock, gets an invoice number, lands on Delivery and counts as a sale by the same rule. Staff see it in Orders tagged "Online". |
| `/shop/orders` | Customers only: their orders with a four-step tracker (placed, packed, out for delivery, delivered), payment status and what was delivered. |

On phones a bottom bar replaces the sidebar: Inventory, Production, Home, Delivery, and Sales (a menu with the sales table, Counter, Orders, Clients and Log out; staff see it as "More", without the sales table).

Freezer temperature monitoring is left out: live readings need sensors in the freezers (an embedded system), so the prototype doesn't fake them.

## How stock moves

1. **Order placed** (delivery): stock is reserved from the lots with the earliest best-by. On-hand doesn't change; "free to sell" drops.
2. **Loaded** on the truck: reserved cases leave on-hand and a `SHIP` movement is written per lot.
3. **Delivered**: proof of delivery is stored and the order counts as a sale (orders paid upfront and will-call count when placed). Refused or damaged cases come back as a `RETURN` and the account is credited.
4. **Will-call** sales deduct immediately.
5. **Production**: every batch creates a new lot in the blast freezer with a `PRODUCE` movement. It can't be sold until it is moved out of the blast freezer (ready 24 hours after it is made). Clairon's makes all its products, so there are no suppliers or purchase orders.

## Code map

- `lib/types.ts`: domain model (products with owner-set selling units, lots, movements, clients, orders, deliveries, route runs, production batches).
- `lib/logic.ts`: pure rules: FEFO allocation, stock rollups, pricing and fees, the sale rule and sales summary, VAT split, status flow.
- `lib/seed.ts`: deterministic demo data generator.
- `lib/store.ts`: Zustand store with every action (place order, advance delivery, POD, produce, adjust, hold).
- `components/`: shell, charts, route line, invoice, POD and signature pad, inventory modals.

## Next steps toward production

- Move the store to a real database and API (Postgres is a natural fit; the store actions map 1:1 to endpoints).
- Real auth on the server, replacing the front-end demo accounts, with finer roles (counter, warehouse, production, dispatch) and a reset e-mail.
- Real ref van and freezer telemetry instead of simulated readings.
- Payments, accounting export, and catch-weight capture from the pick scale.
