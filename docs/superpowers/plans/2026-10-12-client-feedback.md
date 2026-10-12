# Client Feedback (list price, roles, reservations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the list price to the sales report, lock every role to its own screens and actions, and let clients reserve products, before the client sees the final prototype.

**Architecture:** Every rule is a pure function in `lib/logic.ts` (or `lib/roles.ts`), tested with Node's built-in test runner. Every write is a store action in `lib/store.ts`. Screens only read the store and call actions. Reservations hold stock through the same `reservedByLot` map that orders use, so Available drops everywhere without touching each screen.

**Tech Stack:** Next.js 16.3 (app router, client components), React 19, Zustand 5 with `persist`, Tailwind 4, TypeScript 5, Node 24 (`node --test` with built-in type stripping).

**Spec:** `docs/superpowers/specs/2026-10-12-client-feedback-design.md` (and rows 4.7, 6.9, 6.10, 10.4 in `docs/SPEC.md`).

> **Scope for now (Nelson, 2026-10-12): build Tasks 0, 1, 2, 3 and 11 only.** Reservations (Tasks 4–10) stay in the spec and this plan for later; **do not build them now**. In Task 11, only mark 6.9 and 10.4 done; 4.7 and 6.10 stay Deferred. Review Focus items 1–3 and 5 are for the reservations tasks; item 4 applies now.

## Global Constraints

- Work on branch `nelson`. Nelson is the only author: **no `Co-Authored-By` trailer and no Claude footer** on any commit. Before each commit, tell Nelson what is in it and the real current time, and wait for a yes.
- `AGENTS.md`: this is Next.js 16.3, not the one you know. Before touching routing, `useSearchParams` or page files, read the matching guide in `node_modules/next/dist/docs/01-app/`.
- No new dependencies. Tests use `node --test`.
- Copy follows spec 12.4 (plain words): "Available", "Batch", "Problem", "Price list A/B/C", "Before VAT". CSV headers and the invoice keep their data names.
- Sizes come from the named scale (`text-caption` … `text-hero`); buttons use `.btn` (44 px), `.btn-sm` (40 px), chips `.chip`. No one-off pixel font sizes.
- Only the owner (role `admin`) may: add or edit products and prices, approve an order over the credit limit, mark a refund handed back, reset demo data.
- Staff may not open `/sales` or `/driver`. Admin and staff may browse `/shop` but not `/shop/checkout` or `/shop/orders`.
- Reservation needed-by date: today or later, never a Sunday. Held batches must be good through the end of that day.
- A reservation becomes an order at the client's **current** price list. Nothing is released automatically.
- `npm run lint`, `npm run build` and `npm test` pass at the end of every task.

## Review Focus

1. **Deposit larger than the order** (e.g. ₱5,000 deposit, products later lowered to ₱3,000): Make it an order must refuse with a clear message, never create a negative balance. Test in Task 4 (`depositError`) and Task 5 (`placeOrder` path, manual).
2. **A held batch is written off, put on QA hold, or sold down** after reserving: the reservation must show those cases as still to make and block Make it an order until Hold now tops it up. Test in Task 4 (`refreshHolds`).
3. **Extending the date past a held batch's best-by:** that hold is let go and moves to To make. Test in Task 4 (`refreshHolds` with a later date).
4. **Staff typing `/driver`, `/sales`, `/shop/checkout`** into the address bar: sent to their own home. Test in Task 2 (`canOpen`).
5. **Reserving for the walk-in account, a Sunday, or yesterday:** refused with a plain message. Test in Task 4 (`reservationError`).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `tests/ts-resolve.mjs` | Create | Import hook: adds `.ts` to relative imports so Node can load `lib/*.ts` |
| `tests/register.mjs` | Create | Registers the hook for `node --test` |
| `tests/sales.test.ts` | Create | List price in the CSV |
| `tests/roles.test.ts` | Create | `canOpen`, `homeFor` |
| `tests/credit.test.ts` | Create | `creditError` |
| `tests/reservations.test.ts` | Create | Reservation rules |
| `tests/deposit.test.ts` | Create | Deposit money rules |
| `tests/seed.test.ts` | Create | Seeded reservations |
| `tests/fixtures.ts` | Create | Small builders for products, lots, clients, orders |
| `package.json` | Modify | `"test"` script |
| `lib/roles.ts` | Create | `Role`, `homeFor`, `canOpen` (pure, no Zustand) |
| `lib/auth.ts` | Modify | Re-export from `roles.ts`; add `isOwner()` |
| `lib/types.ts` | Modify | `Reservation`, `ReservationLine`, `DepositMethod`, `Order.deposit` |
| `lib/logic.ts` | Modify | `listPrice`, CSV column, `creditError`, reservation rules, deposit rules, `toMake` with reservations |
| `lib/seed.ts` | Modify | `Data.reservations`, `counters.rs`, three demo reservations |
| `lib/store.ts` | Modify | Owner guards, deposit in `placeOrder`, reservation actions, load old saves |
| `lib/hooks.ts` | Modify | `useStock` counts reservations |
| `app/sales/page.tsx` | Modify | List price column and print note |
| `app/counter/page.tsx` | Modify | Reserve order type; credit approval passed to the store |
| `components/Reservations.tsx` | Create | Reservations list, detail drawer, Make it an order dialog |
| `app/orders/page.tsx` | Modify | Orders / Reservations tabs; deposit-aware cancel toast |
| `components/Invoice.tsx` | Modify | "Less deposit", "Balance due" |
| `components/Pod.tsx` | Modify | COD amount minus deposit |
| `components/Dashboard.tsx`, `components/StaffToday.tsx` | Modify | Not picked up, deposit refunds, To make with reservations |
| `app/production/page.tsx` | Modify | To make with reservation numbers |
| `app/clients/page.tsx` | Modify | Open reservations in the client drawer |
| `app/shop/page.tsx`, `app/shop/checkout/page.tsx`, `app/shop/orders/page.tsx` | Modify | Reserve for a date online; My orders lists reservations |
| `docs/SPEC.md`, spec doc | Modify | Statuses to Done, role audit findings |

---

### Task 0: Test harness

**Files:**
- Create: `tests/ts-resolve.mjs`, `tests/register.mjs`, `tests/fixtures.ts`, `tests/sales.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm test` runs every `tests/**/*.test.ts`. `tests/fixtures.ts` exports `product(over?)`, `lot(over?)`, `client(over?)`, `NOW`, `TODAY` used by later tasks.

- [ ] **Step 1: Write the import hook and its registration**

`tests/ts-resolve.mjs`:

```js
// Node 24 runs .ts files by stripping their types, but it won't guess a missing ".ts" on an import.
// lib/ imports "./format" and "./logic" the bundler way, so add the extension when Node can't find the file.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !specifier.endsWith(".ts")) return next(`${specifier}.ts`, context);
    throw err;
  }
}
```

`tests/register.mjs`:

```js
import { register } from "node:module";

register("./ts-resolve.mjs", import.meta.url);
```

- [ ] **Step 2: Add the script**

In `package.json` `"scripts"`, after `"lint": "eslint"`:

```json
    "lint": "eslint",
    "test": "node --import ./tests/register.mjs --test \"tests/**/*.test.ts\""
```

- [ ] **Step 3: Write fixtures**

`tests/fixtures.ts` (tests import without the `.ts` extension so `next build`'s type check accepts them):

```ts
import type { Client, Lot, Product } from "../lib/types";

/** Monday 12 October 2026, 9 am local. */
export const NOW = new Date(2026, 9, 12, 9, 0, 0).getTime();
export const TODAY = "2026-10-12";
export const DAY = 86_400_000;

export const product = (over: Partial<Product> = {}): Product => ({
  sku: "DM-1001",
  name: "Pork siomai",
  category: "Dimsum",
  unit: "case",
  pack: "10 × 50 pcs",
  caseKg: 10,
  catchWeight: false,
  zone: "FRZ",
  bin: "F-01-01",
  cost: 1000,
  price: { A: 2000, B: 2100, C: 2200 },
  reorderPoint: 10,
  par: 30,
  shelfDays: 180,
  active: true,
  ...over,
});

export const lot = (over: Partial<Lot> = {}): Lot => ({
  id: "lot-1",
  sku: "DM-1001",
  code: "L1",
  madeAt: NOW - 10 * DAY,
  // Far ahead, so rules that compare with the real clock still see it as good.
  bestBy: NOW + 3650 * DAY,
  madeQty: 20,
  qty: 20,
  bin: "F-01-01",
  coreTempC: -18,
  batch: "PB-0001",
  status: "AVAILABLE",
  ...over,
});

export const client = (over: Partial<Client> = {}): Client => ({
  id: "c-1",
  name: "Kusina ni Lola",
  type: "Restaurant",
  tier: "B",
  terms: "NET15",
  creditLimit: 50000,
  balance: 0,
  pastDue: 0,
  address: "Iznart St",
  city: "Iloilo City",
  contact: "Lola",
  phone: "0917 555 1234",
  routeId: "CTY",
  window: "8–10 am",
  dockNote: "",
  ...over,
});
```

- [ ] **Step 4: Write a smoke test on existing code**

`tests/sales.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { vatSplit } from "../lib/logic";

test("harness loads lib/logic.ts", () => {
  assert.deepEqual(vatSplit(112), { net: 100, vat: 12 });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: `# pass 1`, `# fail 0`. If Node reports `ERR_MODULE_NOT_FOUND` for `./format`, the hook didn't register: check the path in `register.mjs`. If it reports a syntax error in a `.ts` file, run `node --version` (needs 22.18+ or 24). **Do not add a dependency**; stop and tell Nelson.

- [ ] **Step 6: Lint and build**

Run: `npm run lint` then `npm run build`
Expected: both pass. If the build's type check flags `tests/`, add `"tests"` to `exclude` in `tsconfig.json`.

- [ ] **Step 7: Commit** (ask Nelson first, with the time)

```bash
git add package.json tests/
git commit -m "test: run lib rules with node --test"
```

---

### Task 1: List price on the sales table

**Files:**
- Modify: `lib/logic.ts` (`salesCsv` at ~476; add `listPrice` next to `casePrice` at ~136)
- Modify: `app/sales/page.tsx:296-357`
- Test: `tests/sales.test.ts`

**Interfaces:**
- Produces: `listPrice(p: Product): number` (price list C, per case, or per kg for catch weight). `salesCsv` gains a `List price` column after `Unit`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/sales.test.ts`:

```ts
import { listPrice, salesCsv, salesSummary } from "../lib/logic";
import { product } from "./fixtures";

test("list price is price list C, per kg for catch weight", () => {
  assert.equal(listPrice(product()), 2200);
  assert.equal(listPrice(product({ catchWeight: true, price: { A: 300, B: 315, C: 330 } })), 330);
});

test("CSV has a List price column after Unit", () => {
  const p = product();
  const sum = salesSummary([{ orderId: "o-1", clientId: "c-1", at: 5, lines: [{ sku: p.sku, qty: 2, amount: 4000 }], fees: 0, total: 4000 }], 0, 10);
  const lines = salesCsv(sum, new Map([[p.sku, p]]), "Today").trim().split("\r\n");
  assert.equal(lines[1], "SKU,Product,Unit,List price,Sold,Sales,VATable sales,VAT 12%,Amount");
  assert.equal(lines[2], "DM-1001,Pork siomai,case,2200.00,2,1,3571.43,428.57,4000.00");
  assert.equal(lines[3].split(",")[3], "", "Products total row leaves List price empty");
});

test("CSV list price is empty for a product no longer in the catalogue", () => {
  const sum = salesSummary([{ orderId: "o-1", clientId: "c-1", at: 5, lines: [{ sku: "GONE-1", qty: 1, amount: 100 }], fees: 0, total: 100 }], 0, 10);
  const row = salesCsv(sum, new Map(), "Today").split("\r\n")[2];
  assert.equal(row.split(",")[3], "");
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test`
Expected: FAIL, `listPrice` is not exported.

- [ ] **Step 3: Implement**

In `lib/logic.ts`, after `casePrice` (~line 136):

```ts
/** The price on the list everyone sees (price list C): per case, or per kg for catch-weight items. */
export const listPrice = (p: Product) => p.price.C;
```

In `salesCsv`, replace the header and row lines:

```ts
    row("SKU", "Product", "Unit", "List price", "Sold", "Sales", "VATable sales", "VAT 12%", "Amount"),
    ...sum.rows.map((r) => {
      const p = products.get(r.sku);
      return row(r.sku, p?.name ?? r.sku, p?.unit ?? "", p ? listPrice(p).toFixed(2) : "", r.qty, r.orders, ...money(r.amount));
    }),
    row("", "Products", "", "", sum.cases, "", ...money(sum.products)),
    row("", "Delivery fees (small drop, fuel)", "", "", "", "", ...money(sum.fees)),
    row("", "Total", "", "", sum.cases, sum.count, ...money(sum.total)),
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add the column to the screen and print**

In `app/sales/page.tsx`, add `listPrice, priceUnit` to the `@/lib/logic` import. In the print header (line ~300) change the note to:

```tsx
<div className="text-small text-ink-3">{label}. Amounts in pesos, prices include VAT. List price is price list C; Amount is what was charged.</div>
```

In `<thead>`, after `<th className="r">Sold</th>`:

```tsx
<th className="r">List price</th>
```

In the body row, after the Sold `<td>`:

```tsx
<td className="r whitespace-nowrap text-ink-2">
  {p ? (
    <>
      {money(listPrice(p))}
      <span className="text-small text-ink-3">/{priceUnit(p)}</span>
    </>
  ) : (
    "–"
  )}
</td>
```

In each of the three `<tfoot>` rows, add an empty cell after the Sold cell: `<td />`. Change `min-w-[720px]` on the table to `min-w-[820px]`.

Under the table (inside the `print-area` div, after `</table>`), add the on-screen note:

```tsx
<p className="px-4 py-3 hint print:hidden">List price is price list C. Accounts on price lists A and B pay less, so Amount can be less than Sold × List price.</p>
```

- [ ] **Step 6: Check in the browser**

Start the `dev` preview, log in as `admin@clairon.com`, open `/sales`, pick Last 30 days. Check: the List price column shows ₱ per case or /kg; print preview (`window.print()`) shows the column and the note fits on the page; "Download this period" CSV opens with the new column. At 375 px the table scrolls sideways inside its panel, the page doesn't.

- [ ] **Step 7: Lint, build, commit** (ask first)

```bash
git add lib/logic.ts app/sales/page.tsx tests/sales.test.ts
git commit -m "feat(sales): show each product's list price on screen, in print and in the CSV"
```

---

### Task 2: Roles: who may open what

**Files:**
- Create: `lib/roles.ts`
- Modify: `lib/auth.ts:6,33-54,57`
- Test: `tests/roles.test.ts`

**Interfaces:**
- Produces: `lib/roles.ts` exports `type Role`, `ROLE_LABEL`, `homeFor(role)`, `canOpen(role, path)`. `lib/auth.ts` re-exports all four (existing imports keep working) and adds `isOwner(): boolean` (reads `useAuth.getState()`), used by the store in Task 3 and Task 5.

- [ ] **Step 1: Write the failing tests**

`tests/roles.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { canOpen, homeFor } from "../lib/roles";

test("staff can't open the sales report or the rider handheld", () => {
  for (const p of ["/sales", "/sales/x", "/driver", "/driver/stop"]) assert.equal(canOpen("staff", p), false, p);
  for (const p of ["/", "/counter", "/inventory", "/dispatch", "/orders", "/clients", "/production", "/shop", "/contact"]) assert.equal(canOpen("staff", p), true, p);
});

test("admin and staff browse the store but don't check out or see My orders", () => {
  for (const role of ["admin", "staff"] as const) {
    assert.equal(canOpen(role, "/shop"), true);
    assert.equal(canOpen(role, "/shop/checkout"), false);
    assert.equal(canOpen(role, "/shop/orders"), false);
  }
});

test("admin opens every staff screen, the sales report and the driver view", () => {
  for (const p of ["/", "/sales", "/driver", "/counter", "/production"]) assert.equal(canOpen("admin", p), true, p);
});

test("riders only get the handheld, customers only the store", () => {
  assert.equal(canOpen("rider", "/driver"), true);
  assert.equal(canOpen("rider", "/"), false);
  assert.equal(canOpen("rider", "/shop"), false);
  assert.equal(canOpen("customer", "/shop/checkout"), true);
  assert.equal(canOpen("customer", "/orders"), false);
  assert.equal(canOpen("customer", "/"), false);
});

test("logged out: landing, login, store front and contact only", () => {
  for (const p of ["/", "/login", "/shop", "/contact"]) assert.equal(canOpen(undefined, p), true, p);
  for (const p of ["/shop/checkout", "/shop/orders", "/counter", "/sales", "/driver"]) assert.equal(canOpen(undefined, p), false, p);
});

test("a path that only starts like a screen is not that screen", () => {
  assert.equal(canOpen("staff", "/salesforce"), true);
});

test("each role lands on its own home", () => {
  assert.equal(homeFor("admin"), "/");
  assert.equal(homeFor("staff"), "/");
  assert.equal(homeFor("rider"), "/driver");
  assert.equal(homeFor("customer"), "/shop");
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test`
Expected: FAIL, cannot find `../lib/roles`.

- [ ] **Step 3: Create `lib/roles.ts`** (moved from `lib/auth.ts`, plus the new blocks)

```ts
export type Role = "admin" | "staff" | "rider" | "customer";

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", staff: "Staff", rider: "Rider", customer: "Customer" };

/** Where each role lands after logging in. Riders only get the driver handheld, customers the online store. */
export const homeFor = (role: Role) => (role === "rider" ? "/driver" : role === "customer" ? "/shop" : "/");

/** Screens staff never open: the owner's sales report, and the rider handheld (dispatch works from Delivery). */
const STAFF_BLOCKED = ["/sales", "/driver"];

/** Store pages that act as a customer. The team browses the store but orders through the POS. */
const CUSTOMER_ONLY = ["/shop/checkout", "/shop/orders"];

/**
 * What each role may open (spec 10.3, 10.4). Admin is the owner and sees every staff screen. Staff run the
 * counter, warehouse, production and dispatch. Riders only get the driver handheld. Customers only get the
 * online store. Anyone, logged in or not, can see the contact page and browse the store's catalogue.
 */
export function canOpen(role: Role | undefined, path: string) {
  const under = (p: string) => path === p || path.startsWith(`${p}/`);
  if (under("/contact")) return true;
  // Logged out, / is the landing page (spec 11.9).
  if (!role) return path === "/" || under("/login") || path === "/shop";
  if (role === "rider") return under("/driver");
  if (role === "customer") return under("/shop");
  if (CUSTOMER_ONLY.some(under)) return false;
  if (role === "staff") return !STAFF_BLOCKED.some(under);
  return true;
}
```

- [ ] **Step 4: Point `lib/auth.ts` at it**

In `lib/auth.ts`: delete the `Role` type (line 6), `ROLE_LABEL` (33), `homeFor` (35-36), the `STAFF_BLOCKED` comment and constant and `canOpen` (38-54). Add at the top, after the zustand imports:

```ts
import type { Role } from "./roles";

export { ROLE_LABEL, canOpen, homeFor, type Role } from "./roles";
```

After `useIsAdmin`, add:

```ts
/** For store actions: whether the person logged in on this device is the owner. */
export const isOwner = () => useAuth.getState().user?.role === "admin";
```

- [ ] **Step 5: Run the tests, lint, build**

Run: `npm test`, `npm run lint`, `npm run build`
Expected: all pass.

- [ ] **Step 6: Commit** (ask first)

```bash
git add lib/roles.ts lib/auth.ts tests/roles.test.ts
git commit -m "feat(roles): keep staff out of the driver view and the team out of store checkout"
```

---

### Task 3: Owner-only actions refused by the store, and the role audit

**Files:**
- Modify: `lib/logic.ts` (add `creditError` near `paymentError` ~331)
- Modify: `lib/store.ts` (`PlaceOrderInput` ~58, `placeOrder` ~210, `saveProduct` ~590, `markRefunded` ~653)
- Modify: `app/counter/page.tsx:116-125,158-170`
- Test: `tests/credit.test.ts`

**Interfaces:**
- Consumes: `isOwner()` from `lib/auth.ts` (Task 2).
- Produces: `creditError(client: Client, payMethod: PayMethod, total: number): string | null`. `PlaceOrderInput.approveCredit?: boolean`. `saveProduct`, `markRefunded` return `{ ok: false, error: "Only the owner can …" }` for non-owners.

- [ ] **Step 1: Write the failing tests**

`tests/credit.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { creditError } from "../lib/logic";
import { client } from "./fixtures";

test("no credit problem when not charging the account", () => {
  assert.equal(creditError(client({ pastDue: 999 }), "CASH", 1000), null);
});

test("past-due accounts can't take more on account", () => {
  assert.match(creditError(client({ pastDue: 1500 }), "ACCOUNT", 1000) ?? "", /₱1,500\.00 past due/);
});

test("an order that takes the account over its limit is flagged", () => {
  assert.match(creditError(client({ balance: 45000, creditLimit: 50000 }), "ACCOUNT", 6000) ?? "", /over the ₱50,000 limit/);
  assert.equal(creditError(client({ balance: 45000, creditLimit: 50000 }), "ACCOUNT", 5000), null);
});

test("COD accounts have no credit to check", () => {
  assert.equal(creditError(client({ terms: "COD", pastDue: 10 }), "ACCOUNT", 1000), null);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test` — Expected: FAIL, `creditError` not exported.

- [ ] **Step 3: Implement `creditError`** (moved from the POS so the store can check it too)

In `lib/logic.ts` after `paymentError`:

```ts
/** Why charging `total` to this account needs the owner's approval, or null when it doesn't. Same check the POS shows. */
export function creditError(c: Client, payMethod: PayMethod, total: number): string | null {
  if (payMethod !== "ACCOUNT" || c.terms === "COD") return null;
  if (c.pastDue > 0) return `${money(c.pastDue)} past due on this account.`;
  const after = c.balance + total;
  if (after > c.creditLimit) return `This order takes the account to ${money0(after)}, over the ${money0(c.creditLimit)} limit.`;
  return null;
}
```

Add `money0` to the `./format` import at the top of `lib/logic.ts`. Check `money0(50000)` prints `₱50,000`; if the test's regex disagrees with `Intl` output, fix the test's expected text, not the function.

- [ ] **Step 4: Run tests** — Expected: PASS.

- [ ] **Step 5: Refuse owner-only actions in the store**

In `lib/store.ts` add `import { isOwner } from "./auth";` and `creditError` to the `./logic` import. In `PlaceOrderInput` add:

```ts
  /** The owner approved charging an account past its credit limit */
  approveCredit?: boolean;
```

In `placeOrder`, right after `const totals = orderTotals(subtotal, i.fulfillment);`:

```ts
        const credit = creditError(client, i.payMethod, totals.total);
        if (credit && !(i.approveCredit && isOwner())) return { ok: false, error: `${credit} Only the owner can approve it.` };
```

At the top of `saveProduct` and of `markRefunded`:

```ts
        if (!isOwner()) return { ok: false, error: "Only the owner can change products and prices." };
```

(use `"Only the owner can mark a refund handed back."` in `markRefunded`).

`reset` stays unguarded in the store: `Shell` calls it on first load for every role when there is no data. Its button is already admin-only (`Shell.tsx:229`).

- [ ] **Step 6: POS uses the shared rule and passes the approval**

In `app/counter/page.tsx` add `creditError` to the logic import; replace lines 116-124 (`creditAfter` stays for the bar):

```tsx
  const creditAfter = client ? client.balance + (pay === "ACCOUNT" ? totals.total : 0) : 0;
  const creditProblem = client ? creditError(client, pay, totals.total) : null;
```

In `submit()`'s `placeOrder({...})` call add `approveCredit: override,`.

- [ ] **Step 7: Run the role audit in the browser**

Start the preview. For each of `admin@`, `staff@`, `rider@`, `customer@clairon.com` (password in `lib/auth.ts` `DEMO_ACCOUNTS`) and logged out:
1. Type each address: `/`, `/counter`, `/inventory`, `/dispatch`, `/sales`, `/orders`, `/clients`, `/production`, `/driver`, `/shop`, `/shop/checkout`, `/shop/orders`, `/contact`. Each one either opens (per the table in the spec) or lands on the role's home.
2. Open the sidebar, phone bottom bar (resize to 375 px) and its menu sheet: only allowed screens are listed.
3. As staff: click every figure card and attention item on Home, every link in Orders, Customers, Delivery and Inventory, and use the header search; none leads to `/sales` or `/driver`. No "Edit", "Add product", "Mark refunded", "Manager approved this order" or "Reset demo data" control is shown.
4. As staff: on Inventory → Products, confirm no edit form opens; on POS, put together an order that takes an account over its limit and confirm Checkout stays disabled. As admin, tick "Manager approved this order" and confirm it goes through.

Write down every gap found. Fix each one in the component that shows it (hide the control with `useIsAdmin()` or drop the link when `!canOpen(role, href)`), then repeat the check.

- [ ] **Step 8: Lint, build, test, commit** (ask first)

```bash
git add lib/logic.ts lib/store.ts app/counter/page.tsx tests/credit.test.ts
git commit -m "feat(roles): the store refuses owner-only actions from other roles"
```

(Add any component files changed in Step 7 to the same commit and list the gaps in the message body.)

---

### Task 4: Reservation and deposit rules

**Files:**
- Modify: `lib/types.ts` (after `Order`, ~210; and `Order` itself)
- Modify: `lib/logic.ts`
- Test: `tests/reservations.test.ts`, `tests/deposit.test.ts`

**Interfaces:**
- Produces (types):

```ts
export type DepositMethod = "CASH" | "GCASH" | "CARD" | "BANK";

export interface ReservationLine {
  sku: string;
  /** Units wanted */
  qty: number;
  /** Batches held for it; together never more than qty */
  allocs: Alloc[];
}

export interface Reservation {
  id: string;
  /** RS-1, RS-2… */
  number: string;
  clientId: string;
  createdAt: number;
  by: string;
  /** yyyy-mm-dd, like a delivery date */
  neededBy: string;
  lines: ReservationLine[];
  channel?: "ONLINE";
  notes?: string;
  deposit?: { amount: number; method: DepositMethod; ref?: string; at: number; by: string };
  status: "OPEN" | "ORDERED" | "CANCELLED";
  /** The order it became */
  orderId?: string;
  extended?: { at: number; by: string; from: string }[];
  cancelled?: { at: number; by: string; reason: string };
  /** A deposit owed back after cancelling, and when it was handed back */
  refund?: { amount: number; at?: number; by?: string };
}
```

`Order` gains `/** Paid ahead on the reservation this order came from; comes off what is due */ deposit?: number;`

- Produces (logic, all exported from `lib/logic.ts`):
  - `reservedByLot(orders, deliveries, reservations: Reservation[] = [])` — open reservations' holds count as reserved.
  - `holdFEFO(lots, sku, qty, reserved, neededBy, now = Date.now()): Alloc[]` — holds as much as it can, never null.
  - `heldQty(line: { allocs: Alloc[] }): number`
  - `refreshHolds(lines: ReservationLine[], lots: Lot[], neededBy: string): ReservationLine[]` — drops or trims holds on batches gone, on hold, freezing, or past best-by before the date.
  - `reservationShort(r: Reservation, lots: Lot[]): { sku: string; qty: number; held: number; short: number }[]`
  - `neededByError(date: string, today: string): string | null`
  - `reservationError(i: { clientId: string; lines: { sku: string; qty: number }[]; neededBy: string; deposit?: { amount: number; method: DepositMethod; ref?: string } }, opts: { today: string; client?: Client; products: Product[] }): string | null`
  - `overdueReservations(rs: Reservation[], today: string): Reservation[]` — open and needed before today, oldest first.
  - `reservationDemand(rs: Reservation[], lots: Lot[]): Map<string, { qty: number; numbers: string[] }>`
  - `toMake(rows, reservations: Reservation[] = [], lots: Lot[] = [])` returns `{ row, qty, forReservations: string[] }[]`
  - `depositError(deposit: number, total: number): string | null`
  - `codDue(order: Order, credit: number): number`
  - `amountDue` subtracts `order.deposit`.
  - `cancelSettlement(o: Order): { balance: number; refund: number }` (**signature change**: amount off the balance, and money owed back).
  - `DEPOSIT_LABEL: Record<DepositMethod, string>`

- [ ] **Step 1: Add the types** (code above) to `lib/types.ts`.

- [ ] **Step 2: Write the failing reservation tests**

`tests/reservations.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { holdFEFO, neededByError, overdueReservations, refreshHolds, reservationDemand, reservationError, reservationShort, reservedByLot, toMake, stockRows } from "../lib/logic";
import type { Reservation } from "../lib/types";
import { DAY, NOW, TODAY, client, lot, product } from "./fixtures";

const end = (key: string) => new Date(`${key}T00:00:00`).getTime() + DAY;

const rs = (over: Partial<Reservation> = {}): Reservation => ({
  id: "rs-1",
  number: "RS-1",
  clientId: "c-1",
  createdAt: NOW,
  by: "Counter 1",
  neededBy: "2026-10-15",
  lines: [{ sku: "DM-1001", qty: 5, allocs: [{ lotId: "lot-1", lotCode: "L1", qty: 5 }] }],
  status: "OPEN",
  ...over,
});

test("open reservations count as reserved stock; ordered and cancelled ones don't", () => {
  assert.deepEqual(reservedByLot([], [], [rs()]), { "lot-1": 5 });
  assert.deepEqual(reservedByLot([], [], [rs({ status: "ORDERED" }), rs({ status: "CANCELLED" })]), {});
});

test("held stock drops out of Available", () => {
  const rows = stockRows([product()], [lot({ qty: 20 })], reservedByLot([], [], [rs()]), NOW);
  assert.equal(rows.get("DM-1001")!.available, 15);
});

test("hold takes what it can, earliest best-by first, and leaves the rest to make", () => {
  const lots = [lot({ id: "a", code: "A", qty: 3, bestBy: NOW + 20 * DAY }), lot({ id: "b", code: "B", qty: 4, bestBy: NOW + 10 * DAY })];
  assert.deepEqual(holdFEFO(lots, "DM-1001", 10, {}, "2026-10-15", NOW), [
    { lotId: "b", lotCode: "B", qty: 4 },
    { lotId: "a", lotCode: "A", qty: 3 },
  ]);
});

test("hold skips batches already reserved, on hold, freezing, or past best-by before the date", () => {
  const lots = [
    lot({ id: "taken", qty: 5 }),
    lot({ id: "qa", status: "HOLD" }),
    lot({ id: "blast", bin: "B-01-01" }),
    lot({ id: "short-dated", bestBy: end("2026-10-15") - 1 }),
    lot({ id: "ok", qty: 2, bestBy: end("2026-10-15") }),
  ];
  assert.deepEqual(holdFEFO(lots, "DM-1001", 9, { taken: 5 }, "2026-10-15", NOW), [{ lotId: "ok", lotCode: "L1", qty: 2 }]);
});

test("holds on a batch written off, put on hold or expiring before a later date are let go", () => {
  const lines = [{ sku: "DM-1001", qty: 6, allocs: [
    { lotId: "gone", lotCode: "G", qty: 2 },
    { lotId: "qa", lotCode: "Q", qty: 2 },
    { lotId: "soon", lotCode: "S", qty: 1 },
    { lotId: "low", lotCode: "W", qty: 4 },
  ] }];
  const lots = [
    lot({ id: "qa", status: "HOLD" }),
    lot({ id: "soon", bestBy: end("2026-10-20") - 1 }),
    lot({ id: "low", qty: 1 }),
  ];
  assert.deepEqual(refreshHolds(lines, lots, "2026-10-20", NOW)[0].allocs, [{ lotId: "low", lotCode: "W", qty: 1 }]);
});

test("short shows what is still to make", () => {
  const r = rs({ lines: [{ sku: "DM-1001", qty: 8, allocs: [{ lotId: "lot-1", lotCode: "L1", qty: 5 }] }] });
  assert.deepEqual(reservationShort(r, [lot()]), [{ sku: "DM-1001", qty: 8, held: 5, short: 3 }]);
});

test("needed-by: today or later, not a Sunday", () => {
  assert.equal(neededByError(TODAY, TODAY), null);
  assert.match(neededByError("2026-10-11", TODAY) ?? "", /today or a later day/);
  assert.match(neededByError("2026-10-18", TODAY) ?? "", /Sunday/);
  assert.match(neededByError("", TODAY) ?? "", /Pick a date/);
});

test("reservation checks: account, products, quantity, deposit", () => {
  const ok = { clientId: "c-1", lines: [{ sku: "DM-1001", qty: 2 }], neededBy: "2026-10-15" };
  const opts = { today: TODAY, client: client(), products: [product()] };
  assert.equal(reservationError(ok, opts), null);
  assert.match(reservationError(ok, { ...opts, client: undefined }) ?? "", /customer account/);
  assert.match(reservationError(ok, { ...opts, client: client({ id: "walk-in", type: "Walk-in" }) }) ?? "", /customer account/);
  assert.match(reservationError({ ...ok, lines: [] }, opts) ?? "", /at least one product/);
  assert.match(reservationError({ ...ok, lines: [{ sku: "DM-1001", qty: 1.5 }] }, opts) ?? "", /whole number/);
  assert.match(reservationError(ok, { ...opts, products: [product({ active: false })] }) ?? "", /no longer sold/);
  assert.match(reservationError({ ...ok, deposit: { amount: -1, method: "CASH" } }, opts) ?? "", /deposit/i);
  assert.match(reservationError({ ...ok, neededBy: "2026-10-18" }, opts) ?? "", /Sunday/);
});

test("not picked up: open and needed before today, oldest first", () => {
  const list = [rs({ id: "a", neededBy: "2026-10-10" }), rs({ id: "b", neededBy: TODAY }), rs({ id: "c", neededBy: "2026-10-09" }), rs({ id: "d", neededBy: "2026-10-01", status: "CANCELLED" })];
  assert.deepEqual(overdueReservations(list, TODAY).map((r) => r.id), ["c", "a"]);
});

test("To make adds reserved cases still to make, with the reservation numbers", () => {
  const p = product({ reorderPoint: 2, par: 10 });
  const rows = stockRows([p], [lot({ qty: 20 })], {}, NOW);
  const r = rs({ lines: [{ sku: p.sku, qty: 26, allocs: [{ lotId: "lot-1", lotCode: "L1", qty: 20 }] }] });
  assert.deepEqual(reservationDemand([r], [lot({ qty: 20 })]).get(p.sku), { qty: 6, numbers: ["RS-1"] });
  const [first] = toMake(rows.values(), [r], [lot({ qty: 20 })]);
  assert.equal(first.qty, 6);
  assert.deepEqual(first.forReservations, ["RS-1"]);
});
```

- [ ] **Step 3: Write the failing deposit tests**

`tests/deposit.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { amountDue, cancelSettlement, codDue, depositError } from "../lib/logic";
import type { Order } from "../lib/types";

const order = (over: Partial<Order> = {}): Order => ({
  id: "o-1", number: "SO-1", invoiceNo: 1, clientId: "c-1", createdAt: 0, by: "x",
  lines: [{ sku: "DM-1001", name: "Pork siomai", qty: 2, unitPrice: 2000, catchWeight: false, lineTotal: 4000, allocs: [] }],
  subtotal: 4000, dropFee: 0, fuel: 150, total: 4150, payMethod: "ACCOUNT", paid: false, fulfillment: "DELIVERY", status: "OPEN",
  ...over,
});

test("a deposit can't be more than the order", () => {
  assert.equal(depositError(1000, 4150), null);
  assert.equal(depositError(4150, 4150), null);
  assert.match(depositError(5000, 4150) ?? "", /more than/);
});

test("deposit comes off what an account still owes", () => {
  assert.equal(amountDue(order({ deposit: 1000 })), 3150);
});

test("COD collects the total less refused cases less the deposit, never below zero", () => {
  assert.equal(codDue(order({ payMethod: "COD", deposit: 1000 }), 0), 3150);
  assert.equal(codDue(order({ payMethod: "COD", deposit: 1000 }), 4000), 0);
});

test("cancelling: account balance comes down by what was charged, the deposit is owed back", () => {
  assert.deepEqual(cancelSettlement(order({ deposit: 1000 })), { balance: 3150, refund: 1000 });
  assert.deepEqual(cancelSettlement(order()), { balance: 4150, refund: 0 });
  assert.deepEqual(cancelSettlement(order({ payMethod: "CASH", paid: true, deposit: 1000 })), { balance: 0, refund: 4150 });
  assert.deepEqual(cancelSettlement(order({ payMethod: "COD", deposit: 1000 })), { balance: 0, refund: 1000 });
  assert.deepEqual(cancelSettlement(order({ payMethod: "COD" })), { balance: 0, refund: 0 });
});
```

- [ ] **Step 4: Run to see them fail**

Run: `npm test` — Expected: FAIL on missing exports.

- [ ] **Step 5: Implement the rules in `lib/logic.ts`**

Add `DepositMethod, Reservation, ReservationLine` to the type import.

Replace `reservedByLot`:

```ts
/** Stock tied to orders that have not left the building yet, and to open reservations. */
export function reservedByLot(orders: Order[], deliveries: Delivery[], reservations: Reservation[] = []) {
  const byId = new Map(deliveries.map((d) => [d.id, d]));
  const out: Record<string, number> = {};
  for (const o of orders) {
    if (o.status !== "OPEN" || !o.deliveryId) continue;
    const d = byId.get(o.deliveryId);
    if (!d || !RESERVING.includes(d.status)) continue;
    for (const l of o.lines) for (const a of l.allocs) out[a.lotId] = (out[a.lotId] ?? 0) + a.qty;
  }
  for (const r of reservations) {
    if (r.status !== "OPEN") continue;
    for (const l of r.lines) for (const a of l.allocs) out[a.lotId] = (out[a.lotId] ?? 0) + a.qty;
  }
  return out;
}
```

After `allocateFEFO`, add the reservation rules:

```ts
/** A batch can be held for a reservation when it is released, out of the blast freezer and good through the needed-by day. */
const holdable = (l: Lot, neededBy: string, now: number) => l.status === "AVAILABLE" && !isFreezing(l) && l.qty > 0 && l.bestBy > now && l.bestBy >= keyToTs(neededBy) + DAY;

/** Holds as much of `qty` as free stock allows, earliest best-by first. What can't be held is left to make. */
export function holdFEFO(lots: Lot[], sku: string, qty: number, reserved: Record<string, number>, neededBy: string, now = Date.now()): Alloc[] {
  const out: Alloc[] = [];
  let left = qty;
  for (const l of lots.filter((x) => x.sku === sku && holdable(x, neededBy, now)).sort((a, b) => a.bestBy - b.bestBy)) {
    if (left <= 0) break;
    const take = Math.min(l.qty - (reserved[l.id] ?? 0), left);
    if (take <= 0) continue;
    out.push({ lotId: l.id, lotCode: l.code, qty: take });
    left -= take;
  }
  return out;
}

export const heldQty = (l: { allocs: Alloc[] }) => l.allocs.reduce((t, a) => t + a.qty, 0);

/** Holds that still stand: the batch is still there, released, out of the blast freezer and good through `neededBy`. Trimmed to what is left of it. */
export function refreshHolds(lines: ReservationLine[], lots: Lot[], neededBy: string, now = Date.now()): ReservationLine[] {
  const byId = new Map(lots.map((l) => [l.id, l]));
  return lines.map((line) => ({
    ...line,
    allocs: line.allocs.flatMap((a) => {
      const l = byId.get(a.lotId);
      if (!l || !holdable(l, neededBy, now)) return [];
      return [{ ...a, qty: Math.min(a.qty, l.qty) }];
    }),
  }));
}

/** Per line: wanted, held now, and still to make. */
export function reservationShort(r: Reservation, lots: Lot[]) {
  return refreshHolds(r.lines, lots, r.neededBy).map((l) => {
    const held = heldQty(l);
    return { sku: l.sku, qty: l.qty, held, short: Math.max(0, l.qty - held) };
  });
}

/** Why a reservation can't be needed on `date`, or null when it can. */
export function neededByError(date: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick a date.";
  if (date < today) return "Pick today or a later day.";
  if (!isDeliveryDay(date)) return "We are closed on Sundays. Pick another day.";
  return null;
}

export const DEPOSIT_LABEL: Record<DepositMethod, string> = { CASH: "Cash", GCASH: "GCash", CARD: "Card", BANK: "Bank transfer" };

type ReserveCheck = { clientId: string; lines: { sku: string; qty: number }[]; neededBy: string; deposit?: { amount: number; method: DepositMethod; ref?: string } };

/** What is wrong with a reservation before it is saved, or null when it is fine. */
export function reservationError(i: ReserveCheck, opts: { today: string; client?: Client; products: Product[] }): string | null {
  if (!opts.client || isWalkIn(opts.client)) return "Pick the customer account to reserve for.";
  const lines = i.lines.filter((l) => l.qty !== 0);
  if (!lines.length) return "Add at least one product to reserve.";
  for (const l of lines) {
    const p = opts.products.find((x) => x.sku === l.sku);
    if (!Number.isInteger(l.qty) || l.qty < 0) return `Reserve a whole number of ${p ? p.unit : "units"}.`;
    if (!p?.active) return `${p?.name ?? l.sku} is no longer sold. Take it off the reservation.`;
  }
  if (i.deposit && !(i.deposit.amount >= 0)) return "Enter the deposit as an amount, or leave it empty.";
  return neededByError(i.neededBy, opts.today);
}

/** Open reservations whose day has passed: the client hasn't picked them up. Oldest first. */
export const overdueReservations = (rs: Reservation[], today: string) =>
  rs.filter((r) => r.status === "OPEN" && r.neededBy < today).sort((a, b) => a.neededBy.localeCompare(b.neededBy));

/** Reserved units not in stock yet, per product, with which reservations want them. */
export function reservationDemand(rs: Reservation[], lots: Lot[]) {
  const out = new Map<string, { qty: number; numbers: string[] }>();
  for (const r of rs) {
    if (r.status !== "OPEN") continue;
    for (const l of reservationShort(r, lots)) {
      if (l.short <= 0) continue;
      const d = out.get(l.sku) ?? { qty: 0, numbers: [] };
      d.qty += l.short;
      if (!d.numbers.includes(r.number)) d.numbers.push(r.number);
      out.set(l.sku, d);
    }
  }
  return out;
}

/** Why a deposit can't go on an order of `total`, or null when it can. */
export function depositError(deposit: number, total: number) {
  if (round2(deposit) > round2(total)) return `The ${money(deposit)} deposit is more than this order's ${money(total)} total. Add products or lower the deposit.`;
  return null;
}

/** What the driver collects on a COD order: total, less refused cases, less any deposit. Never below zero. */
export const codDue = (o: Order, credit: number) => Math.max(0, round2(o.total - credit - (o.deposit ?? 0)));
```

Replace `toMake`:

```ts
/**
 * What to make next: active products whose free stock is under the reorder point, topped back up to par,
 * plus reserved units not in stock yet (spec 4.7).
 */
export function toMake(rows: Iterable<StockRow>, reservations: Reservation[] = [], lots: Lot[] = []) {
  const want = reservationDemand(reservations, lots);
  return [...rows]
    .filter((r) => r.product.active && (r.available < r.product.reorderPoint || want.has(r.product.sku)))
    .map((r) => {
      const w = want.get(r.product.sku);
      const low = r.available < r.product.reorderPoint ? r.product.par - r.available : 0;
      return { row: r, qty: low + (w?.qty ?? 0), forReservations: w?.numbers ?? [] };
    })
    .sort((a, b) => a.row.available / a.row.product.reorderPoint - b.row.available / b.row.product.reorderPoint);
}
```

Replace `amountDue` and `cancelSettlement`:

```ts
/** Still to pay on an on-account order: its total, less cases refused at the door, less any deposit, less what was already paid. */
export function amountDue(o: Order, d?: Delivery) {
  return round2(o.total - refusedCredit(o, d?.pod?.shorts ?? []) - (o.deposit ?? 0) - (o.paidAmount ?? 0));
}

/**
 * How a cancelled order is put right. `balance` comes off an on-account balance (what was charged to it,
 * so the total less any deposit). `refund` is owed back: the whole order when it was paid, else any deposit.
 */
export function cancelSettlement(o: Order): { balance: number; refund: number } {
  const deposit = o.deposit ?? 0;
  if (o.payMethod === "ACCOUNT") return { balance: round2(o.total - deposit), refund: deposit };
  if (o.paid) return { balance: 0, refund: o.total };
  return { balance: 0, refund: deposit };
}
```

- [ ] **Step 6: Fix the two callers of the old `cancelSettlement`**

`lib/store.ts` `cancelled()`:

```ts
function cancelled(s: Data, o: Order, by: string, reason: string): Partial<Data> {
  const settle = cancelSettlement(o);
  const at = Date.now();
  return {
    orders: s.orders.map((x) => (x.id === o.id ? { ...x, status: "CANCELLED", cancelled: { at, by, reason }, ...(settle.refund > 0 ? { refund: { amount: settle.refund } } : {}) } : x)),
    deliveries: s.deliveries.filter((x) => x.id !== o.deliveryId),
    clients: settle.balance > 0 ? s.clients.map((c) => (c.id === o.clientId ? { ...c, balance: round2(c.balance - settle.balance) } : c)) : s.clients,
  };
}
```

`app/orders/page.tsx` cancel toast (line ~187):

```tsx
toast(`${open.number} cancelled, stock put back${settle.refund > 0 ? `. Refund owed ${money(settle.refund)}` : ""}${settle.balance > 0 ? `. ${money(settle.balance)} off the balance` : ""}`);
```

Search for any other use: `rg "cancelSettlement|\.kind === \"REFUND\"|settle\.kind"` and update the same way.

- [ ] **Step 7: Run tests, lint, build**

Run: `npm test`, `npm run lint`, `npm run build` — Expected: all pass. (`toMake` callers still compile: the new parameters are optional.)

- [ ] **Step 8: Commit** (ask first)

```bash
git add lib/types.ts lib/logic.ts lib/store.ts app/orders/page.tsx tests/reservations.test.ts tests/deposit.test.ts
git commit -m "feat(reservations): rules for holding stock, to make, and deposits"
```

---

### Task 5: Reservation store actions, seed, and saved data

**Files:**
- Modify: `lib/seed.ts` (`Data` ~224, `buildSeed` return ~686)
- Modify: `lib/store.ts`
- Modify: `lib/hooks.ts:31-40`
- Test: `tests/seed.test.ts`

**Interfaces:**
- Consumes: everything Task 4 produces; `isOwner()` (Task 2); `PlaceOrderInput.approveCredit` (Task 3).
- Produces:
  - `Data.reservations: Reservation[]`, `Data.counters.rs: number`
  - `PlaceOrderInput.deposit?: number`
  - Store actions:

```ts
export interface ReserveInput {
  clientId: string;
  lines: { sku: string; qty: number }[];
  neededBy: string;
  notes?: string;
  deposit?: { amount: number; method: DepositMethod; ref?: string };
  by: string;
  channel?: "ONLINE";
}

export interface OrderReservationInput {
  fulfillment: "DELIVERY" | "PICKUP";
  /** Delivery day; ignored for pick up */
  date: string;
  payMethod: PayMethod;
  approveCredit?: boolean;
  by: string;
}

reserve(i: ReserveInput): { ok: true; reservation: Reservation } | { ok: false; error: string };
holdReservation(id: string, by: string): { ok: true; added: number } | { ok: false; error: string };
extendReservation(id: string, date: string, by: string): { ok: true; released: number } | { ok: false; error: string };
cancelReservation(id: string, by: string, reason: string): { ok: true } | { ok: false; error: string };
orderReservation(id: string, i: OrderReservationInput): { ok: true; order: Order } | { ok: false; error: string };
markReservationRefunded(id: string, by: string): { ok: true } | { ok: false; error: string };
```

  - `useStock()` reserved map includes open reservations.

- [ ] **Step 1: Write the failing seed test**

`tests/seed.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { dateKey } from "../lib/format";
import { overdueReservations, reservationShort } from "../lib/logic";
import { buildSeed } from "../lib/seed";
import { NOW } from "./fixtures";

test("the demo has one fully held, one partly held and one overdue reservation", () => {
  const s = buildSeed(NOW);
  assert.equal(s.reservations.length, 3);
  assert.equal(s.counters.rs, 3);
  const short = s.reservations.map((r) => reservationShort(r, s.lots).reduce((t, l) => t + l.short, 0));
  assert.equal(short.filter((n) => n === 0).length >= 1, true, "one fully held");
  assert.equal(short.some((n) => n > 0), true, "one with cases still to make");
  assert.equal(overdueReservations(s.reservations, dateKey(NOW)).length, 1);
  assert.ok(s.reservations.every((r) => r.clientId !== "walk-in"));
});
```

- [ ] **Step 2: Run to see it fail** — `npm test`, Expected: FAIL, `s.reservations` undefined.

- [ ] **Step 3: Seed reservations**

In `lib/seed.ts`: add `Reservation` to the type import and `holdFEFO, reservedByLot, deliveryDays` to the `./logic` import. In `Data` add `reservations: Reservation[];` and change counters to `counters: { so: number; batch: number; invoice: number; rs: number };`.

Before the `return` in `buildSeed`:

```ts
  // ---------- Reservations ----------
  // Three to show every state: fully held, partly held (the rest on To make), and one the client never picked up.
  const reserved = reservedByLot(orders, deliveries);
  const accounts = clients.filter((c) => c.terms !== "COD");
  const stockOf = (sku: string) => lots.filter((l) => l.sku === sku && l.status === "AVAILABLE" && zoneOfBin(l.bin) !== "BLAST").reduce((t, l) => t + l.qty - (reserved[l.id] ?? 0), 0);
  const ranked = [...products].sort((a, b) => stockOf(b.sku) - stockOf(a.sku));
  const [soon, later] = deliveryDays(now, 3);
  const plan: { client: Client; sku: string; qty: number; neededBy: string; createdAt: number; deposit?: Reservation["deposit"] }[] = [
    { client: accounts[0], sku: ranked[0].sku, qty: 4, neededBy: soon, createdAt: now - 1 * DAY },
    { client: accounts[1], sku: ranked[1].sku, qty: stockOf(ranked[1].sku) + 6, neededBy: later, createdAt: now - 2 * DAY, deposit: { amount: 2000, method: "GCASH", ref: "GC 4471 2290", at: now - 2 * DAY, by: "Counter 1" } },
    { client: accounts[2], sku: ranked[2].sku, qty: 3, neededBy: dateKey(now - DAY), createdAt: now - 5 * DAY, deposit: { amount: 1000, method: "CASH", at: now - 5 * DAY, by: "Counter 1" } },
  ];
  const reservations: Reservation[] = plan.map((p, i) => {
    const allocs = holdFEFO(lots, p.sku, p.qty, reserved, p.neededBy, now);
    for (const a of allocs) reserved[a.lotId] = (reserved[a.lotId] ?? 0) + a.qty;
    return {
      id: `rs-${i + 1}`,
      number: `RS-${i + 1}`,
      clientId: p.client.id,
      createdAt: p.createdAt,
      by: "Counter 1",
      neededBy: p.neededBy,
      lines: [{ sku: p.sku, qty: p.qty, allocs }],
      deposit: p.deposit,
      status: "OPEN",
    };
  });
```

In the returned object add `reservations,` and `counters: { so, batch: lots.length, invoice, rs: reservations.length },`. (If `dateKey`, `zoneOfBin` or `Client` aren't imported in `seed.ts` yet, add them.)

The overdue one holds stock "needed by yesterday": `holdFEFO` checks best-by against the end of yesterday, which any current batch passes.

- [ ] **Step 4: Run the test** — `npm test`, Expected: PASS. If the partly-held one is fully held because `stockOf` of the second product is 0, pick `ranked[1]` from products with `stockOf > 0` instead; the test, not the numbers, is the contract.

- [ ] **Step 5: Store state and loading old saves**

In `lib/store.ts`: add `reservations: [],` to `empty`, and `rs: 0` to its `counters`. Replace `merge`:

```ts
      // Demo data saved before walk-in sales or reservations existed: add what is missing rather than reseed.
      merge: (saved, current) => {
        const s = { ...current, ...(saved as Partial<Store>) };
        if (s.products.length && !s.clients.some((c) => c.id === WALK_IN_ID)) s.clients = [...s.clients, WALK_IN];
        if (!s.reservations) s.reservations = [];
        if (s.counters.rs === undefined) s.counters = { ...s.counters, rs: 0 };
        return s;
      },
```

Pass reservations everywhere `reservedByLot` is called: `lib/store.ts` lines ~217 and ~459 become `reservedByLot(s.orders, s.deliveries, s.reservations)`. In `lib/hooks.ts` `useStock`:

```ts
export function useStock() {
  const products = useStore((s) => s.products);
  const lots = useStore((s) => s.lots);
  const orders = useStore((s) => s.orders);
  const deliveries = useStore((s) => s.deliveries);
  const reservations = useStore((s) => s.reservations);
  return useMemo(() => {
    const reserved = reservedByLot(orders, deliveries, reservations);
    return { reserved, rows: stockRows(products, lots, reserved) };
  }, [products, lots, orders, deliveries, reservations]);
}
```

- [ ] **Step 6: Deposit in `placeOrder`**

Add to `PlaceOrderInput`:

```ts
  /** Paid ahead on a reservation; comes off what is due */
  deposit?: number;
```

In `placeOrder`, **replace** the two credit-check lines added in Task 3 with these (the deposit is checked first, and the account is only charged what is left after it):

```ts
        const deposit = round2(i.deposit ?? 0);
        const depositProblem = deposit > 0 ? depositError(deposit, totals.total) : null;
        if (depositProblem) return { ok: false, error: depositProblem };
        const credit = creditError(client, i.payMethod, round2(totals.total - deposit));
        if (credit && !(i.approveCredit && isOwner())) return { ok: false, error: `${credit} Only the owner can approve it.` };
```

In the `order` literal: `paid: ["CARD", "CASH", "CHECK", "GCASH"].includes(i.payMethod) || (deposit > 0 && deposit >= totals.total),` and `deposit: deposit || undefined,`. Change the account balance line to add `round2(order.total - deposit)`. Add `depositError` to the logic import.

- [ ] **Step 7: The reservation actions**

Add `Reservation, ReservationLine, DepositMethod, Alloc` to the type import; `heldQty, holdFEFO, neededByError, refreshHolds, reservationError, reservationShort` to the logic import. Add `ReserveInput` and `OrderReservationInput` (Interfaces above) next to the other input types, and the six signatures to `Actions`.

Helper above `useStore`:

```ts
/** One HOLD or RELEASE line in Stock history per batch, tagged with the reservation number. No cases move. */
const holdMoves = (r: Pick<Reservation, "number">, allocs: { sku: string; a: Alloc }[], type: "HOLD" | "RELEASE", by: string, note: string) =>
  allocs.map(({ sku, a }) => mv({ sku, lotCode: a.lotCode, type, qty: 0, ref: r.number, by, note: `${a.qty} ${note}` }));

const allocsOf = (lines: ReservationLine[]) => lines.flatMap((l) => l.allocs.map((a) => ({ sku: l.sku, a })));
```

Actions, inside the store object after `setHold`:

```ts
      reserve: (i) => {
        const s = get();
        const client = s.clients.find((c) => c.id === i.clientId);
        const error = reservationError(i, { today: dateKey(Date.now()), client, products: s.products });
        if (error || !client) return { ok: false, error: error ?? "Pick the customer account to reserve for." };
        const reserved = reservedByLot(s.orders, s.deliveries, s.reservations);
        const lines: ReservationLine[] = i.lines
          .filter((l) => l.qty > 0)
          .map((l) => {
            const allocs = holdFEFO(s.lots, l.sku, l.qty, reserved, i.neededBy);
            for (const a of allocs) reserved[a.lotId] = (reserved[a.lotId] ?? 0) + a.qty;
            return { sku: l.sku, qty: l.qty, allocs };
          });
        const now = Date.now();
        const n = s.counters.rs + 1;
        const deposit = i.deposit && i.deposit.amount > 0 ? { amount: round2(i.deposit.amount), method: i.deposit.method, ref: i.deposit.ref?.trim() || undefined, at: now, by: i.by } : undefined;
        const reservation: Reservation = {
          id: `rs-${n}`,
          number: `RS-${n}`,
          clientId: client.id,
          createdAt: now,
          by: i.by,
          neededBy: i.neededBy,
          lines,
          channel: i.channel,
          notes: i.notes?.trim() || undefined,
          deposit,
          status: "OPEN",
        };
        set({
          reservations: [reservation, ...s.reservations],
          movements: [...holdMoves(reservation, allocsOf(lines), "HOLD", i.by, `held for ${client.name}`), ...s.movements],
          counters: { ...s.counters, rs: n },
        });
        return { ok: true, reservation };
      },

      holdReservation: (id, by) => {
        const s = get();
        const r = s.reservations.find((x) => x.id === id);
        if (!r || r.status !== "OPEN") return { ok: false, error: "This reservation is no longer open." };
        const kept = refreshHolds(r.lines, s.lots, r.neededBy);
        const reserved = reservedByLot(s.orders, s.deliveries, s.reservations.filter((x) => x.id !== id));
        for (const l of kept) for (const a of l.allocs) reserved[a.lotId] = (reserved[a.lotId] ?? 0) + a.qty;
        const added: { sku: string; a: Alloc }[] = [];
        const lines = kept.map((l) => {
          const short = l.qty - heldQty(l);
          const active = s.products.find((p) => p.sku === l.sku)?.active;
          if (short <= 0 || !active) return l;
          const more = holdFEFO(s.lots, l.sku, short, reserved, r.neededBy);
          for (const a of more) {
            reserved[a.lotId] = (reserved[a.lotId] ?? 0) + a.qty;
            added.push({ sku: l.sku, a });
          }
          const allocs = [...l.allocs];
          for (const a of more) {
            const same = allocs.findIndex((x) => x.lotId === a.lotId);
            if (same >= 0) allocs[same] = { ...allocs[same], qty: allocs[same].qty + a.qty };
            else allocs.push(a);
          }
          return { ...l, allocs };
        });
        set({
          reservations: s.reservations.map((x) => (x.id === id ? { ...x, lines } : x)),
          movements: [...holdMoves(r, added, "HOLD", by, "more held"), ...s.movements],
        });
        return { ok: true, added: added.reduce((t, x) => t + x.a.qty, 0) };
      },

      extendReservation: (id, date, by) => {
        const s = get();
        const r = s.reservations.find((x) => x.id === id);
        if (!r || r.status !== "OPEN") return { ok: false, error: "This reservation is no longer open." };
        const error = neededByError(date, dateKey(Date.now()));
        if (error) return { ok: false, error };
        const lines = refreshHolds(r.lines, s.lots, date);
        const before = r.lines.reduce((t, l) => t + heldQty(l), 0);
        const released = before - lines.reduce((t, l) => t + heldQty(l), 0);
        const kept = new Set(lines.flatMap((l) => l.allocs.map((a) => a.lotId)));
        const dropped = allocsOf(r.lines).filter((x) => !kept.has(x.a.lotId));
        set({
          reservations: s.reservations.map((x) => (x.id === id ? { ...x, neededBy: date, lines, extended: [...(x.extended ?? []), { at: Date.now(), by, from: r.neededBy }] } : x)),
          movements: [...holdMoves(r, dropped, "RELEASE", by, "let go, past best-by before the new date"), ...s.movements],
        });
        return { ok: true, released };
      },

      cancelReservation: (id, by, reason) => {
        const s = get();
        const r = s.reservations.find((x) => x.id === id);
        if (!r || r.status !== "OPEN") return { ok: false, error: "This reservation is no longer open." };
        const at = Date.now();
        set({
          reservations: s.reservations.map((x) =>
            x.id === id ? { ...x, status: "CANCELLED", cancelled: { at, by, reason }, ...(r.deposit ? { refund: { amount: r.deposit.amount } } : {}) } : x,
          ),
          movements: [...holdMoves(r, allocsOf(r.lines), "RELEASE", by, "released, reservation cancelled"), ...s.movements],
        });
        return { ok: true };
      },

      orderReservation: (id, i) => {
        const s = get();
        const r = s.reservations.find((x) => x.id === id);
        if (!r || r.status !== "OPEN") return { ok: false, error: "This reservation is no longer open." };
        const missing = reservationShort(r, s.lots).find((l) => l.short > 0);
        if (missing) {
          const p = s.products.find((x) => x.sku === missing.sku);
          return { ok: false, error: `Hold the rest first: ${missing.short} ${p?.unit ?? "units"} of ${p?.name ?? missing.sku} still to make.` };
        }
        // Let go of the holds, then place the order the normal way: same prices, stock, invoice and sale rules.
        set({ reservations: s.reservations.map((x) => (x.id === id ? { ...x, status: "ORDERED" } : x)) });
        const res = get().placeOrder({
          clientId: r.clientId,
          lines: r.lines.map((l) => ({ sku: l.sku, qty: l.qty })),
          fulfillment: i.fulfillment,
          date: i.date,
          payMethod: i.payMethod,
          notes: r.notes,
          by: i.by,
          channel: r.channel,
          deposit: r.deposit?.amount,
          approveCredit: i.approveCredit,
        });
        const now = get();
        if (!res.ok) {
          set({ reservations: now.reservations.map((x) => (x.id === id ? r : x)) });
          return res;
        }
        set({
          reservations: now.reservations.map((x) => (x.id === id ? { ...x, status: "ORDERED", orderId: res.order.id } : x)),
          movements: [...holdMoves(r, allocsOf(r.lines), "RELEASE", i.by, `released into order ${res.order.number}`), ...now.movements],
        });
        return res;
      },

      markReservationRefunded: (id, by) => {
        if (!isOwner()) return { ok: false, error: "Only the owner can mark a refund handed back." };
        const s = get();
        const r = s.reservations.find((x) => x.id === id);
        if (!r?.refund) return { ok: false, error: "No deposit is owed back on this reservation." };
        if (r.refund.at) return { ok: false, error: "This deposit was already handed back." };
        set({ reservations: s.reservations.map((x) => (x.id === id ? { ...x, refund: { ...r.refund!, at: Date.now(), by } } : x)) });
        return { ok: true };
      },
```

- [ ] **Step 8: Run tests, lint, build** — all pass.

- [ ] **Step 9: Smoke check in the browser console**

Start the preview, log in as admin, click **Reset demo data**. On Inventory, the products the seed reserved show lower Available than On hand. Production's To make includes the partly held product.

- [ ] **Step 10: Commit** (ask first)

```bash
git add lib/seed.ts lib/store.ts lib/hooks.ts tests/seed.test.ts
git commit -m "feat(reservations): store actions, demo reservations, and deposits on orders"
```

---

### Task 6: Deposit on the invoice and at the door

**Files:**
- Modify: `components/Invoice.tsx:177-181`
- Modify: `components/Pod.tsx:107-113`

**Interfaces:**
- Consumes: `Order.deposit`, `codDue` (Task 4).

- [ ] **Step 1: Invoice lines**

In `components/Invoice.tsx`, after the Total `<div>` (line ~180) and before the paid/collect caption:

```tsx
          {!!order.deposit && (
            <>
              <div className="flex justify-between py-0.5 text-body">
                <dt>Less deposit</dt>
                <dd>−{money(order.deposit)}</dd>
              </div>
              <div className="flex justify-between py-0.5 text-body font-semibold">
                <dt>Balance due</dt>
                <dd>{money(Math.max(0, order.total - order.deposit))}</dd>
              </div>
            </>
          )}
```

VATable sales and VAT stay on the full total: the deposit is a payment, not a discount.

- [ ] **Step 2: Driver collects the balance**

In `components/Pod.tsx` add `codDue` to the logic import and replace line 110:

```tsx
  const due = codDue(order, credit);
```

- [ ] **Step 3: Check in the browser** after Task 7 makes an order from a reservation with a deposit (come back to this step then): the invoice shows Less deposit and Balance due; Delivery → that stop → proof of delivery prefills the balance.

- [ ] **Step 4: Lint, build, commit** (ask first)

```bash
git add components/Invoice.tsx components/Pod.tsx
git commit -m "feat(reservations): invoice and proof of delivery take the deposit off"
```

---

### Task 7: Reservations on Orders

**Files:**
- Create: `components/Reservations.tsx`
- Modify: `app/orders/page.tsx`

**Interfaces:**
- Consumes: store actions from Task 5; `reservationShort`, `overdueReservations`, `DEPOSIT_LABEL`, `deliveryDays`, `isDeliveryDay` from logic; `Tabs`, `Drawer`, `Modal`, `Pager`, `Badge`, `Empty`, `Field`, `Panel` from `components/ui.tsx`; `useIsAdmin`.
- Produces: `<ReservationsTab initialId?: string />` used by Orders; route `/orders?tab=reservations&id=rs-3` opens one.

- [ ] **Step 1: Read the Next.js guide for `useSearchParams`** in `node_modules/next/dist/docs/01-app/` (search the folder for `useSearchParams`) before editing the page.

- [ ] **Step 2: Create `components/Reservations.tsx`**

```tsx
"use client";

import { CalendarClock, PackagePlus, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Drawer, Empty, Field, Modal, Pager, cx } from "@/components/ui";
import { useIsAdmin } from "@/lib/auth";
import { dateTime, dayShort, keyToTs, money, units } from "@/lib/format";
import { useMaps, useToday } from "@/lib/hooks";
import { DEPOSIT_LABEL, PAY_LABEL, creditError, deliveryDays, isWalkIn, orderTotals, overdueReservations, priceLines, reservationShort } from "@/lib/logic";
import { useStore, useUi } from "@/lib/store";
import type { PayMethod, Reservation } from "@/lib/types";

type Filter = "open" | "late" | "ordered" | "cancelled";
const PAGE = 20;

export function ReservationsTab({ initialId }: { initialId?: string }) {
  const reservations = useStore((s) => s.reservations);
  const lots = useStore((s) => s.lots);
  const maps = useMaps();
  const { today } = useToday();
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | undefined>(initialId);

  const late = new Set(overdueReservations(reservations, today).map((r) => r.id));
  const list = reservations
    .filter((r) => (filter === "open" ? r.status === "OPEN" : filter === "late" ? late.has(r.id) : filter === "ordered" ? r.status === "ORDERED" : r.status === "CANCELLED"))
    .filter((r) => {
      const n = q.trim().toLowerCase();
      return !n || r.number.toLowerCase().includes(n) || (maps.client.get(r.clientId)?.name ?? "").toLowerCase().includes(n);
    })
    .sort((a, b) => a.neededBy.localeCompare(b.neededBy) || b.createdAt - a.createdAt);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const at = Math.min(page, pages - 1);
  const open = reservations.find((r) => r.id === openId);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4 sm:px-6">
        <div className="relative min-w-[240px] flex-1 md:max-w-[420px]">
          <Search size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="input pl-11" placeholder="Customer name or reservation number" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search reservations" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {([["open", "Open"], ["late", "Not picked up"], ["ordered", "Made into orders"], ["cancelled", "Cancelled"]] as const).map(([k, l]) => (
            <button key={k} className="chip" aria-pressed={filter === k} onClick={() => { setFilter(k); setPage(0); }}>
              {l}
              {k === "late" && late.size > 0 && ` (${late.size})`}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="tbl min-w-[820px]">
          <thead>
            <tr>
              <th className="pl-5 sm:pl-6">Customer</th>
              <th>Needed by</th>
              <th>Products</th>
              <th>Deposit</th>
              <th className="pr-5 sm:pr-6">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(at * PAGE, at * PAGE + PAGE).map((r) => {
              const short = reservationShort(r, lots);
              const toMake = short.reduce((t, l) => t + l.short, 0);
              return (
                <tr key={r.id} className="clickable" onClick={() => setOpenId(r.id)}>
                  <td className="pl-5 sm:pl-6">
                    <div className="font-semibold">
                      {maps.client.get(r.clientId)?.name}
                      {r.channel === "ONLINE" && <Badge tone="accent" className="ml-2 align-middle">Online</Badge>}
                    </div>
                    <div className="hint">Reservation {r.number}</div>
                  </td>
                  <td className={cx("whitespace-nowrap", late.has(r.id) ? "font-semibold text-bad" : "text-ink-2")}>{dayShort(keyToTs(r.neededBy))}</td>
                  <td className="text-ink-2">
                    {short.map((l) => (
                      <div key={l.sku}>
                        {maps.product.get(l.sku)?.name}: {l.held} of {l.qty} held{l.short > 0 && <span className="font-semibold text-warn">, {l.short} to make</span>}
                      </div>
                    ))}
                  </td>
                  <td className="text-ink-2">{r.deposit ? `${money(r.deposit.amount)}, ${DEPOSIT_LABEL[r.deposit.method]}` : "None"}</td>
                  <td className="pr-5 sm:pr-6">
                    {r.status === "ORDERED" ? <Badge tone="good">Made into an order</Badge> : r.status === "CANCELLED" ? <Badge>Cancelled</Badge> : late.has(r.id) ? <Badge tone="bad">Not picked up</Badge> : toMake ? <Badge tone="warn">{toMake} to make</Badge> : <Badge tone="good">All held</Badge>}
                    {r.refund && !r.refund.at && <Badge tone="warn" className="ml-1.5">Deposit to refund {money(r.refund.amount)}</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="No reservations here">Reserve at the POS with the Reserve order type.</Empty>}
      </div>
      <Pager page={at} pages={pages} onChange={setPage} />
      {open && <ReservationDrawer r={open} onClose={() => setOpenId(undefined)} />}
    </>
  );
}

function ReservationDrawer({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const lots = useStore((s) => s.lots);
  const hold = useStore((s) => s.holdReservation);
  const extend = useStore((s) => s.extendReservation);
  const cancel = useStore((s) => s.cancelReservation);
  const markRefunded = useStore((s) => s.markReservationRefunded);
  const toast = useUi((s) => s.toast);
  const maps = useMaps();
  const admin = useIsAdmin();
  const by = admin ? "Owner" : "Counter 1";
  const [ordering, setOrdering] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [days] = useState(() => deliveryDays(Date.now(), 12, true));
  const short = reservationShort(r, lots);
  const toMake = short.reduce((t, l) => t + l.short, 0);
  const isOpen = r.status === "OPEN";
  const c = maps.client.get(r.clientId);

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Reservation ${r.number}`}
      sub={`${c?.name}, needed by ${dayShort(keyToTs(r.neededBy))}. Made ${dateTime(r.createdAt)} by ${r.by}.`}
      footer={
        isOpen ? (
          <>
            <button className="btn btn-primary" disabled={toMake > 0} onClick={() => setOrdering(true)}>
              <ShoppingBag size={18} aria-hidden /> Make it an order
            </button>
            {toMake > 0 && (
              <button className="btn btn-dark" onClick={() => {
                const res = hold(r.id, by);
                toast(res.ok ? (res.added ? `${res.added} more held for ${r.number}` : "Nothing more in stock yet") : res.error, res.ok && res.added ? "ok" : "warn");
              }}>
                <PackagePlus size={18} aria-hidden /> Hold what&rsquo;s in stock now
              </button>
            )}
            <button className="btn btn-danger ml-auto" onClick={() => {
              const res = cancel(r.id, by, "Cancelled at the counter");
              toast(res.ok ? `${r.number} cancelled, stock released${r.deposit ? `. Deposit to refund ${money(r.deposit.amount)}` : ""}` : res.error);
            }}>
              <X size={18} aria-hidden /> Cancel reservation
            </button>
          </>
        ) : undefined
      }
    >
      {r.cancelled && <p className="mb-4 rounded-lg bg-sunk px-4 py-3 text-body">Cancelled {dateTime(r.cancelled.at)} by {r.cancelled.by}. {r.cancelled.reason}.</p>}
      {r.orderId && <p className="mb-4 rounded-lg bg-good-bg px-4 py-3 text-body">Made into order {maps.order.get(r.orderId)?.number}. <Link className="font-semibold underline" href={`/orders?id=${r.orderId}`}>Open the order</Link></p>}
      {r.refund && (
        <div className={cx("mb-4 flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 text-body", r.refund.at ? "bg-sunk" : "bg-warn-bg")}>
          <span className="flex-1">
            {r.refund.at ? `Deposit of ${money(r.refund.amount)} refunded ${dateTime(r.refund.at)} by ${r.refund.by}.` : `Deposit to refund: ${money(r.refund.amount)}. ${admin ? "Mark it once the money is handed back." : "The owner marks it once the money is handed back."}`}
          </span>
          {admin && !r.refund.at && (
            <button className="btn btn-dark btn-sm" onClick={() => { const res = markRefunded(r.id, "Owner"); toast(res.ok ? `${r.number}: deposit refunded` : res.error); }}>Mark refunded</button>
          )}
        </div>
      )}
      <h3 className="display mb-2 text-title font-semibold">Products</h3>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {short.map((l) => {
          const p = maps.product.get(l.sku);
          return (
            <li key={l.sku} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-body">
              <span className="font-semibold">{p?.name}</span>
              <span className="text-ink-2">
                {units(l.held, p?.unit ?? "unit")} of {l.qty} held{l.short > 0 && <span className="font-semibold text-warn">, {l.short} to make</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 text-body">
        <div>
          <dt className="text-small text-ink-3">Deposit</dt>
          <dd>{r.deposit ? `${money(r.deposit.amount)}, ${DEPOSIT_LABEL[r.deposit.method]}${r.deposit.ref ? ` ${r.deposit.ref}` : ""}` : "None"}</dd>
        </div>
        <div>
          <dt className="text-small text-ink-3">Notes</dt>
          <dd>{r.notes ?? <span className="text-ink-3">None</span>}</dd>
        </div>
        {r.extended?.map((e) => (
          <div key={e.at} className="col-span-2 text-small text-ink-2">Moved from {dayShort(keyToTs(e.from))} on {dateTime(e.at)} by {e.by}.</div>
        ))}
      </dl>
      {isOpen && (
        <div className="mt-6 flex flex-wrap items-end gap-2">
          <Field label="Move to another day" className="min-w-[220px] flex-1">
            <select className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)}>
              <option value="">Pick a day</option>
              {days.filter((d) => d !== r.neededBy).map((d) => <option key={d} value={d}>{dayShort(keyToTs(d))}</option>)}
            </select>
          </Field>
          <button className="btn btn-ghost" disabled={!newDate} onClick={() => {
            const res = extend(r.id, newDate, by);
            toast(res.ok ? `${r.number} moved to ${dayShort(keyToTs(newDate))}${res.released ? `, ${res.released} let go (past best-by), now to make` : ""}` : res.error, res.ok ? "ok" : "warn");
            if (res.ok) setNewDate("");
          }}>
            <CalendarClock size={18} aria-hidden /> Move
          </button>
        </div>
      )}
      {ordering && c && <OrderDialog r={r} onClose={() => setOrdering(false)} onDone={onClose} />}
    </Drawer>
  );
}

function OrderDialog({ r, onClose, onDone }: { r: Reservation; onClose: () => void; onDone: () => void }) {
  const maps = useMaps();
  const products = useStore((s) => s.products);
  const order = useStore((s) => s.orderReservation);
  const toast = useUi((s) => s.toast);
  const admin = useIsAdmin();
  const c = maps.client.get(r.clientId)!;
  const [how, setHow] = useState<"PICKUP" | "DELIVERY">(isWalkIn(c) || !c.routeId ? "PICKUP" : "DELIVERY");
  const [days] = useState(() => deliveryDays(Date.now(), 6, true));
  const [date, setDate] = useState(days.includes(r.neededBy) ? r.neededBy : days[0]);
  const payOptions: PayMethod[] = c.terms === "COD" ? (how === "DELIVERY" ? ["COD", "GCASH", "CARD", "CHECK"] : ["CASH", "GCASH", "CARD", "CHECK"]) : ["ACCOUNT", "CASH", "GCASH", "CARD", "CHECK"];
  const [pay, setPay] = useState<PayMethod>(payOptions[0]);
  const [approve, setApprove] = useState(false);
  const subtotal = priceLines(products, c, r.lines).reduce((t, l) => t + l.lineTotal, 0);
  const totals = orderTotals(subtotal, how);
  const deposit = r.deposit?.amount ?? 0;
  const credit = creditError(c, pay, Math.max(0, totals.total - deposit));

  return (
    <Modal open onClose={onClose} title={`Make ${r.number} an order`} width={520}
      footer={
        <button className="btn btn-primary" disabled={!!credit && !(admin && approve)} onClick={() => {
          const res = order(r.id, { fulfillment: how, date, payMethod: pay, approveCredit: approve, by: admin ? "Owner" : "Counter 1" });
          if (!res.ok) return toast(res.error, "warn");
          toast(`${r.number} is now order ${res.order.number}`);
          onDone();
        }}>
          {how === "PICKUP" ? `Charge ${money(Math.max(0, totals.total - deposit))}` : `Place order for ${dayShort(keyToTs(date)).split(",")[0]}`}
        </button>
      }>
      <div className="space-y-4">
        <div className="flex gap-2" role="radiogroup" aria-label="How">
          {(["PICKUP", "DELIVERY"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={how === m} className="chip" aria-pressed={how === m} disabled={m === "DELIVERY" && !c.routeId} onClick={() => { setHow(m); setPay((m === "DELIVERY" && c.terms === "COD") ? "COD" : payOptions[0]); }}>
              {m === "PICKUP" ? "Picks up at the counter" : "Deliver"}
            </button>
          ))}
        </div>
        {how === "DELIVERY" && (
          <Field label="Delivery day">
            <select className="input" value={date} onChange={(e) => setDate(e.target.value)}>
              {days.map((d) => <option key={d} value={d}>{dayShort(keyToTs(d))}</option>)}
            </select>
          </Field>
        )}
        <Field label="Payment">
          <select className="input" value={pay} onChange={(e) => setPay(e.target.value as PayMethod)}>
            {payOptions.map((p) => <option key={p} value={p}>{PAY_LABEL[p]}</option>)}
          </select>
        </Field>
        <dl className="space-y-1 text-body">
          <div className="flex justify-between"><dt className="text-ink-2">Total at price list {c.tier}</dt><dd>{money(totals.total)}</dd></div>
          {deposit > 0 && <div className="flex justify-between"><dt className="text-ink-2">Less deposit</dt><dd>−{money(deposit)}</dd></div>}
          <div className="flex justify-between font-semibold"><dt>Balance</dt><dd>{money(Math.max(0, totals.total - deposit))}</dd></div>
        </dl>
        {deposit > totals.total && <p className="rounded-lg bg-bad-bg px-3 py-2 text-small text-bad">The deposit is more than the order. Cancel the reservation to refund it, or add products at the POS.</p>}
        {credit && (
          <div className="rounded-lg bg-warn-bg px-3 py-2 text-small text-warn">
            Over the credit limit: {credit}
            {admin ? (
              <label className="mt-2 flex min-h-11 items-center gap-3 text-ink"><input type="checkbox" className="h-5 w-5 accent-ink" checked={approve} onChange={(e) => setApprove(e.target.checked)} /> Manager approved this order</label>
            ) : (
              <p className="mt-1 text-ink-2">Only the owner can approve an order over the credit limit.</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
```

Check `Drawer` accepts `footer={undefined}` and `Field` accepts `className` (it does, `ui.tsx:400`). If `Badge` has no `"accent"` tone, use the one Orders uses for "Online".

- [ ] **Step 3: Tabs on Orders**

In `app/orders/page.tsx`: import `Tabs` from `@/components/ui` and `ReservationsTab` from `@/components/Reservations`. In `Orders()` add:

```tsx
  const reservations = useStore((s) => s.reservations);
  const [tab, setTab] = useState<"orders" | "reservations">(() => (params.get("tab") === "reservations" ? "reservations" : "orders"));
```

(Move `const params = useSearchParams();` above it.) Wrap the Panel's body:

```tsx
      <Panel bodyClass="">
        <div className="px-4 pt-2 sm:px-6">
          <Tabs
            tabs={[
              { id: "orders", label: "Orders" },
              { id: "reservations", label: "Reservations", count: reservations.filter((r) => r.status === "OPEN").length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        {tab === "reservations" ? (
          <ReservationsTab initialId={params.get("tab") === "reservations" ? (params.get("id") ?? undefined) : undefined} />
        ) : (
          <>
            {/* existing search + filters, table and Pager unchanged */}
          </>
        )}
      </Panel>
```

and only read `params.get("id")` for the order drawer when `tab === "orders"`.

- [ ] **Step 4: Check in the browser**

As staff: Orders → Reservations lists the three demo reservations; Not picked up shows one. Open the partly held one: Make it an order is disabled; Hold what's in stock now says "Nothing more in stock yet". Record a batch of that product on Production, move it out of the blast freezer on Inventory (Batches tab), come back: Hold now holds more. Move a reservation to another day. Cancel the one with a deposit: "Deposit to refund" shows; as admin, Mark refunded. Make the fully held one an order with Picks up and Cash: the invoice shows the order; Available on POS went down only once (no double count). Do Task 6 Step 3 now.

- [ ] **Step 5: Lint, build, test, commit** (ask first)

```bash
git add components/Reservations.tsx app/orders/page.tsx
git commit -m "feat(reservations): list, hold, move, cancel and order reservations from Orders"
```

---

### Task 8: Reserve at the POS

**Files:**
- Modify: `app/counter/page.tsx`

**Interfaces:**
- Consumes: `reserve` action, `DEPOSIT_LABEL`, `neededByError` (Tasks 4–5).

- [ ] **Step 1: Add the mode and its state**

Change `type Mode = "WALK_IN" | "DELIVERY";` to `type Mode = "WALK_IN" | "DELIVERY" | "RESERVE";`. Add `CalendarClock` to the lucide import, `DEPOSIT_LABEL` to the logic import, `DepositMethod` to the types import. State, after `notes`:

```tsx
  const reserve = useStore((s) => s.reserve);
  const [neededBy, setNeededBy] = useState(days[0]);
  const [depositAmt, setDepositAmt] = useState("");
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("CASH");
  const [depositRef, setDepositRef] = useState("");
  const reserving = mode === "RESERVE";
```

`fulfillment` stays `"PICKUP"` only for `WALK_IN`: `const fulfillment = mode === "WALK_IN" ? "PICKUP" : "DELIVERY";` (reservations are priced as a guide, at delivery fees).

- [ ] **Step 2: Rules that change while reserving**

- `shortLines`: `const shortLines = reserving ? [] : cart.filter(...)` (short is allowed: it goes to To make).
- `canPlace`: `const canPlace = reserving ? !!picked && cart.length > 0 : <existing expression>;`
- Product card button: `disabled={out && !reserving}` and label `{out ? (reserving ? "Reserve, to make" : "Out of stock") : qty ? "Add one more" : reserving ? "Add to reservation" : "Add to order"}`.
- Cart line: when reserving and `l.qty > avail`, show `<div className="mt-1.5 text-small font-semibold text-warn">{units(Math.max(0, avail), p.unit)} held now, {l.qty - Math.max(0, avail)} to make</div>` instead of the red "Only … left".

- [ ] **Step 3: Order type pills**

Add a third entry to the pills array: `["RESERVE", "Reserve", CalendarClock],`. With three pills, keep `flex-1` so they share the width; check at 375 px that labels don't wrap (shorten to "Reserve" — already short).

- [ ] **Step 4: The reserve fields**

Where the panel shows the account picker, render the Delivery branch's `AccountPicker` for `RESERVE` too (`mode === "WALK_IN" ? … : <AccountPicker …/>` already covers it). In the bottom section, alongside the `mode === "DELIVERY"` block, add:

```tsx
            {reserving && (
              <div className="space-y-2">
                <Field label="Needed by">
                  <select className="input" value={neededBy} onChange={(e) => setNeededBy(e.target.value)}>
                    {days.map((d) => <option key={d} value={d}>{dayShort(keyToTs(d))}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Deposit" hint="Optional">
                    <input className="input" inputMode="decimal" placeholder="₱0" value={depositAmt} onChange={(e) => setDepositAmt(e.target.value.replace(/[^\d.]/g, ""))} />
                  </Field>
                  <Field label="Paid by">
                    <select className="input" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value as DepositMethod)} disabled={!depositAmt}>
                      {(Object.keys(DEPOSIT_LABEL) as DepositMethod[]).map((m) => <option key={m} value={m}>{DEPOSIT_LABEL[m]}</option>)}
                    </select>
                  </Field>
                </div>
                {depositAmt && depositMethod !== "CASH" && (
                  <Field label="Reference number">
                    <input className="input" value={depositRef} onChange={(e) => setDepositRef(e.target.value)} placeholder="Optional" />
                  </Field>
                )}
                <Field label="Note">
                  <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                </Field>
                <p className="hint">Stock on hand is held for them. Anything not in stock goes on Production&rsquo;s To make list. Price is set when it becomes an order.</p>
              </div>
            )}
```

Hide the Payment radiogroup and the credit warning when `reserving` (wrap both in `{!reserving && (…)}`), and change the Total label to `{reserving ? "Estimated total" : "Total"}`.

- [ ] **Step 5: Submit**

At the top of `submit()`:

```tsx
    if (reserving) {
      if (!picked) return;
      const amount = parseFloat(depositAmt) || 0;
      const res = reserve({
        clientId: picked.id,
        lines: cart,
        neededBy,
        notes,
        deposit: amount > 0 ? { amount, method: depositMethod, ref: depositRef } : undefined,
        by: admin ? "Owner" : "Counter 1",
      });
      if (!res.ok) return toast(res.error, "warn");
      toast(`${res.reservation.number} reserved for ${picked.name}, needed by ${dayShort(keyToTs(neededBy)).split(",")[0]}. See Orders, Reservations.`);
      setDepositAmt("");
      setDepositRef("");
      reset();
      return;
    }
```

Checkout button label: `{reserving ? `Reserve for ${dayShort(keyToTs(neededBy)).split(",")[0]}` : mode === "WALK_IN" ? … : …}`. The hint under it for reserving without an account: `{reserving && !picked && cart.length > 0 && <p className="mt-2 hint">Choose the customer account to reserve for.</p>}`.

- [ ] **Step 6: Check in the browser** at 1440 and 375 px, as staff: Reserve with an in-stock product (Available drops on the card right away), with an out-of-stock product (card button reads "Reserve, to make"; Production's To make shows it with the RS number after Task 9), with a ₱500 GCash deposit and reference. Try without an account: button disabled with the hint. Walk-in and Delivery still work as before.

- [ ] **Step 7: Lint, build, commit** (ask first)

```bash
git add app/counter/page.tsx
git commit -m "feat(reservations): reserve products for a client at the POS"
```

---

### Task 9: Home, Production and Customers show reservations

**Files:**
- Modify: `components/Dashboard.tsx`, `components/StaffToday.tsx`, `app/production/page.tsx`, `app/clients/page.tsx`

**Interfaces:**
- Consumes: `overdueReservations`, `toMake(rows, reservations, lots)` with `forReservations`.

- [ ] **Step 1: Owner's Home**

In `components/Dashboard.tsx` `OwnerToday`: read `const reservations = useStore((s) => s.reservations);`, compute

```tsx
  const notPickedUp = overdueReservations(reservations, today);
  const depositRefunds = reservations.filter((r) => r.refund && !r.refund.at);
```

Add a new `AttentionList` in the Needs attention grid, after Delivery problems:

```tsx
                <AttentionList
                  icon={<CalendarClock size={20} />}
                  tone="warn"
                  title="Not picked up"
                  empty="Every reservation is still on time."
                  items={notPickedUp.map((r) => ({
                    key: r.id,
                    href: `/orders?tab=reservations&id=${r.id}`,
                    main: maps.client.get(r.clientId)?.name ?? "",
                    side: `${r.number}, needed by ${dayShort(keyToTs(r.neededBy))}. Move it to another day or cancel it.`,
                  }))}
                />
```

In "On hold and money to settle", add before `...held`:

```tsx
                    ...depositRefunds.map((r) => ({
                      key: r.id,
                      href: `/orders?tab=reservations&id=${r.id}`,
                      main: maps.client.get(r.clientId)?.name ?? "",
                      side: `Deposit to refund ${money(r.refund!.amount)} for cancelled reservation ${r.number}`,
                    })),
```

The grid is two columns; five lists leave one alone on the last row, which is fine.

- [ ] **Step 2: Staff Home**

In `components/StaffToday.tsx`: read `reservations`; `const make = useMemo(() => toMake(rows.values(), reservations, lots), [rows, reservations, lots]);`; the To make `side` becomes:

```tsx
            side: `${units(row.available, row.product.unit)} left, make ${units(qty, row.product.unit)}${forReservations.length ? ` (includes ${forReservations.join(", ")})` : ""}`,
```

(destructure `({ row, qty, forReservations })`). Add the same "Not picked up" list as Step 1 (staff may see it; it has no money in it). Deposit refunds stay owner-only.

- [ ] **Step 3: Production**

In `app/production/page.tsx`: read `reservations` and `lots` from the store, `toMake(rows.values(), reservations, lots)`. In the suggestions row, under the product name cell, add:

```tsx
{forReservations.length > 0 && <div className="hint">Includes reserved: {forReservations.join(", ")}</div>}
```

and change the empty state title to "Nothing to make right now" with body "Every product has enough stock and every reservation is held."

- [ ] **Step 4: Customers drawer**

In `app/clients/page.tsx` `ClientDrawer`, before the "Deliveries" heading:

```tsx
      {open.length > 0 && (
        <>
          <h3 className="display mt-7 mb-3 text-title font-semibold">Reservations</h3>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {open.map((r) => (
              <li key={r.id}>
                <Link href={`/orders?tab=reservations&id=${r.id}`} className="flex items-center gap-3 px-3 py-2.5 text-small hover:bg-sunk">
                  <span className="code w-20 font-medium">{r.number}</span>
                  <span className="flex-1 text-ink-2">Needed by {dayShort(keyToTs(r.neededBy))}, {r.lines.length} products</span>
                  {r.deposit && <span className="font-semibold">{money(r.deposit.amount)} deposit</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
```

with `const open = useStore((s) => s.reservations).filter((r) => r.clientId === c.id && r.status === "OPEN");` near the top (name it `openReservations` if `open` clashes).

- [ ] **Step 5: Check in the browser** as admin and staff at 1440 and 375 px: the overdue demo reservation is on both Homes; the partly held one's product is on To make with "includes RS-2" on Home and Production; the client drawer lists their reservation; links open the reservation drawer.

- [ ] **Step 6: Lint, build, commit** (ask first)

```bash
git add components/Dashboard.tsx components/StaffToday.tsx app/production/page.tsx app/clients/page.tsx
git commit -m "feat(reservations): show late reservations, deposit refunds and reserved demand"
```

---

### Task 10: Reserve from the online store

**Files:**
- Modify: `app/shop/page.tsx:119-139`, `app/shop/checkout/page.tsx`, `app/shop/orders/page.tsx`

**Interfaces:**
- Consumes: `reserve`, `cancelReservation`, `reservationShort`, `DEPOSIT_LABEL`.

- [ ] **Step 1: Out-of-stock products can go in the cart to reserve**

In `app/shop/page.tsx`, the Add button: `disabled={false}` (remove `left === 0`), label `{left === 0 ? "Add to reserve" : "Add to cart"}`; Stepper `max={CART_MAX}`. Under the stock line, when `left === 0`: `<p className="text-caption text-ink-3">Reserve it for a date at checkout; we make it for you.</p>`.

- [ ] **Step 2: Checkout choice**

In `app/shop/checkout/page.tsx` add state:

```tsx
  const reserve = useStore((s) => s.reserve);
  const [kind, setKind] = useState<"ORDER" | "RESERVE">("ORDER");
  const [neededBy, setNeededBy] = useState(days[0]);
  const [depositPay, setDepositPay] = useState<"NONE" | "GCASH" | "CARD">("NONE");
  const [depositAmt, setDepositAmt] = useState("");
```

and `const mustReserve = !!short;` with `useEffect(() => { if (mustReserve) setKind("RESERVE"); }, [mustReserve]);` (or derive: `const reserving = mustReserve || kind === "RESERVE";` — prefer deriving, no effect).

Add a first `Section` titled "Order now or reserve":

```tsx
          <Section title="Order now or reserve">
            <div className="grid gap-2 sm:grid-cols-2">
              {([["ORDER", "Order now", "Delivered on the day you pick."], ["RESERVE", "Reserve for a date", "We set it aside, or make it, for the day you need it."]] as const).map(([k, label, sub]) => (
                <label key={k} className={cx("flex cursor-pointer gap-3 rounded-lg border p-3", (reserving ? "RESERVE" : "ORDER") === k ? "border-ink bg-sunk" : "border-line hover:border-line-2", k === "ORDER" && mustReserve && "cursor-not-allowed opacity-60")}>
                  <input type="radio" name="kind" className="mt-1 accent-ink" checked={(reserving ? "RESERVE" : "ORDER") === k} disabled={k === "ORDER" && mustReserve} onChange={() => setKind(k)} />
                  <span>
                    <span className="block text-small font-semibold">{label}</span>
                    <span className="block text-caption text-ink-3">{sub}</span>
                  </span>
                </label>
              ))}
            </div>
            {mustReserve && <p className="mt-2 text-caption text-warn">Some items aren&rsquo;t in stock yet, so this can only be a reservation. Or go back and lower the quantity.</p>}
          </Section>
```

When `reserving`: the "Delivery day" section's title becomes "Needed by" and sets `neededBy`; the "Payment" section becomes "Deposit (optional)" with three radio options None / GCash / Card and, when not None, an amount input; the simulated-payment notice shows for a deposit by GCash or card. The summary button reads `Reserve for ${weekday}`.

In `submit`, before `placeOrder`, branch:

```tsx
    if (reserving) {
      const amount = depositPay === "NONE" ? 0 : parseFloat(depositAmt) || 0;
      if (depositPay !== "NONE" && amount <= 0) { setBusy(false); return setError("Enter the deposit amount, or choose no deposit."); }
      if (amount > 0) await new Promise((r) => setTimeout(r, 900));
      const res = reserve({
        clientId: saved.client.id,
        lines: quote.items.map((i) => ({ sku: i.product.sku, qty: i.qty })),
        neededBy,
        notes,
        deposit: amount > 0 ? { amount, method: depositPay as "GCASH" | "CARD" } : undefined,
        by: "Online store",
        channel: "ONLINE",
      });
      setBusy(false);
      if (!res.ok) return setError(res.error);
      clearCart();
      toast(`Reservation ${res.reservation.number} made`);
      return router.push("/shop/orders");
    }
```

and skip the `short` check when reserving (`if (short && !reserving) …`).

- [ ] **Step 3: My orders lists reservations**

In `app/shop/orders/page.tsx`: read `reservations` and `lots`, `cancelReservation`, `toast`. `const myRes = reservations.filter((r) => mine.has(r.clientId)).sort((a, b) => b.createdAt - a.createdAt);`. Above the orders list, when `myRes.length`:

```tsx
        <section className="mb-6 space-y-4">
          <h2 className="display text-title font-semibold">Reservations</h2>
          {myRes.map((r) => {
            const short = reservationShort(r, lots);
            return (
              <article key={r.id} className="rounded-xl border border-line bg-panel px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="display text-title leading-tight font-semibold">Reservation {r.number}</div>
                    <div className="text-small text-ink-3">Needed by {dayLong(keyToTs(r.neededBy))}{r.deposit && ` · ${money(r.deposit.amount)} deposit, ${DEPOSIT_LABEL[r.deposit.method]}`}</div>
                  </div>
                  {r.status === "OPEN" ? <Badge tone="warn">Reserved</Badge> : r.status === "ORDERED" ? <Badge tone="good">Ordered</Badge> : <Badge tone="bad">Cancelled</Badge>}
                </div>
                <ul className="mt-2 text-small">
                  {short.map((l) => (
                    <li key={l.sku} className="py-1">
                      <span className="font-semibold">{products.find((p) => p.sku === l.sku)?.name}</span> × {l.qty}
                      {r.status === "OPEN" && <span className="text-ink-3"> ({l.short ? `${l.held} set aside, ${l.short} being made` : "all set aside"})</span>}
                    </li>
                  ))}
                </ul>
                {r.status === "CANCELLED" && r.refund && <p className="mt-2 text-small text-ink-2">{r.refund.at ? `We refunded your ${money(r.refund.amount)} deposit on ${dateTime(r.refund.at)}.` : `We owe you your ${money(r.refund.amount)} deposit back and will call you to arrange it.`}</p>}
                {r.status === "OPEN" && (
                  <button className="btn btn-ghost btn-sm mt-3" onClick={() => { const res = cancelReservation(r.id, "Online store", "Cancelled by the customer"); toast(res.ok ? `${r.number} cancelled` : res.error); }}>
                    Cancel reservation
                  </button>
                )}
              </article>
            );
          })}
        </section>
```

(read `products` from the store; import `Badge`, `DEPOSIT_LABEL`, `reservationShort`.) The empty state shows only when there are no orders **and** no reservations.

- [ ] **Step 4: Check in the browser** as `customer@clairon.com` at 375 and 1440 px: add an out-of-stock product → checkout forces Reserve; pick a date and a GCash deposit; My orders shows the reservation with "being made". Cancel it: deposit owed text shows. As staff, Orders → Reservations shows it tagged Online; make one into an order and confirm it shows on My orders as Ordered and as an order with Balance due on the invoice.

- [ ] **Step 5: Lint, build, commit** (ask first)

```bash
git add app/shop/page.tsx app/shop/checkout/page.tsx app/shop/orders/page.tsx
git commit -m "feat(reservations): customers reserve from the online store and track it in My orders"
```

---

### Task 11: Docs and final check

**Files:**
- Modify: `docs/SPEC.md` (rows 4.7, 6.9, 6.10, 10.4; build order), `docs/superpowers/specs/2026-10-12-client-feedback-design.md` (Status line)

- [ ] **Step 1: Full check**

Run: `npm test`, `npm run lint`, `npm run build` — all pass. Click through the spec's Testing list once more at 1440 × 900 and 375 × 812.

- [ ] **Step 2: Update the spec**

- 4.7, 6.9, 6.10, 10.4: status **Done**; in Notes, name the functions and actions (`listPrice`, `canOpen` in `lib/roles.ts`, `creditError`, `holdFEFO`, `refreshHolds`, `reservationShort`, `reservationDemand`, `depositError`, `codDue`; actions `reserve`, `holdReservation`, `extendReservation`, `cancelReservation`, `orderReservation`, `markReservationRefunded`) and list every gap the role audit found and fixed.
- 10.3: note that `cancelSettlement` now returns `{ balance, refund }` and `amountDue` subtracts a deposit.
- "Keeping the prototype ready for a real API": add that `npm test` runs the rules in `lib/logic.ts` and `lib/roles.ts` with `node --test`.
- Build order: move the 2026-10-12 items to Done.
- Design doc status line: `Status: built on nelson`.

- [ ] **Step 3: Commit** (ask first)

```bash
git add docs/
git commit -m "docs: mark list price, roles audit and reservations done"
```

- [ ] **Step 4: Push** `nelson` once Nelson says so. Nelson opens the PR into `prototype` himself.
