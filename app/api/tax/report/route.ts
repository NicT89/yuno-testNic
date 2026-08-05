import { buildComplianceReport, formatComplianceReportCsv } from "@/lib/compliance";
import { jsonError, jsonOk } from "@/lib/http";
import { formatMinor } from "@/lib/money";
import {
  parseCountryParam,
  parseDateRangeParams,
  ValidationError,
} from "@/lib/validation";

/**
 * GET /api/tax/report?country=BR&from=2026-01-01&to=2026-12-31&format=json|csv
 *
 * Aggregates the audit trail — what was actually charged — for one country over
 * a period. `from` / `to` bound the TRANSACTION date, which is the axis a tax
 * authority files on.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "json").toLowerCase();

  try {
    const country = parseCountryParam(searchParams.get("country"));
    if (!country) {
      throw new ValidationError(
        "`country` query parameter is required (BR, CO, AR, CL or PE).",
        "country",
      );
    }
    if (format !== "json" && format !== "csv") {
      throw new ValidationError("`format` must be `json` or `csv`.", "format");
    }

    // Date-only `to` values include the full calendar day; malformed and
    // reversed ranges fail explicitly instead of producing a misleading file.
    const { from, to } = parseDateRangeParams(
      searchParams.get("from"),
      searchParams.get("to"),
    );

    const report = buildComplianceReport(country, from, to);

    if (format === "csv") {
      return new Response(formatComplianceReportCsv(report), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `inline; filename="compliance-${country}.csv"`,
        },
      });
    }

    const cur = report.currency ?? "XXX";
    return jsonOk({
      ...report,
      human_readable: {
        total_tax_collected: `${formatMinor(report.totals.totalTaxCollectedMinor, cur)} ${cur}`,
        total_base: `${formatMinor(report.totals.grossBaseAmountMinor, cur)} ${cur}`,
        average_effective_rate: `${(report.totals.averageEffectiveRateBps / 100).toFixed(2)}%`,
      },
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonError(400, err.code, err.message, err.field ? { field: err.field } : undefined);
    }
    throw err;
  }
}
