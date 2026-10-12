import assert from "node:assert/strict";
import { test } from "node:test";
import { listPrice, salesCsv, salesSummary, vatSplit } from "../lib/logic";
import { product } from "./fixtures";

test("harness loads lib/logic.ts", () => {
  assert.deepEqual(vatSplit(112), { net: 100, vat: 12 });
});

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
