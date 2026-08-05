-- =============================================================================
-- TiendaMax Tax Compliance Engine :: schema
--
-- DESIGN NOTE (the single most important idea in this codebase):
-- `tax_rule_versions` is APPEND-ONLY and BITEMPORAL. Rows are never UPDATEd
-- in a way that loses history and never DELETEd. Two independent time axes:
--
--   VALID TIME   (valid_from / valid_to)
--       "When was this rate the law?"  -> selected by the TRANSACTION date.
--       Answers Requirement 3: "the engine must use the correct rule based on
--       the transaction date."
--
--   SYSTEM TIME  (recorded_at / superseded_at)
--       "When did WE believe this rate?" -> selected by an `as_of` instant.
--       Answers Requirement 3: "if a reviewer changes a rule, old calculations
--       must still reference the rule version active at the time."
--
-- Collapsing these two axes into one `effective_date` column is the common
-- shortcut, and it makes the second half of Requirement 3 impossible to
-- satisfy. Hence two axes.
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Monotonic counter bumped every time the rule catalogue changes. Every audit
-- record pins the ruleset_version it was computed against, which makes any
-- historical calculation exactly replayable.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ruleset_versions (
  version      INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT    NOT NULL,          -- ISO-8601 UTC
  change_note  TEXT    NOT NULL
);

-- -----------------------------------------------------------------------------
-- Currency metadata. `exponent` is the number of minor units per major unit
-- expressed as a power of ten: BRL 2 => 1 BRL = 100 centavos.
-- CLP has exponent 0: there is no such thing as a fractional Chilean peso, so
-- rounding must happen at the whole-peso level or every total is wrong.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS currencies (
  code      TEXT PRIMARY KEY,             -- BRL, COP, ARS, CLP, PEN, USD
  exponent  INTEGER NOT NULL,
  name      TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- Country configuration: default currency + rounding strategy.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countries (
  code             TEXT PRIMARY KEY,      -- ISO 3166-1 alpha-2
  name             TEXT NOT NULL,
  default_currency TEXT NOT NULL REFERENCES currencies(code),
  rounding_mode    TEXT NOT NULL DEFAULT 'HALF_UP'  -- HALF_UP | HALF_EVEN | DOWN
);

-- -----------------------------------------------------------------------------
-- THE RULE TABLE. Append-only.
--
-- rule_key is the STABLE IDENTITY of a rule across versions
--   e.g. "BR:ELECTRONICS:ICMS" has versions 1, 2, 3...
-- id is the identity of one immutable VERSION
--   e.g. "BR:ELECTRONICS:ICMS@v2"  <- this is what audit records point at.
--
-- Multiple rows may apply to one transaction (multi-tax stacking): Brazil
-- applies ICMS (state) plus ISS (municipal) to digital services. `priority`
-- orders the stack and `compound_on_previous` decides whether a tax is levied
-- on the base amount or on (base + previously accumulated tax).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rule_versions (
  id                    TEXT    PRIMARY KEY,   -- "<rule_key>@v<version>"
  rule_key              TEXT    NOT NULL,
  version               INTEGER NOT NULL,

  country_code          TEXT    NOT NULL REFERENCES countries(code),
  product_category      TEXT    NOT NULL,      -- '*' = wildcard / country default
  customer_type         TEXT    NOT NULL DEFAULT '*',  -- '*' | 'individual' | 'business'

  tax_type              TEXT    NOT NULL,      -- VAT | IVA | ICMS | ISS | IGV | CBS ...
  tax_scope             TEXT    NOT NULL DEFAULT 'national', -- national|state|municipal
  rate_bps              INTEGER NOT NULL,      -- BASIS POINTS. 1900 = 19.00%
  treatment             TEXT    NOT NULL DEFAULT 'standard',
      -- standard        : charge rate_bps
      -- reduced         : charge rate_bps (documentation flavour of standard)
      -- exempt          : 0%, exemption is the rule itself
      -- zero_rated      : 0%, but transaction is in-scope for reporting
      -- reverse_charge  : 0% collected; liability shifts to the B2B buyer

  -- Below this amount (in minor units) the rule does not apply at all.
  threshold_minor       INTEGER NOT NULL DEFAULT 0,
  -- 'gross' = tax the pre-discount amount, 'net' = tax the post-discount amount.
  taxable_base          TEXT    NOT NULL DEFAULT 'net',
  priority              INTEGER NOT NULL DEFAULT 100,
  compound_on_previous  INTEGER NOT NULL DEFAULT 0,   -- 0/1 boolean

  -- ---- VALID TIME: when the rule is/was the law -----------------------------
  valid_from            TEXT    NOT NULL,      -- ISO-8601 date (inclusive)
  valid_to              TEXT,                  -- ISO-8601 date (exclusive), NULL = open

  -- ---- SYSTEM TIME: when we recorded / replaced this belief -----------------
  recorded_at           TEXT    NOT NULL,      -- ISO-8601 UTC (inclusive)
  superseded_at         TEXT,                  -- ISO-8601 UTC (exclusive), NULL = current

  ruleset_version       INTEGER NOT NULL REFERENCES ruleset_versions(version),
  legal_reference       TEXT,                  -- citation for the auditor
  notes                 TEXT,

  UNIQUE (rule_key, version)
);

CREATE INDEX IF NOT EXISTS idx_rules_lookup
  ON tax_rule_versions (country_code, product_category, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_rules_systime
  ON tax_rule_versions (recorded_at, superseded_at);
CREATE INDEX IF NOT EXISTS idx_rules_key
  ON tax_rule_versions (rule_key, version);

-- -----------------------------------------------------------------------------
-- IMMUTABLE AUDIT TRAIL. One row per calculation request, always written, even
-- for rejected input (status = 'error'). A compliance log that silently drops
-- events is a broken compliance log.
--
-- `applied_rules_snapshot` denormalises the exact rules used. The FK-ish
-- `applied_rule_version_ids` proves provenance; the snapshot makes the record
-- self-contained and readable by an auditor with no access to this database.
-- Same pattern Stripe uses when it snapshots line items onto an invoice.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_calculation_audit (
  transaction_id            TEXT PRIMARY KEY,
  created_at                TEXT NOT NULL,     -- ISO-8601 UTC, when we computed
  transaction_date          TEXT NOT NULL,     -- ISO-8601 UTC, when the sale happened

  -- ---- inputs, stored verbatim ---------------------------------------------
  input_amount_minor        INTEGER NOT NULL,
  input_discount_minor      INTEGER NOT NULL DEFAULT 0,
  input_currency            TEXT    NOT NULL,
  input_country_code        TEXT    NOT NULL,
  input_product_category    TEXT    NOT NULL,
  input_customer_type       TEXT    NOT NULL,
  input_price_includes_tax  INTEGER NOT NULL DEFAULT 0,
  input_payload_json        TEXT    NOT NULL,  -- full raw request body

  -- ---- outputs --------------------------------------------------------------
  status                    TEXT    NOT NULL,  -- calculated | exempt | error | refund
  base_amount_minor         INTEGER NOT NULL DEFAULT 0,
  tax_amount_minor          INTEGER NOT NULL DEFAULT 0,
  total_amount_minor        INTEGER NOT NULL DEFAULT 0,
  effective_rate_bps        INTEGER NOT NULL DEFAULT 0,
  output_payload_json       TEXT    NOT NULL,  -- full response body
  error_code                TEXT,
  error_message             TEXT,

  -- ---- provenance -----------------------------------------------------------
  ruleset_version           INTEGER NOT NULL,
  applied_rule_version_ids  TEXT    NOT NULL,  -- JSON array of tax_rule_versions.id
  applied_rules_snapshot    TEXT    NOT NULL,  -- JSON array of full rule objects
  engine_version            TEXT    NOT NULL,
  calculation_fingerprint   TEXT    NOT NULL,  -- sha256(canonical inputs + ruleset)
  idempotency_key           TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_country_date
  ON tax_calculation_audit (input_country_code, transaction_date);
CREATE INDEX IF NOT EXISTS idx_audit_fingerprint
  ON tax_calculation_audit (calculation_fingerprint);
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_idem
  ON tax_calculation_audit (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Enforce immutability of the audit trail at the database level. An auditor
-- should not have to take our word for it.
CREATE TRIGGER IF NOT EXISTS trg_audit_no_update
BEFORE UPDATE ON tax_calculation_audit
BEGIN
  SELECT RAISE(ABORT, 'tax_calculation_audit is append-only: updates are forbidden');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_no_delete
BEFORE DELETE ON tax_calculation_audit
BEGIN
  SELECT RAISE(ABORT, 'tax_calculation_audit is append-only: deletes are forbidden');
END;

-- Same guarantee for rule versions: you may INSERT a new version, and you may
-- only ever stamp a previously-null superseded_at. Every other column is part
-- of the immutable version snapshot.
CREATE TRIGGER IF NOT EXISTS trg_rules_append_only
BEFORE UPDATE ON tax_rule_versions
WHEN
     NEW.id                   IS NOT OLD.id
  OR NEW.rule_key             IS NOT OLD.rule_key
  OR NEW.version              IS NOT OLD.version
  OR NEW.country_code         IS NOT OLD.country_code
  OR NEW.product_category     IS NOT OLD.product_category
  OR NEW.customer_type        IS NOT OLD.customer_type
  OR NEW.tax_type             IS NOT OLD.tax_type
  OR NEW.tax_scope            IS NOT OLD.tax_scope
  OR NEW.rate_bps             IS NOT OLD.rate_bps
  OR NEW.treatment            IS NOT OLD.treatment
  OR NEW.threshold_minor      IS NOT OLD.threshold_minor
  OR NEW.taxable_base         IS NOT OLD.taxable_base
  OR NEW.priority             IS NOT OLD.priority
  OR NEW.compound_on_previous IS NOT OLD.compound_on_previous
  OR NEW.valid_from           IS NOT OLD.valid_from
  OR NEW.valid_to             IS NOT OLD.valid_to
  OR NEW.recorded_at          IS NOT OLD.recorded_at
  OR NEW.ruleset_version      IS NOT OLD.ruleset_version
  OR NEW.legal_reference      IS NOT OLD.legal_reference
  OR NEW.notes                IS NOT OLD.notes
  OR OLD.superseded_at IS NOT NULL
  OR NEW.superseded_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'tax_rule_versions is append-only: create a new version instead');
END;

CREATE TRIGGER IF NOT EXISTS trg_rules_no_delete
BEFORE DELETE ON tax_rule_versions
BEGIN
  SELECT RAISE(ABORT, 'tax_rule_versions is append-only: supersede instead of deleting');
END;
