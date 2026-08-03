import { Router } from 'express';
import { createRuleSchema } from '../validation.ts';
import {
  createRuleVersion,
  currentRulesetVersion,
  listRules,
  listVersionsOfRule,
} from '../../db/rulesRepo.ts';

export const rulesRouter = Router();

/**
 * GET /api/v1/rules
 *   ?country=BR                 filter by country
 *   &on_date=2026-03-01         VALID TIME: rules that were law on this date
 *   &as_of=2026-01-01T00:00:00Z SYSTEM TIME: what we believed at this instant
 *   &include_superseded=true    show the full history
 */
rulesRouter.get('/', (req, res, next) => {
  try {
    const rules = listRules({
      countryCode: req.query.country as string | undefined,
      onDate: req.query.on_date as string | undefined,
      asOf: req.query.as_of as string | undefined,
      includeSuperseded: req.query.include_superseded === 'true',
    });
    res.json({
      ruleset_version: currentRulesetVersion(),
      count: rules.length,
      rules,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/rules/:ruleKey/versions - full lineage of one rule. */
rulesRouter.get('/:ruleKey/versions', (req, res, next) => {
  try {
    const versions = listVersionsOfRule(req.params.ruleKey);
    if (versions.length === 0) {
      return res.status(404).json({
        error: { code: 'RULE_NOT_FOUND', message: `No rule with key ${req.params.ruleKey}` },
      });
    }
    res.json({ rule_key: req.params.ruleKey, versions });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/rules
 * Core Requirement 3. Publishes a NEW VERSION. Never mutates an existing one,
 * so every calculation already recorded keeps resolving to the rule that was
 * in force when it ran.
 */
rulesRouter.post('/', (req, res, next) => {
  try {
    const body = createRuleSchema.parse(req.body);
    const created = createRuleVersion(
      {
        ruleKey: body.rule_key,
        countryCode: body.country_code,
        productCategory: body.product_category.toLowerCase(),
        customerType: body.customer_type,
        taxType: body.tax_type,
        taxScope: body.tax_scope,
        rateBps: body.rate_bps,
        treatment: body.treatment,
        thresholdMinor: body.threshold_minor,
        taxableBase: body.taxable_base,
        priority: body.priority,
        compoundOnPrevious: body.compound_on_previous,
        validFrom: body.valid_from,
        validTo: body.valid_to ?? null,
        legalReference: body.legal_reference ?? null,
        notes: body.notes ?? null,
      },
      body.change_note,
    );
    res.status(201).json({
      message:
        'New rule version published. Existing audit records are unaffected and still resolve to their original version.',
      ruleset_version: currentRulesetVersion(),
      rule: created,
    });
  } catch (err) {
    next(err);
  }
});
