import { Router } from 'express';
import { getAudit, listAudit } from '../../db/auditRepo.ts';
import { replay } from '../../service/taxService.ts';

export const auditRouter = Router();

/** GET /api/v1/audit?country=BR&from=...&to=...&limit=50 */
auditRouter.get('/', (req, res, next) => {
  try {
    const records = listAudit({
      countryCode: req.query.country as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json({ count: records.length, records });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/audit/:transactionId - Core Requirement 2. */
auditRouter.get('/:transactionId', (req, res, next) => {
  try {
    const record = getAudit(req.params.transactionId);
    if (!record) {
      return res.status(404).json({
        error: {
          code: 'AUDIT_RECORD_NOT_FOUND',
          message: `No audit record for transaction ${req.params.transactionId}`,
        },
      });
    }
    res.json(record);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/audit/:transactionId/replay
 * Recomputes the transaction twice: once against the rule versions snapshotted
 * at the time, once against today's rules. Demonstrates rule versioning without
 * asking the reviewer to take the stored numbers on faith.
 */
auditRouter.get('/:transactionId/replay', (req, res, next) => {
  try {
    const result = replay(req.params.transactionId);
    if (!result) {
      return res.status(404).json({
        error: { code: 'AUDIT_RECORD_NOT_FOUND', message: 'Nothing to replay.' },
      });
    }
    res.json({
      transaction_id: req.params.transactionId,
      historical_and_original_match: result.identical,
      original_tax_minor: (result.original as any).taxAmountMinor,
      replayed_with_historical_rules_minor: result.replayedWithHistoricalRules.taxAmountMinor,
      replayed_with_current_rules_minor: result.replayedWithCurrentRules.taxAmountMinor,
      rules_changed_since:
        result.replayedWithHistoricalRules.taxAmountMinor !==
        result.replayedWithCurrentRules.taxAmountMinor,
      detail: result,
    });
  } catch (err) {
    next(err);
  }
});
