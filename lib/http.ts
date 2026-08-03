import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json(
    { error, ...(details !== undefined ? { details } : {}) },
    { status },
  );
}

/** Coerce a query/body value to a non-negative integer minor-unit amount. */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}
