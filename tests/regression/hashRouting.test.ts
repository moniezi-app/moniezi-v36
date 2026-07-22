import * as assert from "node:assert/strict";
import { Page } from "../../types";
import { buildHash, normalizePage, pageToHashPath } from "../../src/navigation/hashRouting";

export function runHashRoutingTests() {
  assert.equal(normalizePage("home"), Page.Dashboard);
  assert.equal(normalizePage("transactions"), Page.AllTransactions);
  assert.equal(normalizePage("mileage"), Page.Mileage);
  assert.equal(normalizePage("unknown-page"), Page.Dashboard, "unknown pages should fall back safely");

  assert.equal(pageToHashPath(Page.Dashboard), "home");
  assert.equal(pageToHashPath(Page.AllTransactions), "transactions");
  assert.equal(pageToHashPath(Page.Mileage), "mileage");

  assert.equal(buildHash("transactions", { modal: "income", id: "abc 123" }), "#/transactions?modal=income&id=abc%20123");
  assert.equal(buildHash("mileage", { tab: "new", empty: "", none: undefined }), "#/mileage?tab=new", "empty params should be omitted");
}
