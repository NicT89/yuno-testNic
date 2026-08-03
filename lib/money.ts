/**
 * Money handling. Pure: no IO.
 *
 * RULE: money never touches a JavaScript float. All arithmetic is done in
 * integer MINOR UNITS (centavos, centimos, whole pesos for CLP). Rates are
 * held in BASIS POINTS (integers), so 19% is 1900, not 0.19.
 *
 * Why this matters here: a 19% IVA on COP 1,234,567 computed in floats drifts
 * by fractions of a cent, and across 15,000 transactions/day that is exactly
 * the kind of drift that gets a merchant flagged for underreporting.
 */

export const CURRENCY_EXPONENTS: Record<string, number> = {
  BRL: 2, // Brazilian real / centavos
  COP: 2, // Colombian peso
  ARS: 2, // Argentine peso
  CLP: 0, // Chilean peso has NO minor unit. 1 CLP is the smallest unit.
  PEN: 2, // Peruvian sol / centimos
  USD: 2,
};

/** Currency each country prices in when the caller does not say. */
export const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  BR: "BRL",
  CO: "COP",
  AR: "ARS",
  CL: "CLP",
  PE: "PEN",
};

export type RoundingMode = "HALF_UP" | "HALF_EVEN" | "DOWN";

export function currencyExponent(currency: string): number {
  const exp = CURRENCY_EXPONENTS[currency.toUpperCase()];
  if (exp === undefined) throw new Error(`Unsupported currency: ${currency}`);
  return exp;
}

/**
 * Apply a basis-point rate to an integer minor-unit amount and round to a whole
 * minor unit. Integer arithmetic throughout; the only division happens at the
 * final rounding step.
 *
 * Sign is preserved so refunds (negative amounts) produce negative tax, which
 * is what a credit note requires.
 */
export function applyRateBps(
  amountMinor: number,
  rateBps: number,
  mode: RoundingMode = "HALF_UP",
): number {
  const sign = amountMinor < 0 ? -1 : 1;
  const magnitude = Math.abs(amountMinor) * rateBps; // exact integer
  return sign * divideRound(magnitude, 10_000, mode);
}

/** Integer division with an explicit rounding policy. No floats. */
export function divideRound(
  numerator: number,
  denominator: number,
  mode: RoundingMode,
): number {
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  if (remainder === 0) return quotient;

  switch (mode) {
    case "DOWN":
      return quotient;
    case "HALF_EVEN": {
      const twice = remainder * 2;
      if (twice > denominator) return quotient + 1;
      if (twice < denominator) return quotient;
      return quotient % 2 === 0 ? quotient : quotient + 1; // banker's rounding
    }
    case "HALF_UP":
    default:
      return remainder * 2 >= denominator ? quotient + 1 : quotient;
  }
}

/** Format integer minor units as a decimal string for the API response. */
export function formatMinor(amountMinor: number, currency: string): string {
  const exp = currencyExponent(currency);
  if (exp === 0) return String(amountMinor);
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  const divisor = 10 ** exp;
  const major = Math.floor(abs / divisor);
  const minor = String(abs - major * divisor).padStart(exp, "0");
  return `${sign}${major}.${minor}`;
}

/** Parse a decimal string / number of major units into integer minor units. */
export function toMinor(amount: number | string, currency: string): number {
  const exp = currencyExponent(currency);
  const str = typeof amount === "number" ? amount.toFixed(exp) : amount.trim();
  const negative = str.startsWith("-");
  const [wholePart, fracPart = ""] = str.replace(/^[-+]/, "").split(".");
  const frac = (fracPart + "0".repeat(exp)).slice(0, exp);
  const value = Number(wholePart) * 10 ** exp + (exp > 0 ? Number(frac) : 0);
  return negative ? -value : value;
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
