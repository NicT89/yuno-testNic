export default function Home() {
  return (
    <main>
      <p className="brand">Yuno Tax Service</p>
      <h1>Tax calculation API</h1>
      <p className="lede">
        Versioned tax rules in SQLite, deterministic calculation (exclusive &amp;
        inclusive), and country-level compliance reports. Next.js API on Vercel.
      </p>

      <div className="links">
        <a className="primary" href="/api/health">
          Health check
        </a>
        <a href="/api/tax/rules?country=MX">MX tax rules</a>
        <a href="/api/tax/report?country=MX&format=text">MX compliance report</a>
        <a href="/api/transactions">Sample transactions</a>
      </div>

      <div className="note">
        Amounts are integer minor units (cents). MXN 1,000.00 ={" "}
        <code>100000</code>. See the README for full setup and architecture notes.
      </div>

      <h2>API endpoints</h2>

      <h3>POST /api/tax/calculate</h3>
      <p>Calculate tax for a single line item.</p>
      <pre>{`curl -s -X POST https://YOUR_DEPLOY_URL/api/tax/calculate \\
  -H "Content-Type: application/json" \\
  -d '{
    "country": "MX",
    "category": "standard",
    "amount": 100000,
    "amountMode": "exclusive",
    "currency": "MXN",
    "transactionDate": "2025-03-15"
  }'`}</pre>

      <h3>GET /api/tax/rules</h3>
      <p>
        List versioned rules. Filter with <code>?country=MX</code> or view history
        with <code>?id=mx-iva-digital</code>.
      </p>
      <pre>{`curl -s "https://YOUR_DEPLOY_URL/api/tax/rules?country=MX"`}</pre>

      <h3>GET /api/tax/report</h3>
      <p>
        Aggregated compliance report. Formats: <code>json</code> (default),{" "}
        <code>text</code>, <code>csv</code>.
      </p>
      <pre>{`curl -s "https://YOUR_DEPLOY_URL/api/tax/report?country=MX&format=text"`}</pre>

      <h3>GET /api/transactions</h3>
      <p>Sample transactions used for development and reporting.</p>
      <pre>{`curl -s "https://YOUR_DEPLOY_URL/api/transactions?country=MX"`}</pre>

      <h2>Supported countries (fixtures)</h2>
      <ul>
        <li>
          <strong>MX</strong> — IVA 16% standard, zero-rated food, digital services
          (versioned), exempt
        </li>
        <li>
          <strong>US</strong> — CA / NY regional sales tax + category exemptions
        </li>
        <li>
          <strong>CO</strong> — IVA 19% standard, 5% reduced, exempt
        </li>
      </ul>

      <footer>
        Source, README, and architecture decisions are in the GitHub repository.
        Rates are illustrative simplifications for this take-home — not production
        tax advice.
      </footer>
    </main>
  );
}
