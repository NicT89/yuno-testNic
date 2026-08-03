/**
 * Table-driven accuracy tests for the pure calculation core.
 * No database, no HTTP: these run in milliseconds and are the primary evidence
 * that tax amounts are correct.
 */
import { describe, expect, it } from 'vitest';
import { calculateTax, NoApplicableRuleError } from '../src/domain/calculator.ts';
import { resolveApplicableRules } from '../src/domain/ruleResolver.ts';
import { applyRateBps, formatMinor, toMinor } from '../src/domain/money.ts';
import type { CalculationInput, TaxRuleVersion } from '../src/domain/types.ts';

const base = {
  customerType: '*',
  taxScope: 'national' as const,
  treatment: 'standard' as const,
  thresholdMinor: 0,
  taxableBase: 'net' as const,
  priority: 100,
  compoundOnPrevious: false,
  validFrom: '2020-01-01',
  validTo: null,
  recordedAt: '2024-01-01T00:00:00.000Z',
  supersededAt: null,
  rulesetVersion: 1,
  legalReference: null,
  notes: null,
};

const r = (over: Partial<TaxRuleVersion> & Pick<TaxRuleVersion, 'id' | 'ruleKey' | 'version' | 'countryCode' | 'productCategory' | 'taxType' | 'rateBps'>): TaxRuleVersion =>
  ({ ...base, ...over }) as TaxRuleVersion;

const input = (over: Partial<CalculationInput>): CalculationInput => ({
  amountMinor: 100_00,
  discountMinor: 0,
  currency: 'BRL',
  countryCode: 'BR',
  productCategory: 'electronics',
  customerType: 'individual',
  transactionDate: '2026-06-01T00:00:00.000Z',
  priceIncludesTax: false,
  ...over,
});

describe('money primitives', () => {
  it('applies basis points without float drift', () => {
    expect(applyRateBps(100_00, 1900)).toBe(19_00);
    expect(applyRateBps(10_01, 1800)).toBe(1_80); // 1.8018 -> 1.80
    expect(applyRateBps(7, 1900)).toBe(1); // CLP 7 * 19% = 1.33 -> 1
    expect(applyRateBps(-100_00, 1900)).toBe(-19_00); // refunds mirror
  });

  it('round-trips major <-> minor units, including zero-decimal currencies', () => {
    expect(toMinor('199.99', 'BRL')).toBe(19999);
    expect(toMinor(199.99, 'BRL')).toBe(19999);
    expect(toMinor('89990', 'CLP')).toBe(89990);
    expect(formatMinor(19999, 'BRL')).toBe('199.99');
    expect(formatMinor(89990, 'CLP')).toBe('89990');
    expect(formatMinor(-19999, 'BRL')).toBe('-199.99');
  });
});

describe('tax calculation accuracy', () => {
  const cases: Array<[string, TaxRuleVersion[], CalculationInput, number, number]> = [
    [
      'Colombia IVA 19% on 100.00',
      [r({ id: 'CO:*:IVA@v1', ruleKey: 'CO:*:IVA', version: 1, countryCode: 'CO', productCategory: '*', taxType: 'IVA', rateBps: 1900 })],
      input({ countryCode: 'CO', currency: 'COP' }),
      19_00,
      119_00,
    ],
    [
      'Argentina reduced 10.5% on food',
      [r({ id: 'AR:FOOD:IVA@v1', ruleKey: 'AR:FOOD:IVA', version: 1, countryCode: 'AR', productCategory: 'food', taxType: 'IVA', rateBps: 1050 })],
      input({ countryCode: 'AR', currency: 'ARS', productCategory: 'food' }),
      10_50,
      110_50,
    ],
    [
      'Brazil books exempt',
      [r({ id: 'BR:BOOKS:ICMS@v1', ruleKey: 'BR:BOOKS:ICMS', version: 1, countryCode: 'BR', productCategory: 'books', taxType: 'ICMS', rateBps: 0, treatment: 'exempt' })],
      input({ productCategory: 'books' }),
      0,
      100_00,
    ],
    [
      'Brazil multi-tax: ICMS 17% + ISS 5% stacked',
      [
        r({ id: 'BR:DS:ICMS@v1', ruleKey: 'BR:DS:ICMS', version: 1, countryCode: 'BR', productCategory: 'digital_services', taxType: 'ICMS', rateBps: 1700, priority: 10 }),
        r({ id: 'BR:DS:ISS@v1', ruleKey: 'BR:DS:ISS', version: 1, countryCode: 'BR', productCategory: 'digital_services', taxType: 'ISS', rateBps: 500, priority: 20 }),
      ],
      input({ productCategory: 'digital_services' }),
      22_00,
      122_00,
    ],
    [
      'Chile 19% on a zero-decimal currency',
      [r({ id: 'CL:*:IVA@v1', ruleKey: 'CL:*:IVA', version: 1, countryCode: 'CL', productCategory: '*', taxType: 'IVA', rateBps: 1900 })],
      input({ countryCode: 'CL', currency: 'CLP', amountMinor: 89_990 }),
      17_098,
      107_088,
    ],
  ];

  it.each(cases)('%s', (_name, rules, inp, expectedTax, expectedTotal) => {
    const res = calculateTax(inp, rules, { rulesetVersion: 1 });
    expect(res.taxAmountMinor).toBe(expectedTax);
    expect(res.totalAmountMinor).toBe(expectedTotal);
  });
});

describe('edge cases', () => {
  const standard = [r({ id: 'BR:*:ICMS@v1', ruleKey: 'BR:*:ICMS', version: 1, countryCode: 'BR', productCategory: '*', taxType: 'ICMS', rateBps: 1700 })];

  it('zero amount produces no taxable event', () => {
    const res = calculateTax(input({ amountMinor: 0 }), standard, { rulesetVersion: 1 });
    expect(res.status).toBe('zero_amount');
    expect(res.taxAmountMinor).toBe(0);
  });

  it('negative amount is a refund with mirrored tax', () => {
    const res = calculateTax(input({ amountMinor: -100_00 }), standard, { rulesetVersion: 1 });
    expect(res.status).toBe('refund');
    expect(res.taxAmountMinor).toBe(-17_00);
    expect(res.totalAmountMinor).toBe(-117_00);
  });

  it('discount reduces the net taxable base', () => {
    const res = calculateTax(input({ amountMinor: 250_00, discountMinor: 50_00 }), standard, { rulesetVersion: 1 });
    expect(res.baseAmountMinor).toBe(200_00);
    expect(res.taxAmountMinor).toBe(34_00);
  });

  it('gross-based rules ignore the discount', () => {
    const grossRule = [r({ ...standard[0], id: 'BR:*:ICMS@vG', taxableBase: 'gross' })];
    const res = calculateTax(input({ amountMinor: 250_00, discountMinor: 50_00 }), grossRule, { rulesetVersion: 1 });
    expect(res.taxAmountMinor).toBe(applyRateBps(250_00, 1700));
  });

  it('threshold boundaries: below is exempt, at and above are taxed', () => {
    const thresholded = [r({ id: 'CO:CLOTHING:IVA@v1', ruleKey: 'CO:CLOTHING:IVA', version: 1, countryCode: 'CO', productCategory: 'clothing', taxType: 'IVA', rateBps: 1900, thresholdMinor: 10_000_00 })];
    const at = (amt: number) => calculateTax(input({ countryCode: 'CO', currency: 'COP', productCategory: 'clothing', amountMinor: amt }), thresholded, { rulesetVersion: 1 });
    expect(at(9_999_99).taxAmountMinor).toBe(0);
    expect(at(10_000_00).taxAmountMinor).toBe(1_900_00);
    expect(at(10_000_01).taxAmountMinor).toBeGreaterThan(0);
  });

  it('refuses to invent a rate when no rule is on file', () => {
    expect(() => calculateTax(input({}), [], { rulesetVersion: 1 })).toThrow(NoApplicableRuleError);
  });

  it('decomposes a tax-inclusive price back to its base', () => {
    const res = calculateTax(input({ amountMinor: 117_00, priceIncludesTax: true }), standard, { rulesetVersion: 1 });
    expect(res.baseAmountMinor).toBe(100_00);
    expect(res.taxAmountMinor).toBe(17_00);
    expect(res.totalAmountMinor).toBe(117_00);
  });

  it('is idempotent: identical inputs give identical outputs', () => {
    const a = calculateTax(input({ amountMinor: 123_45 }), standard, { rulesetVersion: 1 });
    const b = calculateTax(input({ amountMinor: 123_45 }), standard, { rulesetVersion: 1 });
    expect(a.taxAmountMinor).toBe(b.taxAmountMinor);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('rule resolution: two independent time axes', () => {
  const v1 = r({ id: 'BR:E:ICMS@v1', ruleKey: 'BR:E:ICMS', version: 1, countryCode: 'BR', productCategory: 'electronics', taxType: 'ICMS', rateBps: 1700, validFrom: '2020-01-01', validTo: '2026-01-01' });
  const v2 = r({ id: 'BR:E:ICMS@v2', ruleKey: 'BR:E:ICMS', version: 2, countryCode: 'BR', productCategory: 'electronics', taxType: 'ICMS', rateBps: 1800, validFrom: '2026-01-01', validTo: null });
  const q = (transactionDate: string, asOf = '2026-06-01T00:00:00.000Z') => ({
    countryCode: 'BR', productCategory: 'electronics', customerType: 'individual', transactionDate, asOf,
  });

  it('VALID TIME: picks the rule that was law on the transaction date', () => {
    expect(resolveApplicableRules([v1, v2], q('2025-12-31'))[0].id).toBe('BR:E:ICMS@v1');
    expect(resolveApplicableRules([v1, v2], q('2026-01-02'))[0].id).toBe('BR:E:ICMS@v2');
  });

  it('SYSTEM TIME: a rule recorded later is invisible to an earlier as-of instant', () => {
    const late = r({ ...v2, id: 'BR:E:ICMS@v3', version: 3, rateBps: 2000, recordedAt: '2026-05-01T00:00:00.000Z' });
    const superseded = r({ ...v2, supersededAt: '2026-05-01T00:00:00.000Z' });
    const asOfBefore = resolveApplicableRules([superseded, late], q('2026-03-01', '2026-04-01T00:00:00.000Z'));
    const asOfAfter = resolveApplicableRules([superseded, late], q('2026-03-01', '2026-06-01T00:00:00.000Z'));
    expect(asOfBefore[0].rateBps).toBe(1800);
    expect(asOfAfter[0].rateBps).toBe(2000);
  });

  it('specificity: an exact category beats the country wildcard', () => {
    const wildcard = r({ id: 'BR:*:ICMS@v1', ruleKey: 'BR:*:ICMS', version: 1, countryCode: 'BR', productCategory: '*', taxType: 'ICMS', rateBps: 1700 });
    const exact = r({ id: 'BR:FOOD:ICMS@v1', ruleKey: 'BR:FOOD:ICMS', version: 1, countryCode: 'BR', productCategory: 'food', taxType: 'ICMS', rateBps: 700 });
    const picked = resolveApplicableRules([wildcard, exact], { ...q('2026-03-01'), productCategory: 'food' });
    expect(picked).toHaveLength(1);
    expect(picked[0].rateBps).toBe(700);
  });

  it('specificity: an exact customer type beats the wildcard (B2B reverse charge)', () => {
    const b2c = r({ id: 'AR:DS:IVA@v1', ruleKey: 'AR:DS:IVA', version: 1, countryCode: 'AR', productCategory: 'digital_services', taxType: 'IVA', rateBps: 2100 });
    const b2b = r({ id: 'AR:DS:IVA:B2B@v1', ruleKey: 'AR:DS:IVA:B2B', version: 1, countryCode: 'AR', productCategory: 'digital_services', customerType: 'business', taxType: 'IVA', rateBps: 0, treatment: 'reverse_charge' });
    const picked = resolveApplicableRules([b2c, b2b], { countryCode: 'AR', productCategory: 'digital_services', customerType: 'business', transactionDate: '2026-03-01', asOf: '2026-06-01T00:00:00.000Z' });
    expect(picked[0].treatment).toBe('reverse_charge');
  });
});
