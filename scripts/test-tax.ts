/**
 * Accuracy suite for the tax engine. Run with: npm test
 *
 * Sections 1-4 exercise the PURE core (calculator, resolver, money) with
 * hand-built rules: no database, no clock, milliseconds to run. Sections 5-7
 * exercise the seeded database: bitemporal rule selection, the audit trail, and
 * the append-only triggers.
 *
 * Node's built-in assert — no test framework overhead for the 2-hour scope.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { calculateTax, NoApplicableRuleError } from "../lib/calculator";
import { resolveApplicableRules } from "../lib/rules";
import { applyRateBps, formatMinor, toMinor } from "../lib/money";
import { getDb, getDbPath } from "../lib/db";
import { buildComplianceReport, formatComplianceReportCsv } from "../lib/compliance";
import {
  countryRoundingMode,
  findCandidateRules,
  listRules,
  listVersionsOfRule,
} from "../lib/rules-repo";
import { countAudit, getAudit, listAudit } from "../lib/audit";
import {
  auditRejectedRequest,
  calculate,
  ReplayedFailureError,
} from "../lib/tax-service";
import type { CalculationInput, TaxRuleVersion } from "../lib/types";
import {
  parseDateRangeParams,
  toCalculationInput,
  ValidationError,
} from "../lib/validation";

assert.equal(existsSync(getDbPath()), true, "SQLite DB must exist (npm run db:seed)");

let checks = 0;
function section(title: string) {
  console.log(`\n— ${title}`);
}
function ok(label: string, fn: () => void) {
  fn();
  checks++;
  console.log(`  ✓ ${label}`);
}

// Builders for the pure sections.
const RULE_DEFAULTS = {
  customerType: "*",
  taxScope: "national" as const,
  treatment: "standard" as const,
  thresholdMinor: 0,
  taxableBase: "net" as const,
  priority: 100,
  compoundOnPrevious: false,
  validFrom: "2020-01-01",
  validTo: null,
  recordedAt: "2024-01-01T00:00:00.000Z",
  supersededAt: null,
  rulesetVersion: 1,
  legalReference: null,
  notes: null,
};

const r = (over: Partial<TaxRuleVersion>): TaxRuleVersion =>
  ({ ...RULE_DEFAULTS, ...over }) as TaxRuleVersion;

const input = (over: Partial<CalculationInput> = {}): CalculationInput => ({
  amountMinor: 100_00,
  discountMinor: 0,
  currency: "BRL",
  countryCode: "BR",
  productCategory: "electronics",
  customerType: "individual",
  transactionDate: "2026-06-01T00:00:00.000Z",
  priceIncludesTax: false,
  ...over,
});

// =============================================================================
section("1. Money primitives: no float drift");
// =============================================================================
ok("applyRateBps is exact and sign-preserving", () => {
  assert.equal(applyRateBps(100_00, 1900), 19_00);
  assert.equal(applyRateBps(10_01, 1800), 1_80); // 1.8018 -> 1.80
  assert.equal(applyRateBps(7, 1900), 1); // CLP 7 * 19% = 1.33 -> 1
  assert.equal(applyRateBps(-100_00, 1900), -19_00); // refunds mirror
});

ok("major <-> minor round-trips, including zero-decimal CLP", () => {
  assert.equal(toMinor("199.99", "BRL"), 19999);
  assert.equal(toMinor(199.99, "BRL"), 19999);
  assert.equal(toMinor("89990", "CLP"), 89990);
  assert.equal(formatMinor(19999, "BRL"), "199.99");
  assert.equal(formatMinor(89990, "CLP"), "89990");
  assert.equal(formatMinor(-19999, "BRL"), "-199.99");
});

// =============================================================================
section("2. Calculation accuracy across the five countries");
// =============================================================================
const accuracyCases: Array<[string, TaxRuleVersion[], CalculationInput, number, number]> = [
  [
    "Colombia IVA 19% on 100.00",
    [r({ id: "CO:*:IVA@v1", ruleKey: "CO:*:IVA", version: 1, countryCode: "CO", productCategory: "*", taxType: "IVA", rateBps: 1900 })],
    input({ countryCode: "CO", currency: "COP" }),
    19_00,
    119_00,
  ],
  [
    "Argentina reduced 10.5% on food",
    [r({ id: "AR:FOOD:IVA@v1", ruleKey: "AR:FOOD:IVA", version: 1, countryCode: "AR", productCategory: "food", taxType: "IVA", rateBps: 1050 })],
    input({ countryCode: "AR", currency: "ARS", productCategory: "food" }),
    10_50,
    110_50,
  ],
  [
    "Brazil books exempt",
    [r({ id: "BR:BOOKS:ICMS@v1", ruleKey: "BR:BOOKS:ICMS", version: 1, countryCode: "BR", productCategory: "books", taxType: "ICMS", rateBps: 0, treatment: "exempt" })],
    input({ productCategory: "books" }),
    0,
    100_00,
  ],
  [
    "Brazil multi-tax: federal PIS/COFINS 9.25% + municipal ISS 5% = 14.25%",
    [
      r({ id: "BR:DS:PIS_COFINS_IMPORT@v1", ruleKey: "BR:DS:PIS_COFINS_IMPORT", version: 1, countryCode: "BR", productCategory: "digital_services", taxType: "PIS_COFINS_IMPORT", taxScope: "federal", rateBps: 925, priority: 5 }),
      r({ id: "BR:DS:ISS@v1", ruleKey: "BR:DS:ISS", version: 1, countryCode: "BR", productCategory: "digital_services", taxType: "ISS", taxScope: "municipal", rateBps: 500, priority: 20 }),
    ],
    input({ productCategory: "digital_services" }),
    14_25,
    114_25,
  ],
  [
    "Chile 19% on a zero-decimal currency",
    [r({ id: "CL:*:IVA@v1", ruleKey: "CL:*:IVA", version: 1, countryCode: "CL", productCategory: "*", taxType: "IVA", rateBps: 1900 })],
    input({ countryCode: "CL", currency: "CLP", amountMinor: 89_990 }),
    17_098,
    107_088,
  ],
  [
    "Peru IGV 18%",
    [r({ id: "PE:*:IGV@v1", ruleKey: "PE:*:IGV", version: 1, countryCode: "PE", productCategory: "*", taxType: "IGV", rateBps: 1800 })],
    input({ countryCode: "PE", currency: "PEN" }),
    18_00,
    118_00,
  ],
];

for (const [name, rules, inp, expectedTax, expectedTotal] of accuracyCases) {
  ok(name, () => {
    const res = calculateTax(inp, rules, { rulesetVersion: 1 });
    assert.equal(res.taxAmountMinor, expectedTax);
    assert.equal(res.totalAmountMinor, expectedTotal);
  });
}

// =============================================================================
section("3. Edge cases");
// =============================================================================
const standard = [
  r({ id: "BR:*:ICMS@v1", ruleKey: "BR:*:ICMS", version: 1, countryCode: "BR", productCategory: "*", taxType: "ICMS", rateBps: 1700 }),
];

ok("zero amount is not a taxable event", () => {
  const res = calculateTax(input({ amountMinor: 0 }), standard, { rulesetVersion: 1 });
  assert.equal(res.status, "zero_amount");
  assert.equal(res.taxAmountMinor, 0);
  assert.deepEqual(res.taxLines.map((line) => line.ruleVersionId), ["BR:*:ICMS@v1"]);
  assert.deepEqual(res.breakdown.appliedRuleVersionIds, ["BR:*:ICMS@v1"]);
  assert.throws(
    () => calculateTax(input({ amountMinor: 0 }), [], { rulesetVersion: 1 }),
    NoApplicableRuleError,
    "an uncovered zero-value sale must not hide a catalogue gap",
  );
});

ok("negative amount is a refund with mirrored tax", () => {
  const res = calculateTax(input({ amountMinor: -100_00 }), standard, { rulesetVersion: 1 });
  assert.equal(res.status, "refund");
  assert.equal(res.taxAmountMinor, -17_00);
  assert.equal(res.totalAmountMinor, -117_00);
});

ok("discount reduces the net base and cannot turn a sale into a refund", () => {
  const res = calculateTax(input({ amountMinor: 250_00, discountMinor: 50_00 }), standard, { rulesetVersion: 1 });
  assert.equal(res.baseAmountMinor, 200_00);
  assert.equal(res.taxAmountMinor, 34_00);

  assert.throws(
    () =>
      toCalculationInput({
        country_code: "BR",
        product_category: "electronics",
        amount_minor: 100_00,
        discount_minor: 100_01,
      }),
    ValidationError,
  );

  const maxExact = Math.floor(Number.MAX_SAFE_INTEGER / 10_000);
  assert.equal(
    toCalculationInput({
      country_code: "BR",
      product_category: "electronics",
      amount_minor: maxExact,
    }).amountMinor,
    maxExact,
  );
  assert.throws(
    () =>
      toCalculationInput({
        country_code: "BR",
        product_category: "electronics",
        amount_minor: maxExact + 1,
      }),
    ValidationError,
  );
});

ok("gross-based rules ignore the discount", () => {
  const grossRule = [r({ ...standard[0], id: "BR:*:ICMS@vG", taxableBase: "gross" })];
  const res = calculateTax(input({ amountMinor: 250_00, discountMinor: 50_00 }), grossRule, { rulesetVersion: 1 });
  assert.equal(res.taxAmountMinor, applyRateBps(250_00, 1700));
});

ok("threshold boundaries: below is exempt, at and above are taxed", () => {
  const thresholded = [
    r({ id: "CO:CLOTHING:IVA@v1", ruleKey: "CO:CLOTHING:IVA", version: 1, countryCode: "CO", productCategory: "clothing", taxType: "IVA", rateBps: 1900, thresholdMinor: 10_000_00 }),
  ];
  const at = (amt: number) =>
    calculateTax(
      input({ countryCode: "CO", currency: "COP", productCategory: "clothing", amountMinor: amt }),
      thresholded,
      { rulesetVersion: 1 },
    );
  assert.equal(at(9_999_99).taxAmountMinor, 0);
  assert.equal(at(10_000_00).taxAmountMinor, 1_900_00);
  assert.ok(at(10_000_01).taxAmountMinor > 0);
});

ok("refuses to invent a rate when no rule is on file", () => {
  assert.throws(
    () => calculateTax(input(), [], { rulesetVersion: 1 }),
    (err: unknown) => err instanceof NoApplicableRuleError && err.code === "NO_APPLICABLE_RULE",
  );
});

ok("decomposes a tax-inclusive price back to its base", () => {
  const res = calculateTax(input({ amountMinor: 117_00, priceIncludesTax: true }), standard, { rulesetVersion: 1 });
  assert.equal(res.baseAmountMinor, 100_00);
  assert.equal(res.taxAmountMinor, 17_00);
  assert.equal(res.totalAmountMinor, 117_00);
});

ok("identical inputs give byte-identical outputs", () => {
  const a = calculateTax(input({ amountMinor: 123_45 }), standard, { rulesetVersion: 1 });
  const b = calculateTax(input({ amountMinor: 123_45 }), standard, { rulesetVersion: 1 });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// =============================================================================
section("4. Rule resolution: two independent time axes");
// =============================================================================
{
  const v1 = r({ id: "BR:E:ICMS@v1", ruleKey: "BR:E:ICMS", version: 1, countryCode: "BR", productCategory: "electronics", taxType: "ICMS", rateBps: 1700, validFrom: "2020-01-01", validTo: "2026-01-01" });
  const v2 = r({ id: "BR:E:ICMS@v2", ruleKey: "BR:E:ICMS", version: 2, countryCode: "BR", productCategory: "electronics", taxType: "ICMS", rateBps: 1800, validFrom: "2026-01-01", validTo: null });
  const q = (transactionDate: string, asOf = "2026-06-01T00:00:00.000Z") => ({
    countryCode: "BR",
    productCategory: "electronics",
    customerType: "individual",
    transactionDate,
    asOf,
  });

  ok("VALID TIME: picks the rule that was law on the transaction date", () => {
    assert.equal(resolveApplicableRules([v1, v2], q("2025-12-31"))[0].id, "BR:E:ICMS@v1");
    assert.equal(resolveApplicableRules([v1, v2], q("2026-01-02"))[0].id, "BR:E:ICMS@v2");

    const normalized = toCalculationInput({
      country_code: "BR",
      product_category: "electronics",
      amount_minor: 100_00,
      transaction_date: "2025-12-31T23:00:00-03:00",
    }).transactionDate;
    assert.equal(normalized, "2026-01-01T02:00:00.000Z");
    assert.equal(resolveApplicableRules([v1, v2], q(normalized))[0].id, "BR:E:ICMS@v2");
  });

  ok("SYSTEM TIME: a rule recorded later is invisible to an earlier as-of instant", () => {
    const late = r({ ...v2, id: "BR:E:ICMS@v3", version: 3, rateBps: 2000, recordedAt: "2026-05-01T00:00:00.000Z" });
    const superseded = r({ ...v2, supersededAt: "2026-05-01T00:00:00.000Z" });
    assert.equal(
      resolveApplicableRules([superseded, late], q("2026-03-01", "2026-04-01T00:00:00.000Z"))[0].rateBps,
      1800,
    );
    assert.equal(
      resolveApplicableRules([superseded, late], q("2026-03-01", "2026-06-01T00:00:00.000Z"))[0].rateBps,
      2000,
    );
  });

  ok("specificity: an exact category beats the country wildcard", () => {
    const wildcard = r({ id: "BR:*:ICMS@v1", ruleKey: "BR:*:ICMS", version: 1, countryCode: "BR", productCategory: "*", taxType: "ICMS", rateBps: 1700 });
    const exact = r({ id: "BR:FOOD:ICMS@v1", ruleKey: "BR:FOOD:ICMS", version: 1, countryCode: "BR", productCategory: "food", taxType: "ICMS", rateBps: 700 });
    const picked = resolveApplicableRules([wildcard, exact], { ...q("2026-03-01"), productCategory: "food" });
    assert.equal(picked.length, 1);
    assert.equal(picked[0].rateBps, 700);
  });

  ok("specificity: an exact customer type beats the wildcard (B2B reverse charge)", () => {
    const b2c = r({ id: "AR:DS:IVA@v1", ruleKey: "AR:DS:IVA", version: 1, countryCode: "AR", productCategory: "digital_services", taxType: "IVA", rateBps: 2100 });
    const b2b = r({ id: "AR:DS:IVA:B2B@v1", ruleKey: "AR:DS:IVA:B2B", version: 1, countryCode: "AR", productCategory: "digital_services", customerType: "business", taxType: "IVA", rateBps: 0, treatment: "reverse_charge" });
    const picked = resolveApplicableRules([b2c, b2b], {
      countryCode: "AR",
      productCategory: "digital_services",
      customerType: "business",
      transactionDate: "2026-03-01",
      asOf: "2026-06-01T00:00:00.000Z",
    });
    assert.equal(picked[0].treatment, "reverse_charge");
  });
}

// =============================================================================
section("5. Seeded catalogue: BR / CO / AR / CL / PE");
// =============================================================================
ok("30 rule versions across the five countries", () => {
  const all = listRules({ includeSuperseded: true });
  assert.equal(all.length, 30);
  for (const country of ["BR", "CO", "AR", "CL", "PE"]) {
    assert.ok(
      listRules({ countryCode: country }).length > 0,
      `expected seeded rules for ${country}`,
    );
  }
});

ok("every seeded rule carries a legal reference or an explanatory note", () => {
  const undocumented = listRules({ includeSuperseded: true }).filter(
    (rule) => !rule.legalReference && !rule.notes,
  );
  assert.deepEqual(undocumented, []);
});

ok("BR:ELECTRONICS:ICMS resolves @v1 on 2025-12-31 and @v2 on 2026-01-02", () => {
  const asOf = new Date().toISOString();
  const pick = (date: string) =>
    resolveApplicableRules(findCandidateRules("BR", date, asOf), {
      countryCode: "BR",
      productCategory: "electronics",
      customerType: "individual",
      transactionDate: date,
      asOf,
    })[0];

  const before = pick("2025-12-31");
  const after = pick("2026-01-02");
  assert.equal(before.id, "BR:ELECTRONICS:ICMS@v1");
  assert.equal(before.rateBps, 1700);
  assert.equal(after.id, "BR:ELECTRONICS:ICMS@v2");
  assert.equal(after.rateBps, 1800);
  assert.equal(listVersionsOfRule("BR:ELECTRONICS:ICMS").length, 2);
});

// F-020: rounding policy is per country and actually read, not dead config.
ok("countries.rounding_mode is read and changes a half-unit result", () => {
  assert.equal(countryRoundingMode("BR"), "HALF_UP");
  assert.equal(countryRoundingMode("ZZ"), "HALF_UP", "unknown country falls back safely");

  // 1% of 0.50 is exactly 0.005 — the only case where the mode is visible.
  assert.equal(applyRateBps(50, 100, "HALF_UP"), 1);
  assert.equal(applyRateBps(50, 100, "HALF_EVEN"), 0);

  const halfCent = [
    r({ id: "BR:*:X@v1", ruleKey: "BR:*:X", version: 1, countryCode: "BR", productCategory: "*", taxType: "X", rateBps: 100 }),
  ];
  const inp = input({ amountMinor: 50 });
  assert.equal(
    calculateTax(inp, halfCent, { rulesetVersion: 1, roundingMode: "HALF_UP" }).taxAmountMinor,
    1,
  );
  assert.equal(
    calculateTax(inp, halfCent, { rulesetVersion: 1, roundingMode: "HALF_EVEN" }).taxAmountMinor,
    0,
  );
});

ok("BR digital services stacks federal PIS/COFINS + municipal ISS, never ICMS", () => {
  const asOf = new Date().toISOString();
  const date = "2026-06-01T12:00:00.000Z";
  const picked = resolveApplicableRules(findCandidateRules("BR", date, asOf), {
    countryCode: "BR",
    productCategory: "digital_services",
    customerType: "individual",
    transactionDate: date,
    asOf,
  });

  const taxTypes = picked.map((p) => p.taxType).sort();
  assert.deepEqual(taxTypes, ["ICMS", "ISS", "PIS_COFINS_IMPORT"]);
  // STF ADI 1945 / ADI 5659 (2021): ICMS and ISS are mutually exclusive on
  // software, so ICMS resolves but is explicitly exempt. Without this rule the
  // BR:*:ICMS wildcard would fall through and wrongly charge 17%.
  const icms = picked.find((p) => p.taxType === "ICMS")!;
  assert.equal(icms.treatment, "exempt");
  assert.equal(icms.rateBps, 0);
  assert.equal(picked.find((p) => p.taxType === "PIS_COFINS_IMPORT")?.taxScope, "federal");

  const res = calculateTax(
    input({ productCategory: "digital_services", amountMinor: 100_00 }),
    picked,
    { rulesetVersion: 1 },
  );
  assert.equal(res.taxAmountMinor, 14_25);
  assert.equal(res.effectiveRateBps, 1425);
});

// F-023: Impuesto PAIS was not extended past December 2024, so the AR stack is
// itself a date-based selection demo rather than a permanent 29%.
ok("AR B2C digital stacks PAIS only while it was in force (lapsed 2024-12-23)", () => {
  const asOf = new Date().toISOString();
  const pick = (date: string) =>
    resolveApplicableRules(findCandidateRules("AR", date, asOf), {
      countryCode: "AR",
      productCategory: "digital_services",
      customerType: "individual",
      transactionDate: date,
      asOf,
    });

  const during = pick("2024-06-15T12:00:00.000Z");
  const after = pick("2026-01-13T12:00:00.000Z");

  assert.deepEqual(during.map((p) => p.taxType).sort(), ["IVA", "PAIS"]);
  assert.deepEqual(after.map((p) => p.taxType).sort(), ["IVA"]);

  const amount = input({ countryCode: "AR", currency: "ARS", productCategory: "digital_services" });
  assert.equal(calculateTax(amount, during, { rulesetVersion: 1 }).effectiveRateBps, 2900);
  assert.equal(calculateTax(amount, after, { rulesetVersion: 1 }).effectiveRateBps, 2100);
});

ok("PE digital services falls back to the country wildcard before 2024-12-01", () => {
  const asOf = new Date().toISOString();
  const pick = (date: string) =>
    resolveApplicableRules(findCandidateRules("PE", date, asOf), {
      countryCode: "PE",
      productCategory: "digital_services",
      customerType: "individual",
      transactionDate: date,
      asOf,
    })[0];

  assert.equal(pick("2024-06-15").ruleKey, "PE:*:IGV");
  assert.equal(pick("2025-06-15").ruleKey, "PE:DIGITAL_SERVICES:IGV");
});

// =============================================================================
section("6. Audit trail");
// =============================================================================
const auditedId = `txn_test_${Date.now()}`;

ok("a successful calculation writes one self-contained audit row", () => {
  const outcome = calculate({
    transactionId: auditedId,
    input: {
      amountMinor: 199_99,
      discountMinor: 0,
      currency: "BRL",
      countryCode: "BR",
      productCategory: "digital_services",
      customerType: "individual",
      transactionDate: "2026-02-13T12:00:00.000Z",
      priceIncludesTax: false,
    },
    rawRequest: { note: "test-tax.ts: BR stacked PIS/COFINS + ISS" },
  });

  // 9.25% + 5% of 199.99 = 18.50 + 10.00, plus a 0% ICMS line recording the
  // STF exclusion. Three lines, two of them collecting.
  assert.equal(outcome.result.taxAmountMinor, 28_50);
  assert.equal(outcome.result.taxLines.length, 3);
  assert.equal(outcome.result.taxLines.filter((l) => l.taxAmountMinor > 0).length, 2);

  const record = getAudit(auditedId)!;
  assert.ok(record, "audit record must exist");
  assert.equal(record.status, "calculated");
  assert.equal(record.taxAmountMinor, 28_50);
  assert.equal(record.appliedRuleVersionIds.length, 3);
  assert.equal(record.appliedRulesSnapshot.length, 3);
  // The snapshot is a full copy, not just ids: it must carry the rates.
  assert.ok(record.appliedRulesSnapshot.every((rule) => typeof rule.rateBps === "number"));
  assert.match(record.calculationFingerprint, /^[0-9a-f]{64}$/);
});

ok("a failed calculation is audited too, and still raises the error", () => {
  const failedId = `${auditedId}_fail`;
  assert.throws(() =>
    calculate({
      transactionId: failedId,
      input: {
        amountMinor: 10_00,
        discountMinor: 0,
        currency: "BRL",
        countryCode: "BR",
        productCategory: "no_such_category_ever",
        customerType: "individual",
        // Before any BR rule was valid, so nothing matches at all.
        transactionDate: "2015-01-01T00:00:00.000Z",
        priceIncludesTax: false,
      },
      rawRequest: {},
    }),
  );

  const record = getAudit(failedId)!;
  assert.equal(record.status, "error");
  assert.equal(record.error?.code, "NO_APPLICABLE_RULE");

  const validationId = `${auditedId}_validation`;
  const validationRecord = auditRejectedRequest({
    transactionId: validationId,
    rawRequest: {
      transaction_id: validationId,
      country_code: "BR",
      amount_minor: 10_00,
    },
    code: "INVALID_REQUEST",
    message: "product_category is required",
  });
  assert.notEqual(validationRecord.transactionId, validationId);
  assert.equal(validationRecord.status, "error");
  assert.equal(validationRecord.error?.code, "INVALID_REQUEST");
  assert.equal(validationRecord.input.raw instanceof Object, true);

  // A validation failure must not reserve the caller's idempotency identity:
  // after fixing the body, the caller can calculate under the requested id.
  const corrected = calculate({
    transactionId: validationId,
    input: {
      amountMinor: 100_00,
      discountMinor: 0,
      currency: "BRL",
      countryCode: "BR",
      productCategory: "electronics",
      customerType: "individual",
      transactionDate: "2026-03-15T12:00:00.000Z",
      priceIncludesTax: false,
    },
    rawRequest: {},
  });
  assert.equal(corrected.replayed, false);
  assert.equal(corrected.transactionId, validationId);

  // Reusing a successful transaction id for an invalid request still appends
  // a distinct rejection row; it must never return the unrelated success row.
  const collision = auditRejectedRequest({
    transactionId: auditedId,
    rawRequest: { transaction_id: auditedId, country_code: "BR" },
    code: "INVALID_REQUEST",
    message: "product_category is required",
  });
  assert.notEqual(collision.transactionId, auditedId);
  assert.equal(collision.status, "error");
  assert.equal(getAudit(auditedId)?.status, "calculated");
});

// F-015 regression: a retry with a caller-supplied transaction_id used to hit
// `UNIQUE constraint failed` and surface as a 500.
ok("retrying a caller-supplied transaction_id replays instead of duplicating", () => {
  const retryId = `${auditedId}_retry`;
  const cmd = {
    transactionId: retryId,
    input: {
      amountMinor: 100_00,
      discountMinor: 0,
      currency: "BRL",
      countryCode: "BR",
      productCategory: "electronics",
      customerType: "individual" as const,
      transactionDate: "2026-03-15T12:00:00.000Z",
      priceIncludesTax: false,
    },
    rawRequest: {},
  };

  const first = calculate(cmd);
  const second = calculate(cmd);

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(first.result.taxAmountMinor, second.result.taxAmountMinor);
  assert.equal(second.transactionId, retryId);

  const rows = getDb()
    .prepare("SELECT COUNT(*) AS n FROM tax_calculation_audit WHERE transaction_id = ?")
    .get(retryId) as { n: number };
  assert.equal(rows.n, 1, "a retry must not append a second audit row");
});

ok("retrying a request that failed returns the original error, not a 500", () => {
  const failRetryId = `${auditedId}_failretry`;
  const cmd = {
    transactionId: failRetryId,
    input: {
      amountMinor: 10_00,
      discountMinor: 0,
      currency: "BRL",
      countryCode: "BR",
      productCategory: "no_such_category_ever",
      customerType: "individual" as const,
      transactionDate: "2015-01-01T00:00:00.000Z",
      priceIncludesTax: false,
    },
    rawRequest: {},
  };

  assert.throws(() => calculate(cmd), { code: "NO_APPLICABLE_RULE" });
  assert.throws(
    () => calculate(cmd),
    (err: unknown) =>
      err instanceof ReplayedFailureError && err.code === "NO_APPLICABLE_RULE",
  );
});

// =============================================================================
section("7. Reporting ranges and pagination");
// =============================================================================
ok("date-only ranges include the whole day and reject invalid bounds", () => {
  assert.deepEqual(parseDateRangeParams("2026-03-15", "2026-03-15"), {
    from: "2026-03-15T00:00:00.000Z",
    to: "2026-03-15T23:59:59.999Z",
  });
  assert.throws(() => parseDateRangeParams("not-a-date", null), ValidationError);
  assert.throws(
    () => parseDateRangeParams("2026-12-31", "2026-01-01"),
    ValidationError,
  );
});

ok("empty reports and filtered audit pages remain self-describing", () => {
  const report = buildComplianceReport(
    "BR",
    "1800-01-01T00:00:00.000Z",
    "1800-12-31T23:59:59.999Z",
  );
  assert.equal(report.currency, "BRL");
  assert.equal(report.totals.transactionsProcessed, 0);
  assert.match(formatComplianceReportCsv(report), /TOTAL,0,0\.00,0\.00,0\.00%/);

  const range = parseDateRangeParams("2026-03-15", "2026-03-15");
  const filter = { countryCode: "BR", ...range };
  const total = countAudit(filter);
  const page = listAudit({ ...filter, limit: 2, offset: 0 });
  assert.ok(total > 0);
  assert.equal(page.length, Math.min(total, 2));
});

// =============================================================================
section("8. Immutability is a database guarantee, not a promise");
// =============================================================================
ok("UPDATE on the audit trail is rejected by SQLite", () => {
  assert.throws(
    () => getDb().exec("UPDATE tax_calculation_audit SET tax_amount_minor = 0"),
    /append-only/,
  );
});

ok("DELETE from the audit trail is rejected by SQLite", () => {
  assert.throws(() => getDb().exec("DELETE FROM tax_calculation_audit"), /append-only/);
});

ok("rewriting any rule-version field in place is rejected by SQLite", () => {
  assert.throws(
    () => getDb().exec("UPDATE tax_rule_versions SET rate_bps = 1 WHERE id = 'BR:*:ICMS@v1'"),
    /append-only/,
  );
  assert.throws(
    () => getDb().exec("UPDATE tax_rule_versions SET treatment = 'exempt' WHERE id = 'BR:*:ICMS@v1'"),
    /append-only/,
  );
});

ok("stamping superseded_at is the one permitted rule mutation", () => {
  const db = getDb();
  db.exec("BEGIN");
  db.prepare("UPDATE tax_rule_versions SET superseded_at = ? WHERE id = ?").run(
    "2030-01-01T00:00:00.000Z",
    "BR:*:ICMS@v1",
  );
  db.exec("ROLLBACK"); // do not disturb the seeded state
});

console.log(`\nAll ${checks} checks passed.\n`);
