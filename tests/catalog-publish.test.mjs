import assert from "node:assert/strict";
import test from "node:test";

import { resolvedPriceSourceId } from "../lib/catalog.ts";

test("reuses the specification source when official price and specs share a URL", () => {
  assert.equal(
    resolvedPriceSourceId("rome-warden-2526", "https://example.com/warden", "https://example.com/warden"),
    "rome-warden-2526-spec",
  );
});

test("uses a distinct source id when price and specification URLs differ", () => {
  const id = resolvedPriceSourceId("example-board", "https://brand.example/spec", "https://shop.example/item");
  assert.match(id, /^example-board-price-/);
  assert.notEqual(id, "example-board-spec");
});
