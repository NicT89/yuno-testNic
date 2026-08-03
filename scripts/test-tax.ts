/**
 * Lightweight assertion suite for tax calculation business rules.
 * Run with: npm test
 *
 * Uses Node's built-in assert — no test framework overhead for the 2-hour scope.
 */

import assert from "node:assert/strict";
import { calculateTax, roundHalfUp } from "../lib/calculator";
import {
  formatComplianceReportText,
  generateComplianceReport,
} from "../lib/compliance";
import { getDbPath } from "../lib/db";
import { getRuleHistory, resolveTaxRule } from "../lib/rules";
import { existsSync } from "node:fs";

assert.equal(existsSync(getDbPath()), true, "SQLite DB must exist (npm run db:seed)");

function section(title: string) {
  console.log(`\n✓ ${title}`);
}

// --- Rounding ---
section("roundHalfUp uses commercial half-up");
assert.equal(roundHalfUp(1.4), 1);
assert.equal(roundHalfUp(1.5), 2);
assert.equal(roundHalfUp(16000 * 0.16), 2560); // 100 MXN * 16% = 16.00 → 1600 cents? wait
// 100000 cents * 0.16 = 16000 exactly
assert.equal(roundHalfUp(100000 * 0.16), 16000);

// --- Mexico standard exclusive ---
section("MX standard exclusive: 1000.00 MXN → 160.00 IVA");
{
  const result = calculateTax({
    country: "MX",
    category: "standard",
    amount: 100000,
    amountMode: "exclusive",
    currency: "MXN",
    transactionDate: "2025-03-15",
  });
  assert.equal(result.netAmount, 100000);
  assert.equal(result.taxAmount, 16000);
  assert.equal(result.grossAmount, 116000);
  assert.equal(result.rate, 0.16);
  assert.equal(result.appliedRule.id, "mx-iva-standard");
}

// --- Mexico inclusive peel ---
section("MX inclusive: 116.00 MXN → net 100.00 + tax 16.00");
{
  const result = calculateTax({
    country: "MX",
    category: "digital",
    amount: 11600,
    amountMode: "inclusive",
    currency: "MXN",
    transactionDate: "2025-06-01",
  });
  assert.equal(result.grossAmount, 11600);
  assert.equal(result.netAmount, 10000);
  assert.equal(result.taxAmount, 1600);
  assert.equal(result.appliedRule.version, 2); // post-2025 digital rule
}

// --- Rule versioning by date ---
section("Digital rule resolves v1 before 2025 and v2 after");
{
  const v1 = resolveTaxRule({
    country: "MX",
    category: "digital",
    transactionDate: "2023-08-10",
  });
  const v2 = resolveTaxRule({
    country: "MX",
    category: "digital",
    transactionDate: "2025-06-01",
  });
  assert.equal(v1?.version, 1);
  assert.equal(v2?.version, 2);
  assert.equal(getRuleHistory("mx-iva-digital").length, 2);
}

// --- Zero-rated food ---
section("MX food is zero-rated");
{
  const result = calculateTax({
    country: "MX",
    category: "food",
    amount: 25000,
    amountMode: "exclusive",
    transactionDate: "2025-03-16",
  });
  assert.equal(result.taxAmount, 0);
  assert.equal(result.exempt, true);
}

// --- US regional specificity ---
section("US CA regional rate beats any country-wide (none defined)");
{
  const result = calculateTax({
    country: "US",
    region: "CA",
    category: "standard",
    amount: 20000,
    amountMode: "exclusive",
    currency: "USD",
    transactionDate: "2025-02-01",
  });
  assert.equal(result.rate, 0.0725);
  assert.equal(result.taxAmount, 1450); // 200.00 * 7.25% = 14.50
  assert.equal(result.appliedRule.id, "us-sales-ca");
}

// --- Missing rule throws ---
section("Missing rule throws TaxRuleNotFoundError");
{
  let threw = false;
  try {
    calculateTax({
      country: "BR",
      category: "standard",
      amount: 1000,
      transactionDate: "2025-01-01",
    });
  } catch (err) {
    threw = true;
    assert.equal((err as Error).name, "TaxRuleNotFoundError");
  }
  assert.equal(threw, true);
}

// --- Compliance report for Mexico ---
section("Mexico compliance report aggregates sample transactions");
{
  const report = generateComplianceReport({ country: "MX" });
  assert.equal(report.country, "MX");
  assert.ok(report.summary.transactionCount >= 5);
  assert.ok(report.summary.totalTax > 0);
  assert.ok(report.byCategory.length >= 1);
  assert.ok(report.byRuleVersion.length >= 1);

  const text = formatComplianceReportText(report);
  assert.match(text, /COMPLIANCE TAX REPORT — MX/);
  assert.match(text, /Total tax:/);
  console.log("\n--- Sample MX compliance report (text) ---\n");
  console.log(text);
}

console.log("\nAll tests passed.\n");
