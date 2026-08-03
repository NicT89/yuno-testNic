import { Router } from 'express';
import { calculateRequestSchema, toCalculationInput } from '../validation.ts';
import { calculate, decompose, presentResult } from '../../service/taxService.ts';

export const calculationsRouter = Router();

/**
 * POST /api/v1/tax/calculate
 * Core Requirement 1. Deterministic for a given (inputs, ruleset).
 * Honours an optional `Idempotency-Key` header the way a payments API would.
 */
calculationsRouter.post('/calculate', (req, res, next) => {
  try {
    const parsed = calculateRequestSchema.parse(req.body);
    const input = toCalculationInput(parsed);
    const outcome = calculate({
      input,
      rawRequest: req.body,
      transactionId: parsed.transaction_id,
      idempotencyKey: (req.header('Idempotency-Key') as string | undefined) ?? null,
    });

    res.status(200).json({
      transaction_id: outcome.transactionId,
      calculated_at: outcome.createdAt,
      replayed_from_idempotency_key: outcome.replayed,
      ...presentResult(outcome.result),
      audit_url: `/api/v1/audit/${outcome.transactionId}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/tax/decompose
 * Stretch goal 5: given a tax-INCLUSIVE price, return base + tax components.
 */
calculationsRouter.post('/decompose', (req, res, next) => {
  try {
    const parsed = calculateRequestSchema.parse({ ...req.body, price_includes_tax: true });
    const input = toCalculationInput(parsed);
    const result = decompose(input);
    res.json({
      note: 'Input treated as tax-inclusive; base and tax derived by decomposition.',
      ...presentResult(result),
    });
  } catch (err) {
    next(err);
  }
});
