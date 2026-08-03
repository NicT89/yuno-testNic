import { Router } from 'express';
import { reportQuerySchema } from '../validation.ts';
import { buildComplianceReport } from '../../db/auditRepo.ts';
import { formatMinor } from '../../domain/money.ts';

export const reportsRouter = Router();

/**
 * GET /api/v1/reports/compliance?country=BR&from=2026-01-01&to=2026-12-31&format=json|csv
 * Core Requirement 2, second half: the artefact a finance team actually files.
 */
reportsRouter.get('/compliance', (req, res, next) => {
  try {
    const q = reportQuerySchema.parse(req.query);
    const report = buildComplianceReport(q.country, q.from, q.to);

    if (q.format === 'csv') {
      const cur = report.currency ?? 'XXX';
      const lines = [
        'product_category,transactions,base_amount,tax_amount,effective_rate',
        ...report.byCategory.map(
          (c) =>
            `${c.productCategory},${c.transactions},${formatMinor(c.baseAmountMinor, cur)},` +
            `${formatMinor(c.taxAmountMinor, cur)},${(c.effectiveRateBps / 100).toFixed(2)}%`,
        ),
        `TOTAL,${report.totals.transactionsProcessed},` +
          `${formatMinor(report.totals.grossBaseAmountMinor, cur)},` +
          `${formatMinor(report.totals.totalTaxCollectedMinor, cur)},` +
          `${(report.totals.averageEffectiveRateBps / 100).toFixed(2)}%`,
      ];
      res.type('text/csv').send(lines.join('\n'));
      return;
    }

    const cur = report.currency ?? 'XXX';
    res.json({
      ...report,
      human_readable: {
        total_tax_collected: `${formatMinor(report.totals.totalTaxCollectedMinor, cur)} ${cur}`,
        total_base: `${formatMinor(report.totals.grossBaseAmountMinor, cur)} ${cur}`,
        average_effective_rate: `${(report.totals.averageEffectiveRateBps / 100).toFixed(2)}%`,
      },
    });
  } catch (err) {
    next(err);
  }
});
