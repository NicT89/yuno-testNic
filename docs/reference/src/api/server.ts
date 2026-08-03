import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { getDb } from '../db/index.ts';
import { NoApplicableRuleError } from '../domain/calculator.ts';
import { ENGINE_VERSION } from '../domain/types.ts';
import { calculationsRouter } from './routes/calculations.ts';
import { auditRouter } from './routes/audit.ts';
import { rulesRouter } from './routes/rules.ts';
import { reportsRouter } from './routes/reports.ts';

export function createServer() {
  getDb(); // boot + migrate

  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', engineVersion: ENGINE_VERSION, service: 'tiendamax-tax-engine' });
  });

  app.get('/', (_req, res) => {
    res.json({
      service: 'TiendaMax Multi-Country Tax Compliance Engine',
      engineVersion: ENGINE_VERSION,
      endpoints: {
        'POST /api/v1/tax/calculate': 'Calculate tax for a transaction',
        'POST /api/v1/tax/decompose': 'Split a tax-inclusive price into base + tax',
        'GET  /api/v1/audit/:transactionId': 'Retrieve one audit record',
        'GET  /api/v1/audit': 'Search the audit trail (country, from, to)',
        'GET  /api/v1/audit/:transactionId/replay': 'Re-run a historical calculation',
        'GET  /api/v1/rules': 'List tax rules (?country=&on_date=&as_of=&include_superseded=)',
        'GET  /api/v1/rules/:ruleKey/versions': 'Full version history of one rule',
        'POST /api/v1/rules': 'Publish a new version of a rule',
        'GET  /api/v1/reports/compliance': 'Compliance report (?country=&from=&to=&format=)',
      },
    });
  });

  app.use('/api/v1/tax', calculationsRouter);
  app.use('/api/v1/audit', auditRouter);
  app.use('/api/v1/rules', rulesRouter);
  app.use('/api/v1/reports', reportsRouter);

  // Single error contract for the whole API.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request failed validation.',
          issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    }
    if (err instanceof NoApplicableRuleError) {
      return res.status(422).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }
    const message = err instanceof Error ? err.message : 'Unexpected error';
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } });
  });

  return app;
}

const isMain = process.argv[1]?.endsWith('server.ts');
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  createServer().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`TiendaMax tax engine listening on http://localhost:${port}`);
  });
}
