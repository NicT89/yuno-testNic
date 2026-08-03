import { jsonOk } from "@/lib/http";

/**
 * GET /api/health
 * Liveness check for deploy verification.
 */
export async function GET() {
  return jsonOk({
    status: "ok",
    service: "yuno-tax",
    timestamp: new Date().toISOString(),
  });
}
