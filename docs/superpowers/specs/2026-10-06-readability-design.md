# Readability pass for older users

Branch: `nelson` (from `prototype` at `8e030c2`)
Date: 2026-10-06
Status: built on nelson

## Goal

Most of the people using the staff app are older. Make every app screen easy on the eyes and easy to hit
with a finger or mouse, while keeping the red, black and white theme from UI version 2
(`2026-10-05-ui-version2-design.md`). The landing, contact and store pages are out of scope.

Success means:

- No text below the caption size, and no grey text at 10 px.
- Buttons and inputs are 44 px tall at full size; choice chips 40 px.
- Each screen has one title, one search, and one way to pick a period.
- Labels are plain words, not codes, icons alone, or warehouse jargon.
- The Dashboard answers "how are we doing today, and what needs me" without 15 panels.
- `npm run lint` and `npm run build` pass.

## What drove it

An impeccable critique (dual review plus the detector, snapshot in `.impeccable/critique/`) scored the app
21/40. Measured at 1440 px: 82 to 100% of text rendered under 12 px, because `globals.css` drew every laptop
screen at 80% (`zoom: 0.8`), and over 160 places used 12 to 13 px sizes. Buttons were 22 to 36 px tall,
several actions were icon-only, the Dashboard showed about 15 panels with low stock counted three times, and
several screens showed their title twice.

## Decisions

- **One size scale, in rem.** `globals.css` defines `text-caption` (14), `text-small` (15), `text-body` (16),
  `text-lead` (18), `text-title` (22), `text-heading` (28), `text-figure` (36) and `text-hero` (44). Pages use
  these names, never one-off pixel sizes. Change a size there, not in a page.
- **No zoom.** The 80% laptop zoom is removed. Laptops and desktops (1024 px and up) set the app's root size to
  87.5%, which scales text, buttons and spacing evenly and stays crisp. Phones and tablets use full size. A
  Normal / Large text switch was tried and dropped at the client's request.
- **Shared classes.** `.btn` (44 px), `.btn-sm` (40 px), `.btn-lg` (56 px), `.chip` for every pill choice (the
  chosen one is black), `.input` (44 px), `.hint` for a secondary line, `.tbl` with 16 px rows and dark-grey
  headers. Disabled buttons go grey instead of see-through, so their label stays readable. The hint grey is
  darker (`--color-ink-3` #555a62).
- **Fixed rounded panel.** From tablet width up, the page scrolls inside the rounded content panel, so both
  curved corners stay in view; `Shell` resets that scroll on each new page. Phones scroll the whole page.
- **Active menu item** is a red fill with white text (red text on black was 3.6:1).
- **Rearrange stays** on the Dashboard, POS and Sales, unchanged.

## Screens

- **Shell.** The header shows the page name as the one `h1` and a time-of-day greeting on the Dashboard
  ("Good morning"), since the demo logins have no names. The header search is hidden on POS and Inventory,
  which have their own. Log out is a labelled button.
- **Dashboard (admin).** Four figures (Sold today, Deliveries done with vans on the road, Orders to pack,
  Running low), the product grid from the client's sketch, the sales chart, one routes panel, and Needs
  attention in two columns. Removed: the stock-health ring, Recent orders, Best seller, Just produced, the
  second routes panel and the refresh footnote. Figure cards are links as a whole, with "See details".
- **Staff home.** Same card style; plain labels (To pack and load, Vans out, On hold (quality check)).
- **POS.** One large search box; category chips wrap instead of scrolling; product cards show name, pack,
  price and stock with a full-width "Add to order" button; no SKU or price-tier caption. The order panel has
  44 px steppers, labelled Remove and Clear, and "Add products to check out" while the cart is empty.
- **Inventory.** Two summary cards (Products in stock, Running low). The stock table is Product, Available,
  In storage, Price, Status, with Open and Edit buttons instead of a ⋯ menu. Tabs read Stock, Batches and
  best-by dates, Stock history, Products and prices.
- **Sales.** Periods: Today, Last 7 days, Last 30 days, This month, Choose dates. "Download this period"
  replaces the three CSV buttons. Figures: Total sales, Sales before VAT, VAT (12%), units sold. Sales by
  category is a ranked bar list instead of a ring chart.
- **Delivery.** Day chips, tabs By van / All deliveries / Riders, stop table without the window column (the
  delivery hours sit under the customer name), "Send van out" instead of "Dispatch truck".
- **Orders.** Filters All orders, Placed today, Not paid, Cancelled. Order and invoice numbers sit under the
  customer name; no second New order button; no scroll box inside the page.
- **Customers.** Overdue column next to the name and overdue accounts first; route and last delivery moved to
  the drawer; an "Open" cue on every row.
- **Production.** The blast-freezer note moved under "Record a batch"; "What to make" with a "Make this"
  button; the batch list shows the latest 15 with "Show all".
- **Charts.** Axis labels and tooltips at 14 px; chart margins widened to fit them.

## Wording

| Was | Now |
|---|---|
| Below reorder point | Running low |
| Free to sell | Available |
| Exception | Problem |
| VATable sales | Before VAT (the invoice keeps "VATable sales" for BIR) |
| QA hold | On hold (quality check) |
| Tier A / B / C | Price list A / B / C |
| Reorder point / par | Make more when under / Fill back up to |
| Lot | Batch |
| ETA | Expected |

Stored data, CSV headers and the invoice keep their original names.

## Testing

Checked in the browser at 1440 × 900 and 375 × 812 on every app screen: no text below the caption size, no
sideways scrolling, the panel stays fixed while its content scrolls, and a new page opens at its top.
`npm run lint` and `npm run build` pass.
