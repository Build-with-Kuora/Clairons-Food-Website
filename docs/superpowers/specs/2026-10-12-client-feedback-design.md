# Client feedback before the final prototype

Branch: `nelson`
Date: 2026-10-12
Status: designed. Building parts 1 (list price) and 2 (roles) now; part 3 (reservations) is deferred to a later round, part 4 (payroll) waits on the client.

## Goal

The client saw the prototype and asked for four things before they see the final version:

1. Prices on the sales table, also on the printed report and the CSV.
2. A payroll side. Nobody knows yet how the client runs payroll, so this goes into the spec only, as questions.
3. Make sure each role sees only what it should.
4. Reservations: a client can reserve products.

Success means:

- The sales table, its print and its CSV show each product's list price.
- Spec section 13 lists the payroll questions to take to the client. No payroll code.
- No role can open, link to, or act on a screen or action outside its role, whether by the menu, a link in a page, or typing the address.
- Staff and online customers can reserve products for a date. Stock on hand is held, the rest goes on Production's To make list, and a reservation turns into a normal order.
- `npm run lint` and `npm run build` pass.

## 1. List price on the sales table

- Sales by product (`app/sales/page.tsx`) gets a **List price** column after Sold: the product's price list C price (`prices.C`), per case, or per kg for catch-weight products.
- Amount stays what was actually charged. Clients on price lists A and B pay less, so Sold × List price does not have to equal Amount. The column header reads "List price" and the printed note says "List price is price list C. Amount is what was charged."
- The footer rows (Products, Delivery fees, Total) leave the column empty.
- The CSV (`salesCsv` in `lib/logic.ts`) gets a "List price" column after "Unit", with the same value. Other CSV headers keep their names (spec 12.4).
- A product no longer in the catalogue shows "–".

## 2. Roles

Four roles stay as they are (spec 10.3). The work is an audit with fixes:

| Screen | Admin | Staff | Rider | Customer | Logged out |
|---|---|---|---|---|---|
| Home `/` | Today | Today's work | → `/driver` | → `/shop` | Landing page |
| POS, Inventory, Delivery, Orders, Customers, Production | Yes | Yes | No | No | No |
| Sales `/sales` | Yes | No | No | No | No |
| Driver `/driver` | Yes | **No (changed)** | Yes | No | No |
| Store `/shop` | Browse, with banner | Browse, with banner | No | Yes | Browse only |
| Store checkout, My orders | No | No | No | Yes | → log in |
| Contact `/contact` | Yes | Yes | Yes | Yes | Yes |

Admin-only actions: add, edit or deactivate products and prices; approve an order past a credit hold; Mark refunded; Reset demo data.

Checked for every role:

1. **Typed address.** A screen outside the role goes to that role's home (`canOpen`, `redirectFor`). Includes sub-pages and `?next=` after logging in.
2. **Menus.** Sidebar, phone bottom bar and its menu sheet list only screens the role can open.
3. **Links inside pages.** No link, button, search result or toast points to a screen the role can't open (for example the Dashboard's link to `/sales` must only render for admin).
4. **Admin-only actions.** Hidden for staff, and the store action refuses them when the user is not admin, so a stray button can't do them either. Store actions get the role from `useAuth` at the call site, the same way they get `by`.

**Change:** staff can no longer open `/driver`. Dispatch works from Delivery; only riders and the owner use the handheld.

Every gap found is fixed and listed in SPEC.md 10.3. Login stays in the browser for the prototype; real checks on a server come with the main app.

## 3. Reservations

A client asks Clairon's to set products aside for a date. Whatever is in stock is held for them. Whatever is not is added to what Production should make. When the client is ready, the reservation becomes a normal order.

### Data (`lib/types.ts`)

```ts
interface ReservationLine {
  sku: string;
  qty: number;      // cases (or units) wanted
  allocs: Alloc[];  // batches held for it; sum ≤ qty
}

interface Reservation {
  id: string;
  number: string;           // RS-1, RS-2…
  clientId: string;
  createdAt: number;
  by: string;
  neededBy: string;         // date key, like a delivery date
  lines: ReservationLine[];
  channel?: "ONLINE";
  notes?: string;
  deposit?: { amount: number; method: "CASH" | "GCASH" | "CARD" | "BANK"; ref?: string; at: number; by: string };
  status: "OPEN" | "ORDERED" | "CANCELLED";
  orderId?: string;         // set when ORDERED
  extended?: { at: number; by: string; from: string }[];
  cancelled?: { at: number; by: string; reason: string };
  refund?: { amount: number; at?: number; by?: string };  // a deposit owed back
}
```

The store gets `reservations: Reservation[]` and a `counters.rs` number. Saved stores without them load with an empty list.

### Rules (`lib/logic.ts`)

- **Held stock counts as reserved.** `reservedByLot` adds the allocations of every open reservation, so held stock drops out of Available on Home, POS, Inventory and the store. Orders can't take it.
- **What gets held.** Earliest best-by first (same as orders), skipping any batch whose best-by falls before the needed-by date, and any batch on hold or still in the blast freezer.
- **To make.** `toMake` counts each open reservation's unheld cases (qty minus held) as extra demand, so Production sees them. The To make row says "includes 6 for RS-3".
- **Hold what's in stock now.** Once new stock is sellable, staff tap this on the reservation to hold more, by the same rule. It is a manual step, like moving a batch out of the blast freezer.
- **Needed-by date.** Today or later, not a Sunday (`dayError`).
- **Make it an order.** Allowed only once every line is fully held. Staff choose pick up at the counter or delivery on a day (delivery needs a route, so not the walk-in account), and a payment method the client's terms allow. The held stock is released and the order is placed through `placeOrder` at the client's **current** price list, so it gets an invoice number, reserves stock and counts as a sale by the usual rule (6.3). The reservation becomes ORDERED and links to the order.
- **Deposit.** Optional, recorded when reserving. When the reservation becomes an order, the deposit comes off what is still owed: the cash or card amount at the counter, the amount COD collects, or what is added to the account balance. The order stores `deposit` and the invoice shows "Less deposit" and "Balance due". A deposit larger than the order total is refused; staff lower the deposit or add products first.
- **Not picked up.** From the day after the needed-by date, the reservation shows on both Home screens under Needs attention ("Not picked up"). Nothing is released automatically. Staff either **Extend** it to a new date (batches whose best-by falls before the new date are let go and move to To make) or **Cancel** it.
- **Cancel.** Releases the held stock. A deposit becomes a refund owed on the reservation, shown on Orders and Home, and the owner taps Mark refunded once it is handed back (same as orders, 6.3).
- **Price.** A reservation shows the current price for the client's price list as a guide. The price is set when it becomes an order; the reservation does not lock it.
- Every action is logged: who, when, and for cancel why. Held and released stock appears in Stock history as HOLD and RELEASE movements with the reservation number.

Pure functions: `reservedByLot` (extended), `holdForReservation`, `reservationShort`, `reservationError`, `overdueReservations`, `depositSettlement`, `toMake` (extended).
Store actions: `reserve`, `holdReservation`, `extendReservation`, `cancelReservation`, `orderReservation`, `markReservationRefunded`.

### Screens

- **POS.** Order type pills become **Walk-in | Delivery | Reserve**. Reserve needs a client account (not the walk-in account), a needed-by date and optional notes and deposit (amount, method, reference). Products with no stock can still be added while reserving; the panel shows how many are held now and how many will be made. The button reads "Reserve for Thu 15 Oct". Afterwards a toast links to the reservation.
- **Orders.** New tab **Reservations** next to the order filters: Open, Not picked up, Made into orders, Cancelled. Each row: client, number, needed by, held / to make per line, deposit. Opening one shows Hold what's in stock now, Make it an order, Extend, Cancel and the log. 20 per page (`Pager`).
- **Home.** "Not picked up" and "Deposit to refund" lists under Needs attention, admin and staff. Refunds stay owner-only to mark.
- **Production.** To make includes reservation demand, with the reservation numbers.
- **Online store.** Checkout gets a choice: **Order now** or **Reserve for a date**. Reserving asks for the date and an optional deposit by GCash or card (simulated, as store payments are today, 9.3), or no deposit. My orders lists reservations with their status and lets the customer cancel an open one. Staff turn it into an order; it is delivered on the customer's route with cash on delivery for the balance.
- **Customers.** A client's panel lists their open reservations.

### Edge cases

- A product deactivated while reserved stays on the reservation; it can still become an order from held stock, but Hold now won't add more.
- A held batch written off or put on hold: the reservation loses that hold and the cases go back to To make. A short note shows on the reservation.
- Reset demo data clears reservations. The seed adds three: one fully held, one partly held, one past its date.

## 4. Payroll (spec only)

Added to SPEC.md as section 13 with status **To decide**. Nothing is built until the client explains how they pay people today. Questions to ask:

1. Who is paid through the system: production crew, van drivers and helpers, riders, counter and warehouse staff, office?
2. How is pay worked out: daily rate, monthly salary, per batch or per piece made, per delivery or per drop for riders, or a mix?
3. How often: twice a month (15th and 30th), weekly, or daily for some?
4. How is attendance kept today: logbook, biometric, none? Overtime, night shift and holiday pay?
5. Deductions: SSS, PhilHealth, Pag-IBIG, withholding tax. Does their accountant compute these, or should the app?
6. Cash advances and loans taken from pay?
7. 13th-month pay and leave?
8. Payslips: printed, sent by SMS or e-mail, or none?
9. Paid in cash, bank, or GCash?

What the app already records that payroll could use: "made by" on every production batch, and the rider or van on every delivery and proof of delivery.

## Testing

No test runner. For each part:

- `npm run lint` and `npm run build`.
- In the browser at 1440 × 900 and 375 × 812:
  - Sales: list price shows on screen, in print preview and in the downloaded CSV.
  - Roles: log in as each role; try every screen's address directly, every menu and in-page link; staff can't open `/driver` or Sales, and admin-only buttons are gone.
  - Reservations: reserve at the POS with stock and without (it appears on To make); Available drops; make and move a batch, Hold now, make it an order with a deposit (invoice shows Less deposit); cancel one with a deposit (refund owed, Mark refunded); one past its date shows on Home; reserve from the online store and cancel from My orders.

## Out of scope

- Payroll screens and calculations.
- Separate counter, production and dispatch logins (main app, 10.3).
- Locking a reservation's price.
- Releasing reservations automatically.
- Real payment for online deposits (9.3).
