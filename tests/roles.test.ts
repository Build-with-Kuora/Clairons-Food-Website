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
