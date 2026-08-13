import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogIdentity,
  priceSourcePriority,
  validateCatalogSubmission,
} from "../lib/catalog.ts";

const validSubmission = {
  board: {
    id: "example-board-2526",
    brand: "Example",
    model: "Exact Model",
    year: "25/26",
    level: ["beginner"],
    styles: { "all-mountain": 9, carving: 7, freestyle: 6, powder: 5 },
    flex: 4,
    profile: "Camber",
    shape: "Directional Twin",
    color: "#d8ff55",
    variants: [{ size: 154, waist: 252, weightMin: 58, weightMax: 80 }],
  },
  specificationSource: {
    sourceName: "Example 官方网站",
    sourceUrl: "https://example.com/boards/exact-model",
    verifiedAt: "2026-08-13T00:00:00.000Z",
  },
  price: {
    amount: 3999,
    currency: "CNY",
    sourceType: "brand_official",
    sourceName: "Example 官方网站",
    sourceUrl: "https://example.com/cn/boards/exact-model",
    observedAt: "2026-08-13T00:00:00.000Z",
    priceLabel: "官网展示价",
  },
};

test("accepts a fully sourced adult resort board submission", () => {
  assert.deepEqual(validateCatalogSubmission(validSubmission), []);
});

test("accepts original foreign currency while rejecting unsafe dimensions and non-HTTPS sources", () => {
  const errors = validateCatalogSubmission({
    ...validSubmission,
    board: { ...validSubmission.board, variants: [{ size: 199, waist: 150, weightMin: 90, weightMax: 20 }] },
    specificationSource: { ...validSubmission.specificationSource, sourceUrl: "http://example.com/model" },
    price: { ...validSubmission.price, currency: "USD" },
  });
  assert.ok(errors.some((error) => error.includes("HTTPS")));
  assert.ok(!errors.some((error) => error.includes("人民币")));
  assert.ok(errors.some((error) => error.includes("成人场地板")));
  assert.ok(errors.some((error) => error.includes("板腰")));
  assert.ok(errors.some((error) => error.includes("承重")));
});

test("normalizes exact catalog identity without fuzzy matching", () => {
  assert.equal(catalogIdentity(" Burton ", "Custom Camber", "25/26"), "burton::custom camber::25/26::adult");
  assert.notEqual(catalogIdentity("Burton", "Custom", "25/26"), catalogIdentity("Burton", "Custom Camber", "25/26"));
});

test("price source priority is official flagship, brand site, then authorized retailer", () => {
  assert.ok(priceSourcePriority("official_flagship") < priceSourcePriority("brand_official"));
  assert.ok(priceSourcePriority("brand_official") < priceSourcePriority("authorized_retailer"));
});

test("accepts an unavailable style score without treating it as zero", () => {
  const submission = {
    ...validSubmission,
    board: { ...validSubmission.board, styles: { ...validSubmission.board.styles, carving: null } },
  };
  assert.deepEqual(validateCatalogSubmission(submission), []);
});

test("requires an explicit null when an official style score is unavailable", () => {
  const styles = { ...validSubmission.board.styles };
  delete styles.carving;
  const errors = validateCatalogSubmission({
    ...validSubmission,
    board: { ...validSubmission.board, styles },
  });
  assert.ok(errors.some((error) => error.includes("未知值请使用 null")));
});

test("only accepts product images from a verified official flagship source", () => {
  const errors = validateCatalogSubmission({
    ...validSubmission,
    board: {
      ...validSubmission.board,
      imageInfo: {
        imageUrl: "https://example.com/board.jpg",
        sourceUrl: "https://example.com/item",
        sourceName: "第三方店铺",
        sourceType: "authorized_retailer",
        observedAt: "2026-08-13T00:00:00.000Z",
      },
    },
  });
  assert.ok(errors.some((error) => error.includes("只能来自品牌官方店铺")));
});

test("accepts an official website image for admin review without promoting it to product image", () => {
  const submission = {
    ...validSubmission,
    crawlAttempts: [{
      sourceType: "brand_official",
      platform: "品牌官网",
      sourceName: "Example 官网",
      sourceUrl: "https://example.com/item",
      status: "matched",
      checkedAt: "2026-08-13T00:00:00.000Z",
      previewImageUrl: "https://example.com/item.jpg",
    }],
  };
  assert.deepEqual(validateCatalogSubmission(submission), []);
});
