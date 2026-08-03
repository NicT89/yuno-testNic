import { z } from 'zod';
import { CURRENCY_EXPONENTS, toMinor } from '../domain/money.ts';
import type { CalculationInput } from '../domain/types.ts';

export const SUPPORTED_COUNTRIES = ['BR', 'CO', 'AR', 'CL', 'PE'] as const;

const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  BR: 'BRL',
  CO: 'COP',
  AR: 'ARS',
  CL: 'CLP',
  PE: 'PEN',
};

/**
 * Amount may be supplied either as `amount` (major units, e.g. 199.99) or as
 * `amount_minor` (integer centavos). Minor units are authoritative; the major
 * form exists so that curl examples in the README stay readable.
 */
export const calculateRequestSchema = z
  .object({
    amount: z.union([z.number(), z.string()]).optional(),
    amount_minor: z.number().int().optional(),
    discount: z.union([z.number(), z.string()]).optional(),
    discount_minor: z.number().int().min(0).optional(),
    country_code: z.enum(SUPPORTED_COUNTRIES),
    product_category: z.string().min(1).max(64),
    customer_type: z.enum(['individual', 'business']).default('individual'),
    currency: z.string().length(3).toUpperCase().optional(),
    transaction_date: z.string().datetime({ offset: true }).optional(),
    price_includes_tax: z.boolean().default(false),
    transaction_id: z.string().min(1).max(128).optional(),
  })
  .refine((v) => v.amount !== undefined || v.amount_minor !== undefined, {
    message: 'Provide either `amount` (major units) or `amount_minor` (integer minor units).',
  })
  .refine((v) => !v.currency || v.currency in CURRENCY_EXPONENTS, {
    message: `Unsupported currency. Supported: ${Object.keys(CURRENCY_EXPONENTS).join(', ')}`,
    path: ['currency'],
  });

export type CalculateRequest = z.infer<typeof calculateRequestSchema>;

export function toCalculationInput(req: CalculateRequest): CalculationInput {
  const currency = req.currency ?? COUNTRY_DEFAULT_CURRENCY[req.country_code];
  const amountMinor =
    req.amount_minor !== undefined ? req.amount_minor : toMinor(req.amount!, currency);
  const discountMinor =
    req.discount_minor !== undefined
      ? req.discount_minor
      : req.discount !== undefined
        ? toMinor(req.discount, currency)
        : 0;

  return {
    amountMinor,
    discountMinor,
    currency,
    countryCode: req.country_code,
    productCategory: req.product_category.toLowerCase(),
    customerType: req.customer_type,
    transactionDate: req.transaction_date ?? new Date().toISOString(),
    priceIncludesTax: req.price_includes_tax,
  };
}

export const createRuleSchema = z.object({
  rule_key: z.string().min(3),
  country_code: z.enum(SUPPORTED_COUNTRIES),
  product_category: z.string().min(1),
  customer_type: z.enum(['individual', 'business', '*']).default('*'),
  tax_type: z.string().min(2),
  tax_scope: z.enum(['national', 'state', 'municipal']).default('national'),
  rate_bps: z.number().int().min(0).max(10_000),
  treatment: z
    .enum(['standard', 'reduced', 'exempt', 'zero_rated', 'reverse_charge'])
    .default('standard'),
  threshold_minor: z.number().int().min(0).default(0),
  taxable_base: z.enum(['gross', 'net']).default('net'),
  priority: z.number().int().default(100),
  compound_on_previous: z.boolean().default(false),
  valid_from: z.string().min(4),
  valid_to: z.string().min(4).nullable().optional(),
  legal_reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  change_note: z.string().default('Rule updated via API'),
});

export const reportQuerySchema = z.object({
  country: z.enum(SUPPORTED_COUNTRIES),
  from: z.string().min(4),
  to: z.string().min(4),
  format: z.enum(['json', 'csv']).default('json'),
});
