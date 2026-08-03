import { listAudit } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import { parseCountryParam, ValidationError } from "@/lib/validation";

/**
 * GET /api/audit?country=BR&from=2026-01-01&to=2026-12-31&limit=50&offset=0
 *
 * Browse the immutable calculation log. `from` / `to` filter on the TRANSACTION
 * date, which is the axis a tax authority files on.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const limit = limitParam ? Number(limitParam) : 100;
    const offset = offsetParam ? Number(offsetParam) : 0;

    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new ValidationError("`limit` must be an integer between 1 and 1000.", "limit");
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ValidationError("`offset` must be a non-negative integer.", "offset");
    }

    const records = listAudit({
      countryCode: parseCountryParam(searchParams.get("country")),
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      limit,
      offset,
    });

    return jsonOk({ count: records.length, limit, offset, records });
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonError(400, err.code, err.message, err.field ? { field: err.field } : undefined);
    }
    throw err;
  }
}
