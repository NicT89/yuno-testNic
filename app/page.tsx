export default function Home() {
  return (
    <main>
      <p className="brand">Yuno Tax Service</p>
      <h1>Tax calculation API</h1>
      <p className="lede">
        Versioned tax rules in SQLite, deterministic calculation, and country-level
        compliance reports for TiendaMax (BR, CO, AR, CL, PE).
      </p>

      <div className="note">
        Illustrative tax data. Not tax advice. Rates and thresholds were invented
        or approximated for demonstration; the mechanics (treatments, stacking,
        thresholds, CLP rounding, effective-dated versioning) are real. See the
        README &quot;About the tax data&quot; section.
      </div>

      <div className="links">
        <a className="primary" href="/api/health">
          Health check
        </a>
        <a href="/api/tax/rules?country=BR">BR tax rules</a>
        <a href="/api/tax/report?country=BR">BR compliance report</a>
        <a href="/api/transactions?country=BR">Sample transactions</a>
      </div>

      <h2>API endpoints</h2>
      <p>
        Full curl examples live in the README. Start with{" "}
        <code>POST /api/tax/calculate</code>, then{" "}
        <code>GET /api/audit/{"{transaction_id}"}</code> and{" "}
        <code>GET /api/tax/report?country=BR</code>.
      </p>

      <footer>
        Deliverable: API + seed data + architecture notes in the GitHub repo.
        Disclaimer: Illustrative tax data. Not tax advice.
      </footer>
    </main>
  );
}
