# Demo output

Verbatim output of `npm run demo` on a clean database. All three core requirements demonstrated end to end.

```

==============================================================================
STEP 1  Seeding rules and fixture transactions
==============================================================================
  29 tax rule versions loaded (ruleset v1)
  56 fixture transactions calculated and audited

==============================================================================
STEP 2  Tax calculation matrix (Requirement 1) - 24 combinations
==============================================================================
CC  CATEGORY          CUSTOMER              BASE          TAX          TOTAL     RATE  RULES
----------------------------------------------------------------------------------------------------------------------
BR  electronics       individual       100.00 BRL        18.00         118.00   18.00%  ICMS 18.00%
BR  food              individual       100.00 BRL         7.00         107.00    7.00%  ICMS 7.00%
BR  books             individual       100.00 BRL         0.00         100.00    0.00%  ICMS 0.00%
BR  clothing          individual       100.00 BRL        17.00         117.00   17.00%  ICMS 17.00%
BR  digital_services  individual       100.00 BRL        22.00         122.00   22.00%  ICMS 17.00% + ISS 5.00%
CO  electronics       individual       100.00 COP        19.00         119.00   19.00%  IVA 19.00%
CO  food              individual       100.00 COP         5.00         105.00    5.00%  IVA 5.00%
CO  books             individual       100.00 COP         0.00         100.00    0.00%  IVA 0.00%
CO  clothing          individual       100.00 COP         0.00         100.00    0.00%  IVA 0.00%
CO  digital_services  individual       100.00 COP        19.00         119.00   19.00%  IVA 19.00%
AR  electronics       individual       100.00 ARS        21.00         121.00   21.00%  IVA 21.00%
AR  food              individual       100.00 ARS        10.50         110.50   10.50%  IVA 10.50%
AR  books             individual       100.00 ARS         0.00         100.00    0.00%  IVA 0.00%
AR  clothing          individual       100.00 ARS        21.00         121.00   21.00%  IVA 21.00%
AR  digital_services  individual       100.00 ARS        29.00         129.00   29.00%  PAIS 8.00% + IVA 21.00%
CL  electronics       individual       100000 CLP        19000         119000   19.00%  IVA 19.00%
CL  food              individual       100000 CLP        19000         119000   19.00%  IVA 19.00%
CL  books             individual       100000 CLP        19000         119000   19.00%  IVA 19.00%
CL  clothing          individual       100000 CLP        19000         119000   19.00%  IVA 19.00%
CL  digital_services  individual       100000 CLP        19000         119000   19.00%  IVA 19.00%
PE  electronics       individual       100.00 PEN        18.00         118.00   18.00%  IGV 18.00%
PE  food              individual       100.00 PEN         0.00         100.00    0.00%  IGV 0.00%
PE  books             individual       100.00 PEN         0.00         100.00    0.00%  IGV 0.00%
PE  clothing          individual       100.00 PEN        18.00         118.00   18.00%  IGV 18.00%
PE  digital_services  individual       100.00 PEN        18.00         118.00   18.00%  IGV 18.00%
----------------------------------------------------------------------------------------------------------------------
B2B comparison (Argentina reverse charge):
AR  digital_services  individual     10000.00 ARS      2900.00       12900.00   29.00%  PAIS 8.00% + IVA 21.00%
AR  digital_services  business       10000.00 ARS         0.00       10000.00    0.00%  IVA 0.00%

==============================================================================
STEP 3  Edge cases (Requirement 1)
==============================================================================
  zero amount             status=zero_amount  base=      0.00 tax=      0.00 total=        0.00 BRL
  refund (negative)       status=refund       base=   -100.00 tax=    -18.00 total=     -118.00 BRL
  below CO threshold      status=exempt       base=   9999.99 tax=      0.00 total=     9999.99 COP
  exactly AT threshold    status=calculated   base=  10000.00 tax=   1900.00 total=    11900.00 COP
  just above threshold    status=calculated   base=  10000.01 tax=   1900.00 total=    11900.01 COP
  CLP 7 (no minor unit)   status=calculated   base=         7 tax=         1 total=           8 CLP
  unknown category        -> BR has a country-wide wildcard rule, so 'gift_cards' resolves to BR:*:ICMS @17% rather than failing.
  no rule on file         -> rejected: No tax rule is on file for PE/electronics/individual effective 2005-01-01T00:00:00.000Z. Refusing to assume 0%...

==============================================================================
STEP 4  Idempotency (Requirement 1)
==============================================================================
  call #1 tax = 23456.79 COP  txn txn_1fb68269-4889-4b46-8939-af7cc30a1e8a
  call #2 tax = 23456.79 COP  txn txn_e2f4f912-4824-4527-bb75-1bb1a3822709
  identical result: true
  distinct audit records (a compliance log never drops events): true
  matching fingerprints: true

==============================================================================
STEP 5  Date-based rule selection (Requirement 3)
==============================================================================
  BRL 1000.00 electronics on 2025-12-31 -> BR:ELECTRONICS:ICMS@v1  tax 170.00 (17.00%)
  BRL 1000.00 electronics on 2026-01-02 -> BR:ELECTRONICS:ICMS@v2  tax 180.00 (18.00%)
  Same inputs, different transaction date, correct rule version selected automatically.

==============================================================================
STEP 6  Rule change + historical immutability (Requirement 3)
==============================================================================
  BEFORE  CLP 100,000 electronics -> CL:*:IVA@v1 @ 19.00% = 19000 CLP
  >>> Reviewer publishes a new version of CL:*:IVA at 21% <<<
  AFTER   CLP 100,000 electronics -> CL:*:IVA@v2 @ 21.00% = 21000 CLP

  Historical audit record demo_cl_before is UNCHANGED:
    tax_amount            = 19000 CLP
    applied_rule_versions = ["CL:*:IVA@v1"]
    ruleset_version       = 1
    snapshot rate         = 19%
  Version lineage of CL:*:IVA: CL:*:IVA@v1@19% -> CL:*:IVA@v2@21%
  Database rejects audit mutation: "tax_calculation_audit is append-only: updates are forbidden"

==============================================================================
STEP 7  Compliance report (Requirement 2)
==============================================================================
  BR   24 txns  tax collected          1356.87 BRL  avg rate 18.04%  edge: 2 refunds, 2 zero, 3 exempt, 0 errors
  CO   21 txns  tax collected        300237.98 COP  avg rate 17.51%  edge: 1 refunds, 0 zero, 6 exempt, 0 errors
  AR   18 txns  tax collected         32227.99 ARS  avg rate 18.17%  edge: 1 refunds, 1 zero, 4 exempt, 0 errors
  CL   17 txns  tax collected           387983 CLP  avg rate 19.10%  edge: 1 refunds, 1 zero, 0 exempt, 0 errors
  PE   15 txns  tax collected          3004.20 PEN  avg rate 17.34%  edge: 1 refunds, 0 zero, 5 exempt, 0 errors

  Brazil breakdown by category:
    electronics         12 txns  base      4899.90  tax     870.98  17.78%
    digital_services     3 txns  base      1799.99  tax     396.00  22.00%
    clothing             2 txns  base       420.00  tax      71.40  17.00%
    food                 3 txns  base       154.40  tax      10.81  7.00%
    medicine             1 txns  base        64.00  tax       7.68  12.00%
    education            1 txns  base         5.00  tax       0.00  0.00%
    books                2 txns  base       179.00  tax       0.00  0.00%

  Brazil breakdown by tax type (proves multi-tax stacking is reported separately):
    ICMS      22 lines       1266.87 BRL
    ISS        3 lines         90.00 BRL

Reports written to ./out/compliance-report-{BR,CO,AR,CL,PE}.json
Start the API with `npm start` and see README.md for curl examples.

```
