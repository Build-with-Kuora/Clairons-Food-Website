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
