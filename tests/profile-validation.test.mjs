import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultProfile,
  estimateMondo,
  recommend,
  validateProfile,
} from "../lib/recommendation.ts";

test("default profile satisfies all objective limits", () => {
  assert.deepEqual(validateProfile(defaultProfile), {});
  assert.ok(recommend(defaultProfile).length > 0);
});

test("rejects implausible body measurements and out-of-range days", () => {
  const errors = validateProfile({
    ...defaultProfile,
    height: 250,
    weight: -5,
    snowExperienceValue: 3651,
    snowExperienceUnit: "days",
  });

  assert.match(errors.height, /130–210/);
  assert.match(errors.weight, /35–140/);
  assert.match(errors.snowExperienceValue, /0–3650/);
});

test("accepts day, month and year experience without false day conversion", () => {
  assert.deepEqual(validateProfile({ ...defaultProfile, snowExperienceValue: 75, snowExperienceUnit: "days" }), {});
  assert.deepEqual(validateProfile({ ...defaultProfile, snowExperienceValue: 18, snowExperienceUnit: "months" }), {});
  assert.deepEqual(validateProfile({ ...defaultProfile, snowExperienceValue: 12, snowExperienceUnit: "years" }), {});
  assert.match(validateProfile({ ...defaultProfile, snowExperienceValue: 51, snowExperienceUnit: "years" }).snowExperienceValue, /0–50/);
});

test("validates each shoe input mode and precision", () => {
  assert.match(validateProfile({ ...defaultProfile, shoeMode: "daily-eu", shoeValue: 49.5 }).shoeValue, /整数/);
  assert.match(validateProfile({ ...defaultProfile, shoeMode: "daily-eu", shoeValue: 51 }).shoeValue, /34–50/);
  assert.match(validateProfile({ ...defaultProfile, shoeMode: "mondo", shoeValue: 26.2 }).shoeValue, /0.5/);
  assert.match(validateProfile({ ...defaultProfile, shoeMode: "foot", shoeValue: 19.9 }).shoeValue, /20–32/);
  assert.deepEqual(validateProfile({ ...defaultProfile, shoeMode: "foot", shoeValue: 26.3 }), {});
});

test("EU conversion covers supported limits without a silent fallback", () => {
  assert.equal(estimateMondo({ shoeMode: "daily-eu", shoeValue: 34 }).mondo, 22);
  assert.equal(estimateMondo({ shoeMode: "daily-eu", shoeValue: 50 }).mondo, 32);
  assert.ok(Number.isNaN(estimateMondo({ shoeMode: "daily-eu", shoeValue: 99 }).mondo));
});

test("caps budget at 100,000 yuan and rejects values not aligned to 100 yuan", () => {
  assert.match(validateProfile({ ...defaultProfile, budget: 100100 }).budget, /1,500–¥100,000/);
  assert.match(validateProfile({ ...defaultProfile, budget: 3550 }).budget, /100 元/);
  assert.equal(recommend({ ...defaultProfile, budget: Number.POSITIVE_INFINITY }).length, 0);
});
