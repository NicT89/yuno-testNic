import { NextResponse } from "next/server";

function snakeCaseKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Translate domain-shaped objects at the HTTP boundary without leaking that
 * transport convention into the pure calculator or repository layers.
 */
export function toSnakeCaseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSnakeCaseKeys);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      snakeCaseKey(key),
      toSnakeCaseKeys(nested),
    ]),
  );
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(toSnakeCaseKeys(data), init);
}

/**
 * Single error envelope for the whole API: `{ error: { code, message } }`.
 * A machine-readable `code` matters more than the prose here — an integrator
 * branches on NO_APPLICABLE_RULE, not on an English sentence.
 */
export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    toSnakeCaseKeys({
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    }),
    { status },
  );
}

/** Parse a JSON request body, or return null when it is not valid JSON. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}
