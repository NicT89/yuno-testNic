#!/usr/bin/env bash
# verify/smoke-test.sh — end-to-end API assertions for local or Vercel.
# Usage: ./verify/smoke-test.sh [BASE_URL]
# Requires: curl, and either jq or python3 for JSON parsing.
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
FAILS=0
PASSES=0

json_get() {
  # json_get <json> <python-expr using obj>
  local json="$1"
  local expr="$2"
  if command -v jq >/dev/null 2>&1; then
    # Prefer python for uniform path expressions below
    :
  fi
  python3 -c "import json,sys; obj=json.loads(sys.argv[1]); print($expr)" "$json"
}

pass() { echo "PASS  $1"; PASSES=$((PASSES + 1)); }
fail() { echo "FAIL  $1"; FAILS=$((FAILS + 1)); }

echo "Smoke testing against: $BASE_URL"
echo "============================================================"

# --- 1. Health ---
CODE=$(curl -s -o /tmp/yuno_health.json -w "%{http_code}" "$BASE_URL/api/health" || true)
if [[ "$CODE" == "200" ]]; then
  pass "1 GET /api/health -> 200"
else
  fail "1 GET /api/health -> expected 200 got ${CODE:-curl_error}"
fi

# --- 2. Calculate BR digital_services ---
CODE=$(curl -s -o /tmp/yuno_calc.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/tax/calculate" \
  -H "Content-Type: application/json" \
  -d '{"country_code":"BR","product_category":"digital_services","amount":199.99,"customer_type":"individual","currency":"BRL","transaction_date":"2026-03-15"}' \
  || true)
if [[ "$CODE" != "200" ]]; then
  fail "2 POST /api/tax/calculate BR digital_services -> expected 200 got $CODE body=$(head -c 200 /tmp/yuno_calc.json 2>/dev/null || true)"
  TXN_ID=""
else
  TXN_ID=$(python3 -c "import json; print(json.load(open('/tmp/yuno_calc.json')).get('transaction_id',''))" 2>/dev/null || true)
  LINES=$(python3 -c "import json; d=json.load(open('/tmp/yuno_calc.json')); print(len(d.get('taxLines') or []))" 2>/dev/null || echo 0)
  TAX=$(python3 -c "import json; d=json.load(open('/tmp/yuno_calc.json')); print(d.get('taxAmountMinor',0))" 2>/dev/null || echo 0)
  if [[ -n "$TXN_ID" && "$LINES" -ge 1 && "$TAX" != "0" ]]; then
    pass "2 POST /api/tax/calculate BR digital_services -> txn=$TXN_ID taxLines=$LINES taxAmountMinor=$TAX"
  else
    fail "2 POST /api/tax/calculate -> missing txn/taxLines/tax (txn=$TXN_ID lines=$LINES tax=$TAX)"
  fi
fi

# --- 3. Audit lookup (F-014 gate on Vercel) ---
if [[ -z "${TXN_ID:-}" ]]; then
  fail "3 GET /api/audit/{id} -> skipped (no transaction_id from step 2)"
else
  CODE=$(curl -s -o /tmp/yuno_audit.json -w "%{http_code}" "$BASE_URL/api/audit/$TXN_ID" || true)
  if [[ "$CODE" != "200" ]]; then
    fail "3 GET /api/audit/$TXN_ID -> expected 200 got $CODE  ** F-014 /tmp DB likely broken on serverless **"
  else
    HAS=$(python3 -c "import json; d=json.load(open('/tmp/yuno_audit.json')); print('yes' if d.get('transactionId') or d.get('transaction_id') else 'no')" 2>/dev/null || echo no)
    if [[ "$HAS" == "yes" ]]; then
      pass "3 GET /api/audit/$TXN_ID -> 200 non-empty (F-014 gate)"
    else
      fail "3 GET /api/audit/$TXN_ID -> 200 but empty/unexpected shape"
    fi
  fi
fi

# --- 4. Idempotent retry with explicit transaction_id (F-015) ---
IDEM="smoke_idem_$(date +%s)"
CODE1=$(curl -s -o /tmp/yuno_idem1.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/tax/calculate" \
  -H "Content-Type: application/json" \
  -d "{\"country_code\":\"CO\",\"product_category\":\"electronics\",\"amount\":50,\"currency\":\"COP\",\"transaction_id\":\"$IDEM\",\"transaction_date\":\"2026-02-01\"}" \
  || true)
CODE2=$(curl -s -o /tmp/yuno_idem2.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/tax/calculate" \
  -H "Content-Type: application/json" \
  -d "{\"country_code\":\"CO\",\"product_category\":\"electronics\",\"amount\":50,\"currency\":\"COP\",\"transaction_id\":\"$IDEM\",\"transaction_date\":\"2026-02-01\"}" \
  || true)
TAX1=$(python3 -c "import json; print(json.load(open('/tmp/yuno_idem1.json')).get('taxAmountMinor'))" 2>/dev/null || echo "")
TAX2=$(python3 -c "import json; print(json.load(open('/tmp/yuno_idem2.json')).get('taxAmountMinor'))" 2>/dev/null || echo "")
REPLAY=$(python3 -c "import json; print(json.load(open('/tmp/yuno_idem2.json')).get('replayed_from_idempotency_key'))" 2>/dev/null || echo "")
if [[ "$CODE1" == "200" && "$CODE2" == "200" && "$TAX1" == "$TAX2" && "$TAX1" != "" ]]; then
  pass "4 idempotent transaction_id=$IDEM both 200 identical tax=$TAX1 replayed=$REPLAY (F-015)"
else
  fail "4 idempotent retry -> codes=$CODE1/$CODE2 tax=$TAX1/$TAX2 (F-015 still broken if 500)"
fi

# --- 5. Date-based rule selection BR electronics ---
CODE_A=$(curl -s -o /tmp/yuno_br_a.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/tax/calculate" \
  -H "Content-Type: application/json" \
  -d '{"country_code":"BR","product_category":"electronics","amount":100,"currency":"BRL","transaction_date":"2025-11-15"}' \
  || true)
CODE_B=$(curl -s -o /tmp/yuno_br_b.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/tax/calculate" \
  -H "Content-Type: application/json" \
  -d '{"country_code":"BR","product_category":"electronics","amount":100,"currency":"BRL","transaction_date":"2026-03-15"}' \
  || true)
IDS_A=$(python3 -c "import json; d=json.load(open('/tmp/yuno_br_a.json')); print(','.join(d.get('breakdown',{}).get('appliedRuleVersionIds') or [x.get('ruleVersionId','') for x in d.get('taxLines',[])]))" 2>/dev/null || echo "")
IDS_B=$(python3 -c "import json; d=json.load(open('/tmp/yuno_br_b.json')); print(','.join(d.get('breakdown',{}).get('appliedRuleVersionIds') or [x.get('ruleVersionId','') for x in d.get('taxLines',[])]))" 2>/dev/null || echo "")
VER_A=$(python3 -c "import json; d=json.load(open('/tmp/yuno_br_a.json')); print(d.get('taxLines',[{}])[0].get('ruleVersion'))" 2>/dev/null || echo "")
VER_B=$(python3 -c "import json; d=json.load(open('/tmp/yuno_br_b.json')); print(d.get('taxLines',[{}])[0].get('ruleVersion'))" 2>/dev/null || echo "")
if [[ "$CODE_A" == "200" && "$CODE_B" == "200" && "$IDS_A" != "$IDS_B" ]]; then
  pass "5 BR electronics 2025-11-15 vs 2026-03-15 different rule versions ($IDS_A vs $IDS_B)"
elif [[ "$CODE_A" == "200" && "$CODE_B" == "200" && "$VER_A" != "$VER_B" ]]; then
  pass "5 BR electronics date split by ruleVersion ($VER_A vs $VER_B)"
else
  fail "5 date-based selection -> codes=$CODE_A/$CODE_B ids=$IDS_A/$IDS_B vers=$VER_A/$VER_B"
fi

# --- 6. Rules list ---
CODE=$(curl -s -o /tmp/yuno_rules.json -w "%{http_code}" "$BASE_URL/api/tax/rules?country=BR" || true)
COUNT=$(python3 -c "import json; d=json.load(open('/tmp/yuno_rules.json')); print(d.get('count') or len(d.get('rules') or []))" 2>/dev/null || echo 0)
if [[ "$CODE" == "200" && "$COUNT" -gt 0 ]]; then
  pass "6 GET /api/tax/rules?country=BR -> 200 count=$COUNT"
else
  fail "6 GET /api/tax/rules?country=BR -> code=$CODE count=$COUNT"
fi

# --- 7. Compliance report ---
CODE=$(curl -s -o /tmp/yuno_report.json -w "%{http_code}" \
  "$BASE_URL/api/tax/report?country=BR&from=2024-01-01&to=2027-01-01" || true)
if [[ "$CODE" != "200" ]]; then
  fail "7 GET /api/tax/report BR -> expected 200 got $CODE"
else
  python3 - <<'PY' && pass "7 GET /api/tax/report BR -> non-zero tax + edgeCases.refunds>0" || fail "7 report missing totalTaxCollectedMinor>0 or edgeCases.refunds>0 (reseed may be pending)"
import json
d=json.load(open("/tmp/yuno_report.json"))
tax=d.get("totals",{}).get("totalTaxCollectedMinor",0)
refunds=(d.get("edgeCases") or {}).get("refunds",0)
assert tax and int(tax)>0 and int(refunds)>0, (tax, refunds)
PY
fi

# --- 8. Bad payload -> structured 422 (or 400), never 500 ---
CODE=$(curl -s -o /tmp/yuno_bad.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/tax/calculate" \
  -H "Content-Type: application/json" \
  -d '{"country_code":"ZZ","product_category":"electronics","amount":10}' \
  || true)
ERR=$(python3 -c "import json; d=json.load(open('/tmp/yuno_bad.json')); print((d.get('error') or {}).get('code',''))" 2>/dev/null || echo "")
if [[ "$CODE" == "500" ]]; then
  fail "8 bad payload -> 500 (must be structured 4xx)"
elif [[ "$CODE" =~ ^4 && -n "$ERR" ]]; then
  pass "8 bad payload -> $CODE error.code=$ERR"
else
  fail "8 bad payload -> code=$CODE error=$ERR body=$(head -c 160 /tmp/yuno_bad.json 2>/dev/null || true)"
fi

echo "============================================================"
echo "Result: $PASSES passed, $FAILS failed"
if [[ "$FAILS" -gt 0 ]]; then
  exit 1
fi
exit 0
