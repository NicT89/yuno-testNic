import {
  formatComplianceReportText,
  generateComplianceReport,
} from "@/lib/compliance";
import { jsonError, jsonOk } from "@/lib/http";

/**
 * GET /api/tax/report?country=MX&format=json
 * GET /api/tax/report?country=MX&format=text
 * GET /api/tax/report?country=MX&from=2025-01-01&to=2025-12-31
 *
 * Generates an aggregated compliance report from sample transactions.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country")?.toUpperCase();
  const format = (searchParams.get("format") ?? "json").toLowerCase();
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  if (!country || country.length !== 2) {
    return jsonError(
      400,
      "`country` query param is required (ISO 3166-1 alpha-2, e.g. MX)",
    );
  }

  try {
    const report = generateComplianceReport({ country, from, to });

    if (format === "text" || format === "txt") {
      return new Response(formatComplianceReportText(report), {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename="compliance-${country}.txt"`,
        },
      });
    }

    if (format === "csv") {
      const header = "transaction_id,date,category,net,tax,gross,rule_id,rule_version,currency";
      const rows = report.transactions.map((row) =>
        [
          row.transaction.id,
          row.transaction.transactionDate,
          row.tax.category,
          row.tax.netAmount,
          row.tax.taxAmount,
          row.tax.grossAmount,
          row.tax.appliedRule.id,
          row.tax.appliedRule.version,
          row.tax.currency,
        ].join(","),
      );
      const csv = [
        `# compliance report ${report.country} ${report.period.from}..${report.period.to}`,
        `# total_tax=${report.summary.totalTax}`,
        header,
        ...rows,
      ].join("\n");

      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `inline; filename="compliance-${country}.csv"`,
        },
      });
    }

    return jsonOk(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate report";
    return jsonError(404, message);
  }
}
