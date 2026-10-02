# Coldline, Clairon's Foods

Prototype POS, cold-storage inventory and delivery tracking for a Metro Manila wholesaler of frozen Chinese-Filipino food and streetfood: siopao, siomai, hakaw, fish balls, kikiam, tocino, longganisa and more.

Prices are in Philippine pesos (₱, VAT-inclusive), temperatures in °C, weights in kg.

```bash
npm install
npm run dev   # http://localhost:3000
```

Everything runs in the browser. Data is seeded relative to the current time and saved in `localStorage`, so the demo always looks like a live morning. Use **Reset demo data** in the sidebar to start over.

## Screens

| Route | What it does |
| --- | --- |
| `/` Today | Sales, stops delivered, trucks out, live route lines, freezer temps, and a "needs attention" list (exceptions, low stock, short-dated lots, held lots, accounts past due). |
| `/counter` | Wholesale order entry. Tier pricing per account, catch-weight items, FEFO lot reservation, ₱300 small-drop fee under ₱5,000, ₱150 fuel surcharge, credit hold with manager override, truck delivery or will-call, GCash/cash/card/check/on-account payment, printable invoice with 12% VAT breakdown. Type `SKU qty` (e.g. `DM-1001 4`) and Enter to add fast. Press `/` to focus search. |
| `/inventory` | Stock vs reorder point and par, lots with best-by and core temp at put-away, QA hold/release, cycle counts and write-offs, bin moves, movement ledger, freezer zone readouts. Links to Production for what to make. |
| `/production` | Record a batch (it becomes a lot in the blast freezer), what to make next from reorder point and par, batches made, produced per product today and over 7 days. |
| `/dispatch` | Each route drawn as a line of stops. Per stop: status ladder with timestamps, ref van temperature trace against the −15°C frozen limit, proof of delivery (signature, receiver, product temp, shorts, COD collected), activity log. Advance picking, loading and dispatch from here. |
| `/orders` | All orders with payment and delivery status, invoice view, cancel (releases reserved stock). |
| `/clients` | Accounts with terms, credit use, past due, and full delivery history showing who signed and at what temperature. |
| `/driver` | Phone-sized handheld for drivers: start route, arrive, unload, capture signature and temps, report problems. Open it in a second tab next to Dispatch to watch updates sync. |

## How stock moves

1. **Order placed** (delivery): stock is reserved from the lots with the earliest best-by. On-hand doesn't change; "free to sell" drops.
2. **Loaded** on the truck: reserved cases leave on-hand and a `SHIP` movement is written per lot.
3. **Delivered**: proof of delivery is stored. Refused or damaged cases come back as a `RETURN` and the account is credited.
4. **Will-call** sales deduct immediately.
5. **Production**: every batch creates a new lot in the blast freezer with a `PRODUCE` movement. Clairon's makes all its products, so there are no suppliers or purchase orders.

## Code map

- `lib/types.ts`: domain model (products, lots, movements, clients, orders, deliveries, route runs, production batches).
- `lib/logic.ts`: pure rules: FEFO allocation, stock rollups, pricing and fees, status flow.
- `lib/seed.ts`: deterministic demo data generator.
- `lib/store.ts`: Zustand store with every action (place order, advance delivery, POD, produce, adjust, hold).
- `components/`: shell, charts, route line, invoice, POD and signature pad, inventory modals.

## Next steps toward production

- Move the store to a real database and API (Postgres is a natural fit; the store actions map 1:1 to endpoints).
- Auth and roles (counter, warehouse, dispatch, driver, manager override).
- Real ref van and freezer telemetry instead of simulated readings.
- Payments, accounting export, and catch-weight capture from the pick scale.
