/**
 * 56 simulated transactions covering all five countries, nine product
 * categories, three amount bands, both customer types, and every edge case the
 * brief calls out.
 *
 * Amounts are given in MINOR units so the fixtures are unambiguous.
 * `note` explains what each row is meant to exercise, which doubles as the
 * test plan for tax-calculation accuracy.
 */

export interface SeedTransaction {
  transactionId: string;
  amountMinor: number;
  discountMinor?: number;
  countryCode: string;
  productCategory: string;
  customerType: 'individual' | 'business';
  transactionDate: string;
  priceIncludesTax?: boolean;
  note: string;
}

const D = (iso: string) => `${iso}T12:00:00.000Z`;

export const SEED_TRANSACTIONS: SeedTransaction[] = [
  // ---- BRAZIL: date-based rule selection across the 2026 ICMS change --------
  { transactionId: 'txn_br_0001', amountMinor: 100_00, countryCode: 'BR', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2025-11-15'), note: 'ICMS v1 @17% (pre-2026)' },
  { transactionId: 'txn_br_0002', amountMinor: 100_00, countryCode: 'BR', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-03-15'), note: 'ICMS v2 @18% (post-reform) - SAME inputs, different date' },
  { transactionId: 'txn_br_0003', amountMinor: 2_499_90, countryCode: 'BR', productCategory: 'electronics', customerType: 'business', transactionDate: D('2026-04-02'), note: 'Large B2B electronics' },
  { transactionId: 'txn_br_0004', amountMinor: 45_50, countryCode: 'BR', productCategory: 'food', customerType: 'individual', transactionDate: D('2026-02-10'), note: 'Reduced 7% food rate' },
  { transactionId: 'txn_br_0005', amountMinor: 8_90, countryCode: 'BR', productCategory: 'food', customerType: 'individual', transactionDate: D('2026-02-11'), note: 'Small-ticket food' },
  { transactionId: 'txn_br_0006', amountMinor: 79_00, countryCode: 'BR', productCategory: 'books', customerType: 'individual', transactionDate: D('2026-02-12'), note: 'Constitutional book immunity: 0%' },
  { transactionId: 'txn_br_0007', amountMinor: 199_99, countryCode: 'BR', productCategory: 'digital_services', customerType: 'individual', transactionDate: D('2026-02-13'), note: 'MULTI-TAX: ICMS 17% + ISS 5% stacked' },
  { transactionId: 'txn_br_0008', amountMinor: 1_500_00, countryCode: 'BR', productCategory: 'digital_services', customerType: 'business', transactionDate: D('2026-03-01'), note: 'Large stacked B2B digital' },
  { transactionId: 'txn_br_0009', amountMinor: 320_00, countryCode: 'BR', productCategory: 'clothing', customerType: 'individual', transactionDate: D('2026-03-05'), note: 'Falls through to BR:*:ICMS wildcard' },
  { transactionId: 'txn_br_0010', amountMinor: 64_00, countryCode: 'BR', productCategory: 'medicine', customerType: 'individual', transactionDate: D('2026-03-06'), note: 'Reduced 12% medicine' },
  { transactionId: 'txn_br_0011', amountMinor: 250_00, discountMinor: 50_00, countryCode: 'BR', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-03-07'), note: 'Discount reduces the net taxable base' },
  { transactionId: 'txn_br_0012', amountMinor: 0, countryCode: 'BR', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-03-08'), note: 'EDGE: zero amount' },
  { transactionId: 'txn_br_0013', amountMinor: -100_00, countryCode: 'BR', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-03-09'), note: 'EDGE: refund, tax reversed at same rate' },
  { transactionId: 'txn_br_0014', amountMinor: 118_00, countryCode: 'BR', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-03-10'), priceIncludesTax: true, note: 'Tax-inclusive price decomposed back to 100.00 base' },
  { transactionId: 'txn_br_0015', amountMinor: 5_00, countryCode: 'BR', productCategory: 'education', customerType: 'individual', transactionDate: D('2026-03-11'), note: 'Exempt category, tiny amount' },

  // ---- COLOMBIA: threshold boundaries -------------------------------------
  { transactionId: 'txn_co_0001', amountMinor: 250_000_00, countryCode: 'CO', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-01-20'), note: 'IVA 19% standard' },
  { transactionId: 'txn_co_0002', amountMinor: 12_000_00, countryCode: 'CO', productCategory: 'food', customerType: 'individual', transactionDate: D('2026-01-21'), note: 'Reduced 5% food' },
  { transactionId: 'txn_co_0003', amountMinor: 60_000_00, countryCode: 'CO', productCategory: 'books', customerType: 'individual', transactionDate: D('2026-01-22'), note: 'Books exempt' },
  { transactionId: 'txn_co_0004', amountMinor: 9_999_99, countryCode: 'CO', productCategory: 'clothing', customerType: 'individual', transactionDate: D('2026-01-23'), note: 'EDGE: 1 centavo BELOW the 100,000 clothing threshold -> exempt' },
  { transactionId: 'txn_co_0005', amountMinor: 10_000_00, countryCode: 'CO', productCategory: 'clothing', customerType: 'individual', transactionDate: D('2026-01-24'), note: 'EDGE: exactly AT the threshold -> taxed' },
  { transactionId: 'txn_co_0006', amountMinor: 10_000_01, countryCode: 'CO', productCategory: 'clothing', customerType: 'individual', transactionDate: D('2026-01-25'), note: 'EDGE: 1 centavo ABOVE the threshold -> taxed' },
  { transactionId: 'txn_co_0007', amountMinor: 89_900_00, countryCode: 'CO', productCategory: 'digital_services', customerType: 'individual', transactionDate: D('2026-01-26'), note: 'Digital services 19%' },
  { transactionId: 'txn_co_0008', amountMinor: 1_200_000_00, countryCode: 'CO', productCategory: 'digital_services', customerType: 'business', transactionDate: D('2026-02-01'), note: 'Large B2B digital (CO has no reverse charge rule: still 19%)' },
  { transactionId: 'txn_co_0009', amountMinor: 45_000_00, countryCode: 'CO', productCategory: 'medicine', customerType: 'individual', transactionDate: D('2026-02-02'), note: 'Medicine exempt' },
  { transactionId: 'txn_co_0010', amountMinor: -250_000_00, countryCode: 'CO', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-02-03'), note: 'EDGE: refund of txn_co_0001' },
  { transactionId: 'txn_co_0011', amountMinor: 8_00, countryCode: 'CO', productCategory: 'food', customerType: 'individual', transactionDate: D('2026-02-04'), note: 'Sub-USD-10 micro transaction, rounding pressure' },

  // ---- ARGENTINA: B2B reverse charge + stacked PAIS ------------------------
  { transactionId: 'txn_ar_0001', amountMinor: 15_000_00, countryCode: 'AR', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-01-10'), note: 'IVA 21% via AR:*:IVA wildcard' },
  { transactionId: 'txn_ar_0002', amountMinor: 2_350_00, countryCode: 'AR', productCategory: 'food', customerType: 'individual', transactionDate: D('2026-01-11'), note: 'Reduced 10.5% food' },
  { transactionId: 'txn_ar_0003', amountMinor: 4_800_00, countryCode: 'AR', productCategory: 'books', customerType: 'individual', transactionDate: D('2026-01-12'), note: 'Ley del Libro: exempt' },
  { transactionId: 'txn_ar_0004', amountMinor: 9_990_00, countryCode: 'AR', productCategory: 'digital_services', customerType: 'individual', transactionDate: D('2026-01-13'), note: 'MULTI-TAX: IVA 21% + PAIS 8% for a consumer' },
  { transactionId: 'txn_ar_0005', amountMinor: 9_990_00, countryCode: 'AR', productCategory: 'digital_services', customerType: 'business', transactionDate: D('2026-01-14'), note: 'B2B REVERSE CHARGE: identical amount, zero collected' },
  { transactionId: 'txn_ar_0006', amountMinor: 120_000_00, countryCode: 'AR', productCategory: 'clothing', customerType: 'individual', transactionDate: D('2026-01-15'), note: 'Large clothing, wildcard 21%' },
  { transactionId: 'txn_ar_0007', amountMinor: 3_200_00, countryCode: 'AR', productCategory: 'medicine', customerType: 'individual', transactionDate: D('2026-01-16'), note: 'Reduced 10.5% medicine' },
  { transactionId: 'txn_ar_0008', amountMinor: 550_00, discountMinor: 55_00, countryCode: 'AR', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-01-17'), note: '10% discount then 21% IVA on the net' },
  { transactionId: 'txn_ar_0009', amountMinor: 0, countryCode: 'AR', productCategory: 'digital_services', customerType: 'individual', transactionDate: D('2026-01-18'), note: 'EDGE: zero amount on a stacked-tax category' },
  { transactionId: 'txn_ar_0010', amountMinor: -9_990_00, countryCode: 'AR', productCategory: 'digital_services', customerType: 'individual', transactionDate: D('2026-01-19'), note: 'EDGE: refund reverses BOTH stacked taxes' },
  { transactionId: 'txn_ar_0011', amountMinor: 999_00, countryCode: 'AR', productCategory: 'education', customerType: 'individual', transactionDate: D('2026-01-20'), note: 'No AR education rule: falls back to wildcard 21%' },

  // ---- CHILE: zero-decimal currency ---------------------------------------
  { transactionId: 'txn_cl_0001', amountMinor: 89_990, countryCode: 'CL', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-02-05'), note: 'CLP has NO minor unit: 89990 = CLP 89,990' },
  { transactionId: 'txn_cl_0002', amountMinor: 3_490, countryCode: 'CL', productCategory: 'food', customerType: 'individual', transactionDate: D('2026-02-06'), note: 'Chile has no reduced food rate: still 19%' },
  { transactionId: 'txn_cl_0003', amountMinor: 12_990, countryCode: 'CL', productCategory: 'books', customerType: 'individual', transactionDate: D('2026-02-07'), note: 'Chile taxes books at 19% (unlike BR/CO/AR/PE)' },
  { transactionId: 'txn_cl_0004', amountMinor: 7, countryCode: 'CL', productCategory: 'food', customerType: 'individual', transactionDate: D('2026-02-08'), note: 'EDGE: CLP 7 -> 19% = 1.33 -> rounds to whole peso' },
  { transactionId: 'txn_cl_0005', amountMinor: 1_250_000, countryCode: 'CL', productCategory: 'digital_services', customerType: 'business', transactionDate: D('2026-02-09'), note: 'Large B2B digital service' },
  { transactionId: 'txn_cl_0006', amountMinor: 45_000, countryCode: 'CL', productCategory: 'clothing', customerType: 'individual', transactionDate: D('2026-02-10'), note: 'Wildcard 19%' },
  { transactionId: 'txn_cl_0007', amountMinor: -89_990, countryCode: 'CL', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-02-11'), note: 'EDGE: refund in a zero-decimal currency' },
  { transactionId: 'txn_cl_0008', amountMinor: 0, countryCode: 'CL', productCategory: 'books', customerType: 'individual', transactionDate: D('2026-02-12'), note: 'EDGE: zero amount' },
  { transactionId: 'txn_cl_0009', amountMinor: 23_800, countryCode: 'CL', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-02-13'), priceIncludesTax: true, note: 'Tax-inclusive CLP decomposition' },

  // ---- PERU ----------------------------------------------------------------
  { transactionId: 'txn_pe_0001', amountMinor: 450_00, countryCode: 'PE', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-03-01'), note: 'IGV 18%' },
  { transactionId: 'txn_pe_0002', amountMinor: 25_50, countryCode: 'PE', productCategory: 'food', customerType: 'individual', transactionDate: D('2026-03-02'), note: 'Unprocessed food exempt' },
  { transactionId: 'txn_pe_0003', amountMinor: 89_00, countryCode: 'PE', productCategory: 'books', customerType: 'individual', transactionDate: D('2026-03-03'), note: 'Ley del Libro exempt' },
  { transactionId: 'txn_pe_0004', amountMinor: 1_890_00, countryCode: 'PE', productCategory: 'digital_services', customerType: 'individual', transactionDate: D('2026-03-04'), note: 'Digital services IGV 18% (in force from 2024-12-01)' },
  { transactionId: 'txn_pe_0005', amountMinor: 1_890_00, countryCode: 'PE', productCategory: 'digital_services', customerType: 'individual', transactionDate: D('2024-06-15'), note: 'EDGE: SAME inputs BEFORE the digital rule existed -> falls back to PE:*:IGV' },
  { transactionId: 'txn_pe_0006', amountMinor: 9_99, countryCode: 'PE', productCategory: 'clothing', customerType: 'individual', transactionDate: D('2026-03-05'), note: 'Sub-10 sol purchase' },
  { transactionId: 'txn_pe_0007', amountMinor: 320_00, countryCode: 'PE', productCategory: 'medicine', customerType: 'individual', transactionDate: D('2026-03-06'), note: 'Medicine exempt' },
  { transactionId: 'txn_pe_0008', amountMinor: 12_500_00, countryCode: 'PE', productCategory: 'electronics', customerType: 'business', transactionDate: D('2026-03-07'), note: 'Large B2B' },
  { transactionId: 'txn_pe_0009', amountMinor: -450_00, countryCode: 'PE', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-03-08'), note: 'EDGE: refund' },
  { transactionId: 'txn_pe_0010', amountMinor: 100_01, countryCode: 'PE', productCategory: 'electronics', customerType: 'individual', transactionDate: D('2026-03-09'), note: 'Odd cent value: proves integer rounding, 18% of 100.01 = 18.00' },
];
