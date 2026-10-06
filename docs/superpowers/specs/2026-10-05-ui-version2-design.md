# UI version 2: red, black and white revamp

Branch: `ui-version2` (from `origin/prototype` at `f78eb1d`)
Date: 2026-10-05
Status: built on ui-version2

## Goal

Give Coldline a new look modelled on four reference dashboards, using the
client's red, black and white, without changing what the app does. Every
figure, rule and screen Clairon's already has stays; only its presentation
changes, plus one new capability: anonymous walk-in sales at the POS.

Success means:

- The sidebar shows exactly these tabs, in this order: Dashboard, POS,
  Inventory, Delivery, Sales, Orders, Customers, Production.
- Dashboard, Sales, POS and Inventory follow their reference layouts and
  show Clairon's own data, never the references' sample content.
- Every other screen picks up the new theme through shared styles.
- A walk-in sale can be rung up without choosing a customer account.
- Admin and staff roles see what they see today, nothing more.
- `npm run lint` and `npm run build` pass.

## References

| Screen | Reference | What to take |
| --- | --- | --- |
| Shell and Dashboard | `Downloads/CLAIRON DSAHBOARD.png` ("vault") | Black sidebar, greeting header, row of figure cards with one black card, line chart, side panels, table and lists in rounded white cards |
| Sales | `Downloads/Sales Report.jpg` ("DealDeck") | Layout only: 2x2 figure cards, ring chart top right, bar chart, customer breakdown. Styled like the Dashboard |
| POS | `Downloads/POS.jpg` ("Grill Restaurant") | Layout only: product cards on the left with category chips and search, order panel on the right with order-type pills, totals, payment buttons and Checkout. Styled like the Dashboard |
| Inventory | "Investo" image sent in chat | Breadcrumb, title with Add Product, three summary cards, items table with search, filter, export, status pills, row menu and pagination |

The references' brand names, sample products and copy are not used.

## Decisions

- **Approach**: restyle in place. Change the theme tokens and shared
  components in `app/globals.css` and `components/ui.tsx`, rebuild the four
  screens as new layouts on top of the existing hooks and `lib/logic.ts`
  rules. No new dependencies; charts stay hand-written SVG.
- **Routes stay** (`/counter`, `/clients`, `/dispatch`). Only the labels
  change, so existing links, toasts and `?sku=` hand-offs keep working.
- **Walk-in**: anonymous. No account needed, optional buyer name, paid at
  the counter. Delivery still needs a customer account.
- **Scope**: shell plus four full re-layouts. Delivery, Orders, Customers
  and Production keep their layouts.
- **`feat/elderly-friendly-redesign`** is left alone and not merged.
- **Font** stays Barlow / Barlow Condensed / IBM Plex Mono.

## 1. Theme

Raw brand values stay in block 1 of `globals.css` (`--brand-ink #141518`,
`--brand-red #d71f26`, `--brand-paper #ffffff`). Token changes in block 2:

- `--color-page` a light neutral grey so white cards lift off it.
- New `--color-side` (sidebar, near-black) and `--color-side-ink` /
  `--color-side-ink-2` for text on it.
- Red is the accent for primary buttons, the active tab, the leading chart
  series and key numbers. Black is for the sidebar, the highlight figure
  card and secondary filled buttons.
- `--color-accent` (focus, selection, "in motion") moves from blue to the
  ink/red family so the app reads as red, black and white. Focus rings stay
  clearly visible.
- Status colours stay (good green, warn amber, bad red) but only where they
  carry meaning, always paired with a word or icon: stock status, delta
  pills, delivery status. The cold-zone blues stay on zone tags only.

Shared component changes:

- `Panel`: 16px radius, no heavy border, soft shadow, roomier header.
- `PageHead`: breadcrumb line ("Home / Inventory") above the title.
- `.btn-primary` red, new `.btn-dark` black, pill-shaped chips for
  segmented choices (`Chip` helper).
- New `Stat` card component: icon tile, label, big value, delta pill
  ("+12% vs yesterday"), optional `dark` variant, optional link arrow.
- New `Delta` pill: up green, down red, flat grey, with the sign in the text.

## 2. Shell (`components/Shell.tsx`, `components/BottomNav.tsx`)

Desktop sidebar, black, about 248px:

- Logo on a white rounded tile (the wordmark is black), "Coldline" under it.
- "Menu" label, then the eight tabs with lucide icons:

  | Label | Route | Icon |
  | --- | --- | --- |
  | Dashboard | `/` | `LayoutDashboard` |
  | POS | `/counter` | `ScanBarcode` |
  | Inventory | `/inventory` | `Boxes` |
  | Delivery | `/dispatch` | `Truck` |
  | Sales | `/sales` | `ChartColumn` |
  | Orders | `/orders` | `ReceiptText` |
  | Customers | `/clients` | `Users` |
  | Production | `/production` | `Factory` |

- Active tab: red fill, white text. Others: muted white, lighter on hover.
- Role filtering unchanged (`canOpen`), so staff do not see Sales.
- Footer card: email, role, Log out, Reset demo data (admin only).

Header (white, sticky):

- Dashboard: "Hello, Admin" / "Hello, Staff" with today's date and clock.
- Other screens: page title with breadcrumb.
- Right side: date and clock (non-dashboard), red **New order** button to
  `/counter` (hidden on `/counter` itself).

Phones keep the bottom bar layout, restyled, with labels updated
(Counter → POS, Clients → Customers). The menu sheet lists Sales, POS,
Orders, Customers as before.

`/login`, `/driver` and `/shop` keep their own frames; they inherit the new
tokens only.

## 3. Dashboard (`app/page.tsx`)

Admin (`OwnerToday`), top to bottom:

1. **Figure cards** (five; wrap to 2 or 3 per row on smaller screens):
   - Sold today (black card): peso total, delta vs yesterday.
   - Stops delivered: "12 of 18", exceptions count in red when any.
   - Trucks out: "2 of 4".
   - Orders to pick: scheduled or picking.
   - Below reorder point: count of SKUs, red icon tile, links to
     `/inventory?filter=low`.
2. **Row two**:
   - **Sales** line/area chart (wide): daily sales with a 7 / 14 / 30 day
     segmented toggle, total for the period and delta vs the period before,
     hover tooltip per day.
   - **Deliveries by route**: one row per van route (and riders as one
     row) with delivered/total progress bar and status; **See all** button
     to `/dispatch`.
   - **Stock health**: ring chart of active SKUs split into healthy, below
     reorder point and out of stock, with the healthy % in the middle;
     under it "Short-dated lots" count (best-by within 30 days).
3. **Row three**:
   - **Recent orders** table (wide): customer, invoice/order number,
     amount, delivery status pill, view action to `/orders?id=…`. Latest
     eight.
   - **Best seller this week**: top SKU by cases sold in 7 days, category
     tile, cases sold vs free to sell, **Make more** button to
     `/production?sku=…`.
   - **Just produced**: latest five production batches with SKU, quantity
     and when made.
4. **Products** (existing `ProductGrid` from the client's sketch),
   restyled.
5. **Needs attention**: the four existing attention lists, restyled.

Staff (`StaffToday`) uses the same card style and grid: its four figure
cards, its six attention lists and the routes panel. No money figures.

## 4. Sales (`app/sales/page.tsx`)

Admin only, as now.

1. Header: "Sales report", the selected range as a date line, CSV and Print
   actions unchanged.
2. Range presets and From/To fields unchanged, shown as chips.
3. **Top row**:
   - Left, 2x2 figure cards: Total sales (black), VATable sales, VAT 12%,
     cases sold. Each with a delta vs the previous period of equal length.
   - Right, **Sales by category**: concentric ring chart of the top
     categories by amount, legend with amount and share, total in the
     centre.
4. **Middle row**:
   - **Sales by day**: grouped bars per day, walk-in/will-call vs delivery,
     with tooltip. Ranges over 31 days group by week.
   - **Top customers**: top five accounts by amount with a bar each; walk-in
     sales as one "Walk-in customers" row.
5. **Sales by product** table: unchanged columns, totals, print layout.

New pure helpers in `lib/logic.ts`: `previousRange`, `salesByCategory`,
`salesByDay` (split by fulfillment), `salesByClient`, `pctChange`.

## 5. POS (`app/counter/page.tsx`)

Left column:

- Date line and "Point of sale" title, search (`/` focuses it; `SKU qty`
  plus Enter still adds), category chips.
- Product cards in a responsive grid: category tile with icon in place of a
  photo, name, SKU, price for the current buyer's tier, free-to-sell count
  (amber when low, "Out" when none and Add disabled), red **Add** button,
  quantity badge when already in the cart.

Right column, sticky **Current order** panel:

- Order type pills: **Walk-in** | **Delivery**.
- Walk-in: optional "Customer name" field, and an optional "Charge to an
  account" picker for account holders buying at the counter (their terms and
  payment options apply). Anonymous payment buttons Cash, GCash,
  Card. Pays and deducts stock now (the existing PICKUP path).
- Delivery: customer account picker (as today, with last order and credit
  info), delivery day, PO and notes behind "More details", payment buttons
  per the account's terms as today, credit hold banner with admin override.
- Cart lines with +/- quantity and remove.
- Totals: items, drop fee, fuel surcharge (delivery only), VAT included,
  total.
- Big red **Checkout** button ("Charge ₱X" for walk-in, "Place order for
  Tue" for delivery).
- Invoice and Send receipt modal after checkout, unchanged.

### Walk-in data

- `Client.type` gains `"Walk-in"`. One fixed client, id `walk-in`, name
  "Walk-in customer", tier C, terms COD, no credit, no route.
- It is added by the seed, and on rehydrate if a saved store lacks it, so
  existing browsers keep their data.
- `Order` gains optional `buyerName`.
- `fulfillment` stays `"DELIVERY" | "PICKUP"`; "Walk-in" is the label for
  `PICKUP`. A PICKUP order for a regular account (will-call) still works
  and is labelled "Walk-in" too.
- The walk-in client is hidden from Customers, the online store and the
  POS account picker. Orders and the invoice show `buyerName` when given,
  otherwise "Walk-in customer".

## 6. Inventory (`app/inventory/page.tsx`)

1. Breadcrumb, "Inventory summary" title, **Add product** (admin only, as
   now).
2. Three summary cards: **Categories** (count of categories with active
   products), **Total products** (active SKUs, with cases on hand),
   **Low stock** (below reorder point, red, with out-of-stock count).
3. **Inventory items** card, with tabs Stock, Lots, Movements, Products:
   - Stock tab (new table): search, filter menu (category; status: all, in
     stock, low, out, on hold), **Export** CSV of the filtered rows.
   - Columns: product (category tile and name), category, SKU, on hand,
     reserved, free to sell, unit price, stock value (on hand x unit
     price), status pill, row menu (Open, Adjust, Edit for admin).
   - Row click opens the existing product drawer.
   - 10 rows per page, Previous / Next, "Page 1 of N".
   - No row checkboxes: there is no bulk action to use them.
   - Lots, Movements and Products tabs keep their content, restyled.
4. `?sku=` and `?tab=` deep links keep working; `?filter=low` presets the
   status filter.

## 7. Other screens

Delivery, Orders, Customers, Production, the driver handheld, login and
shop get the new tokens, `PageHead`, `Panel`, buttons and pills. No layout
changes. Customers keeps its route `/clients`; its heading reads
"Customers".

## Error handling and edge cases

- Empty states for every new card (no sales in range, no batches, no
  orders), using the existing `Empty` style.
- Deltas: when the previous period is zero, show "New" instead of a %.
- Charts handle all-zero data without dividing by zero.
- Walk-in checkout with an empty cart or short stock is blocked the same
  way delivery is today.
- Saved stores from before this change rehydrate with the walk-in client
  added; nothing is reset.

## Testing

The project has no test runner. Each step is checked with:

- `npm run lint` and `npm run build`.
- The dev server in a browser at 1440px and 390px wide, as admin and as
  staff.
- End to end: one walk-in sale (cash, with and without a name) and one
  delivery order; check stock, Orders, invoice and Sales update.

## Out of scope

- Product photos (category tiles stand in).
- A global search box and notifications in the header.
- Re-laying out Delivery, Orders, Customers and Production.
- Renaming routes.
