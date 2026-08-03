/**
 * Tax rule catalogue: 5 countries, 26 rule versions.
 *
 * Rates are realistic for LATAM digital/cross-border commerce as of 2025-2026.
 * They are a defensible working set, not legal advice: the point of the engine
 * is that a finance team can correct any of them through the API without a
 * deploy, and that the correction never rewrites history.
 *
 * VERSIONED RULES (seeded with real history so date-based selection is
 * demonstrable straight after `npm run seed`):
 *   BR:ELECTRONICS:ICMS  v1 = 17% until 2026-01-01, v2 = 18% from 2026-01-01
 *                        (mirrors Brazil's CBS/IBS transition raising the
 *                         effective indirect burden on goods)
 *   AR:*:IVA             v1 = 21%, unchanged, open-ended
 */

import type { NewRuleInput } from '../db/rulesRepo.ts';

export interface SeedRule extends NewRuleInput {
  version?: number;
  recordedAt?: string;
}

export const CURRENCIES = [
  { code: 'BRL', exponent: 2, name: 'Brazilian real' },
  { code: 'COP', exponent: 2, name: 'Colombian peso' },
  { code: 'ARS', exponent: 2, name: 'Argentine peso' },
  { code: 'CLP', exponent: 0, name: 'Chilean peso' },
  { code: 'PEN', exponent: 2, name: 'Peruvian sol' },
  { code: 'MXN', exponent: 2, name: 'Mexican peso' },
  { code: 'USD', exponent: 2, name: 'US dollar' },
];

export const COUNTRIES = [
  { code: 'BR', name: 'Brazil', currency: 'BRL', rounding: 'HALF_UP' },
  { code: 'CO', name: 'Colombia', currency: 'COP', rounding: 'HALF_UP' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', rounding: 'HALF_UP' },
  { code: 'CL', name: 'Chile', currency: 'CLP', rounding: 'HALF_UP' },
  { code: 'PE', name: 'Peru', currency: 'PEN', rounding: 'HALF_UP' },
];

const OPEN = null;

export const SEED_RULES: SeedRule[] = [
  // ===========================================================================
  // BRAZIL. Multi-tax jurisdiction: state ICMS plus municipal ISS on services.
  // ===========================================================================
  {
    ruleKey: 'BR:*:ICMS',
    countryCode: 'BR',
    productCategory: '*',
    taxType: 'ICMS',
    taxScope: 'state',
    rateBps: 1700,
    validFrom: '2020-01-01',
    validTo: OPEN,
    priority: 10,
    legalReference: 'LC 87/1996 (Lei Kandir), standard interstate rate',
    notes: 'Country default when no category-specific rule exists.',
  },
  // --- versioned pair: the rate rise that proves date-based selection --------
  {
    ruleKey: 'BR:ELECTRONICS:ICMS',
    countryCode: 'BR',
    productCategory: 'electronics',
    taxType: 'ICMS',
    taxScope: 'state',
    rateBps: 1700,
    version: 1,
    validFrom: '2020-01-01',
    validTo: '2026-01-01', // closed in VALID TIME: superseded by law, not by us
    priority: 10,
    legalReference: 'LC 87/1996',
    notes: 'Pre-reform ICMS rate on electronics.',
  },
  {
    ruleKey: 'BR:ELECTRONICS:ICMS',
    countryCode: 'BR',
    productCategory: 'electronics',
    taxType: 'ICMS',
    taxScope: 'state',
    rateBps: 1800,
    version: 2,
    validFrom: '2026-01-01',
    validTo: OPEN,
    priority: 10,
    legalReference: 'EC 132/2023 transition (CBS/IBS phase-in)',
    notes:
      'Post-reform rate. A transaction dated 2025-12-31 still resolves to v1; ' +
      'one dated 2026-01-02 resolves to v2. Same rule_key, different valid window.',
  },
  {
    ruleKey: 'BR:FOOD:ICMS',
    countryCode: 'BR',
    productCategory: 'food',
    taxType: 'ICMS',
    taxScope: 'state',
    rateBps: 700,
    treatment: 'reduced',
    validFrom: '2020-01-01',
    validTo: OPEN,
    priority: 10,
    legalReference: 'Cesta basica reduced rate',
  },
  {
    ruleKey: 'BR:BOOKS:ICMS',
    countryCode: 'BR',
    productCategory: 'books',
    taxType: 'ICMS',
    taxScope: 'state',
    rateBps: 0,
    treatment: 'exempt',
    validFrom: '2020-01-01',
    validTo: OPEN,
    priority: 10,
    legalReference: 'CF/1988 art. 150, VI, d - immunity for books and periodicals',
  },
  {
    ruleKey: 'BR:MEDICINE:ICMS',
    countryCode: 'BR',
    productCategory: 'medicine',
    taxType: 'ICMS',
    taxScope: 'state',
    rateBps: 1200,
    treatment: 'reduced',
    validFrom: '2020-01-01',
    validTo: OPEN,
    priority: 10,
  },
  {
    ruleKey: 'BR:DIGITAL_SERVICES:ISS',
    countryCode: 'BR',
    productCategory: 'digital_services',
    taxType: 'ISS',
    taxScope: 'municipal',
    rateBps: 500,
    validFrom: '2020-01-01',
    validTo: OPEN,
    priority: 20,
    compoundOnPrevious: false,
    legalReference: 'LC 116/2003 - municipal service tax, Sao Paulo rate',
    notes: 'STACKS on top of ICMS. This is the multi-tax case.',
  },
  {
    ruleKey: 'BR:DIGITAL_SERVICES:ICMS',
    countryCode: 'BR',
    productCategory: 'digital_services',
    taxType: 'ICMS',
    taxScope: 'state',
    rateBps: 1700,
    validFrom: '2020-01-01',
    validTo: OPEN,
    priority: 10,
  },
  {
    ruleKey: 'BR:EDUCATION:ICMS',
    countryCode: 'BR',
    productCategory: 'education',
    taxType: 'ICMS',
    taxScope: 'state',
    rateBps: 0,
    treatment: 'exempt',
    validFrom: '2020-01-01',
    validTo: OPEN,
    priority: 10,
  },

  // ===========================================================================
  // COLOMBIA. IVA 19%, reduced 5%, plus a small-ticket threshold.
  // ===========================================================================
  {
    ruleKey: 'CO:*:IVA',
    countryCode: 'CO',
    productCategory: '*',
    taxType: 'IVA',
    rateBps: 1900,
    validFrom: '2017-01-01',
    validTo: OPEN,
    legalReference: 'Estatuto Tributario art. 468 - general rate',
  },
  {
    ruleKey: 'CO:FOOD:IVA',
    countryCode: 'CO',
    productCategory: 'food',
    taxType: 'IVA',
    rateBps: 500,
    treatment: 'reduced',
    validFrom: '2017-01-01',
    validTo: OPEN,
    legalReference: 'Estatuto Tributario art. 468-1',
  },
  {
    ruleKey: 'CO:BOOKS:IVA',
    countryCode: 'CO',
    productCategory: 'books',
    taxType: 'IVA',
    rateBps: 0,
    treatment: 'exempt',
    validFrom: '2017-01-01',
    validTo: OPEN,
    legalReference: 'Estatuto Tributario art. 478 - cultural exemption',
  },
  {
    ruleKey: 'CO:MEDICINE:IVA',
    countryCode: 'CO',
    productCategory: 'medicine',
    taxType: 'IVA',
    rateBps: 0,
    treatment: 'exempt',
    validFrom: '2017-01-01',
    validTo: OPEN,
  },
  {
    ruleKey: 'CO:CLOTHING:IVA',
    countryCode: 'CO',
    productCategory: 'clothing',
    taxType: 'IVA',
    rateBps: 1900,
    // THRESHOLD: garments under COP 100,000 (10,000,000 minor) are exempt
    // during "dias sin IVA"-style relief. Demonstrates threshold handling.
    thresholdMinor: 10_000_00,
    validFrom: '2017-01-01',
    validTo: OPEN,
    notes: 'Below COP 100,000.00 no IVA is charged on clothing.',
  },
  {
    ruleKey: 'CO:DIGITAL_SERVICES:IVA',
    countryCode: 'CO',
    productCategory: 'digital_services',
    taxType: 'IVA',
    rateBps: 1900,
    validFrom: '2018-07-01',
    validTo: OPEN,
    legalReference: 'Ley 1819/2016 - IVA on non-resident digital services',
  },

  // ===========================================================================
  // ARGENTINA. IVA 21%, reduced 10.5%, and B2B reverse charge on digital
  // services (the customer_type dimension).
  // ===========================================================================
  {
    ruleKey: 'AR:*:IVA',
    countryCode: 'AR',
    productCategory: '*',
    taxType: 'IVA',
    rateBps: 2100,
    validFrom: '2017-01-01',
    validTo: OPEN,
    legalReference: 'Ley 23.349 - alicuota general',
  },
  {
    ruleKey: 'AR:FOOD:IVA',
    countryCode: 'AR',
    productCategory: 'food',
    taxType: 'IVA',
    rateBps: 1050,
    treatment: 'reduced',
    validFrom: '2017-01-01',
    validTo: OPEN,
  },
  {
    ruleKey: 'AR:BOOKS:IVA',
    countryCode: 'AR',
    productCategory: 'books',
    taxType: 'IVA',
    rateBps: 0,
    treatment: 'exempt',
    validFrom: '2017-01-01',
    validTo: OPEN,
    legalReference: 'Ley 25.446 - Ley del Libro',
  },
  {
    ruleKey: 'AR:MEDICINE:IVA',
    countryCode: 'AR',
    productCategory: 'medicine',
    taxType: 'IVA',
    rateBps: 1050,
    treatment: 'reduced',
    validFrom: '2017-01-01',
    validTo: OPEN,
  },
  {
    ruleKey: 'AR:DIGITAL_SERVICES:IVA',
    countryCode: 'AR',
    productCategory: 'digital_services',
    customerType: 'individual',
    taxType: 'IVA',
    rateBps: 2100,
    validFrom: '2018-06-27',
    validTo: OPEN,
    legalReference: 'RG 4240/2018 - IVA on digital services to consumers',
  },
  {
    ruleKey: 'AR:DIGITAL_SERVICES:IVA:B2B',
    countryCode: 'AR',
    productCategory: 'digital_services',
    customerType: 'business',
    taxType: 'IVA',
    rateBps: 0,
    treatment: 'reverse_charge',
    validFrom: '2018-06-27',
    validTo: OPEN,
    legalReference: 'RG 4240/2018 - responsable inscripto self-assesses',
    notes:
      'B2B digital services: seller collects nothing, the registered buyer ' +
      'self-assesses. More specific than AR:DIGITAL_SERVICES:IVA so it wins.',
  },
  {
    ruleKey: 'AR:DIGITAL_SERVICES:PAIS',
    countryCode: 'AR',
    productCategory: 'digital_services',
    customerType: 'individual',
    taxType: 'PAIS',
    taxScope: 'national',
    rateBps: 800,
    priority: 20,
    validFrom: '2020-01-01',
    validTo: OPEN,
    legalReference: 'Ley 27.541 - Impuesto PAIS on cross-border digital services',
    notes: 'STACKS on top of IVA. Second multi-tax case.',
  },

  // ===========================================================================
  // CHILE. Flat 19% IVA with no reduced rates. Currency has NO minor unit.
  // ===========================================================================
  {
    ruleKey: 'CL:*:IVA',
    countryCode: 'CL',
    productCategory: '*',
    taxType: 'IVA',
    rateBps: 1900,
    validFrom: '2017-01-01',
    validTo: OPEN,
    legalReference: 'DL 825 - IVA general, no reduced rates in Chile',
    notes: 'Chile applies one rate to essentially everything, including books.',
  },
  {
    ruleKey: 'CL:DIGITAL_SERVICES:IVA',
    countryCode: 'CL',
    productCategory: 'digital_services',
    taxType: 'IVA',
    rateBps: 1900,
    validFrom: '2020-06-01',
    validTo: OPEN,
    legalReference: 'Ley 21.210 - IVA on foreign digital services',
  },

  // ===========================================================================
  // PERU. IGV 18% (16% IGV + 2% IPM), with exemptions on staples and books.
  // ===========================================================================
  {
    ruleKey: 'PE:*:IGV',
    countryCode: 'PE',
    productCategory: '*',
    taxType: 'IGV',
    rateBps: 1800,
    validFrom: '2011-03-01',
    validTo: OPEN,
    legalReference: 'DL 821 - IGV 16% + IPM 2%',
  },
  {
    ruleKey: 'PE:FOOD:IGV',
    countryCode: 'PE',
    productCategory: 'food',
    taxType: 'IGV',
    rateBps: 0,
    treatment: 'exempt',
    validFrom: '2011-03-01',
    validTo: OPEN,
    legalReference: 'Apendice I - unprocessed agricultural goods',
  },
  {
    ruleKey: 'PE:BOOKS:IGV',
    countryCode: 'PE',
    productCategory: 'books',
    taxType: 'IGV',
    rateBps: 0,
    treatment: 'exempt',
    validFrom: '2011-03-01',
    validTo: OPEN,
    legalReference: 'Ley 31053 - Ley del Libro',
  },
  {
    ruleKey: 'PE:DIGITAL_SERVICES:IGV',
    countryCode: 'PE',
    productCategory: 'digital_services',
    taxType: 'IGV',
    rateBps: 1800,
    validFrom: '2024-12-01',
    validTo: OPEN,
    legalReference: 'DL 1623 - IGV on non-domiciled digital services',
  },
  {
    ruleKey: 'PE:MEDICINE:IGV',
    countryCode: 'PE',
    productCategory: 'medicine',
    taxType: 'IGV',
    rateBps: 0,
    treatment: 'exempt',
    validFrom: '2011-03-01',
    validTo: OPEN,
  },
];
