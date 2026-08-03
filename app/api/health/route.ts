import { jsonOk } from "@/lib/http";

/**
 * GET /api/health
 * Liveness / service index for deploy verification.
 */
export async function GET() {
  return jsonOk({
    status: "ok",
    service: "yuno-tax",
    disclaimer: "Illustrative tax data. Not tax advice.",
    timestamp: new Date().toISOString(),
  });
}
