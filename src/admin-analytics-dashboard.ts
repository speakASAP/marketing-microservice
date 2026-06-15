import { AdminUserSession } from "./admin-auth";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderAdminAnalyticsDashboard(session: AdminUserSession): string {
  const label = escapeHtml(session.user.email ?? session.user.id ?? "Marketing admin");
  const accessLevel = escapeHtml(session.accessLevel);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Marketing Analytics</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; color: #172026; background: #f6f8fb; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 248px 1fr; }
    nav { background: #172026; color: #f8fafc; padding: 24px 18px; }
    nav h1 { margin: 0 0 24px; font-size: 18px; font-weight: 700; letter-spacing: 0; }
    nav a { display: block; color: #d9e2ec; text-decoration: none; padding: 10px 12px; border-radius: 6px; margin: 2px 0; font-size: 14px; }
    nav a[aria-current="page"] { background: #2f7d68; color: white; }
    main { padding: 32px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    h2 { margin: 0; font-size: 24px; letter-spacing: 0; }
    .identity { color: #536471; font-size: 14px; text-align: right; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 18px; }
    .toolbar input, .toolbar textarea { border: 1px solid #cfd9e3; border-radius: 6px; padding: 9px 10px; font: inherit; background: white; }
    .toolbar textarea { min-width: min(720px, 100%); min-height: 46px; resize: vertical; }
    button, .button { border: 0; border-radius: 6px; background: #2f7d68; color: white; padding: 10px 13px; font: inherit; cursor: pointer; text-decoration: none; }
    .button.secondary { background: #34495e; }
    .grid { display: grid; gap: 14px; grid-template-columns: repeat(6, minmax(120px, 1fr)); margin-bottom: 18px; }
    .metric { background: white; border: 1px solid #d8e0e8; border-radius: 8px; padding: 14px; min-height: 74px; }
    .metric span { display: block; color: #607080; font-size: 12px; }
    .metric strong { display: block; font-size: 24px; margin-top: 8px; letter-spacing: 0; }
    .panel { background: white; border: 1px solid #d8e0e8; border-radius: 8px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e4ebf2; padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: #eef3f7; color: #34495e; font-weight: 700; }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #667788; }
    .bar { background: #e7eef5; border-radius: 999px; height: 7px; overflow: hidden; min-width: 80px; }
    .bar > i { display: block; height: 100%; background: #2f7d68; }
    .status { min-height: 22px; color: #536471; font-size: 13px; margin-bottom: 12px; }
    @media (max-width: 980px) { .shell { grid-template-columns: 1fr; } nav { padding: 16px; } main { padding: 20px; } header { align-items: flex-start; flex-direction: column; } .identity { text-align: left; } .grid { grid-template-columns: repeat(2, minmax(120px, 1fr)); } .panel { overflow-x: auto; } }
  </style>
</head>
<body>
  <div class="shell">
    <nav aria-label="Admin navigation">
      <h1>Marketing Admin</h1>
      <a href="/admin">Overview</a>
      <a href="/admin/campaigns">Campaigns</a>
      <a href="/admin/segments">Segments</a>
      <a href="/admin/journeys">Journeys</a>
      <a href="/admin/runs">Runs</a>
      <a href="/admin/audit">Audit</a>
      <a href="/admin/analytics" aria-current="page">Analytics</a>
      <a href="/admin/settings">Settings</a>
    </nav>
    <main>
      <header>
        <h2>Campaign analytics</h2>
        <div class="identity">${label}<br>${accessLevel}</div>
      </header>
      <section class="toolbar" aria-label="Analytics filters">
        <input id="tenantId" placeholder="tenantId">
        <input id="appId" placeholder="appId">
        <input id="campaignId" placeholder="campaignId">
        <textarea id="externalFacts" placeholder="externalAttributionFacts JSON"></textarea>
        <button id="applyFacts" type="button">Apply</button>
        <a class="button secondary" href="/admin/api/analytics/export.csv">CSV</a>
      </section>
      <div id="status" class="status"></div>
      <section class="grid" aria-label="Analytics totals">
        <div class="metric"><span>Sent</span><strong id="sent">0</strong></div>
        <div class="metric"><span>Skipped</span><strong id="skipped">0</strong></div>
        <div class="metric"><span>Failed</span><strong id="failed">0</strong></div>
        <div class="metric"><span>Delivered</span><strong id="delivered">-</strong></div>
        <div class="metric"><span>Converted</span><strong id="converted">-</strong></div>
        <div class="metric"><span>Attributed value</span><strong id="value">-</strong></div>
      </section>
      <section class="panel" aria-label="Campaign analytics summary">
        <table>
          <thead><tr><th>Campaign</th><th>Scope</th><th class="number">Sent</th><th class="number">Skipped</th><th class="number">Failed</th><th class="number">Delivered</th><th class="number">Converted</th><th class="number">Value</th><th>Source</th></tr></thead>
          <tbody id="rows"><tr><td colspan="9" class="muted">Loading</td></tr></tbody>
        </table>
      </section>
    </main>
  </div>
  <script>
    const statusEl = document.getElementById("status");
    const rowsEl = document.getElementById("rows");
    const numberFmt = (value) => value === null || value === undefined ? "-" : Number(value).toLocaleString("en-US");
    const html = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
    function query() {
      const params = new URLSearchParams();
      for (const id of ["tenantId", "appId", "campaignId"]) {
        const value = document.getElementById(id).value.trim();
        if (value) params.set(id, value);
      }
      return params.toString() ? "?" + params.toString() : "";
    }
    async function load(applyFacts) {
      statusEl.textContent = "";
      const bodyText = document.getElementById("externalFacts").value.trim();
      const options = applyFacts && bodyText ? { method: "POST", headers: { "content-type": "application/json" }, body: bodyText } : {};
      const response = await fetch("/admin/api/analytics/summary" + query(), options);
      if (!response.ok) {
        statusEl.textContent = "Analytics summary unavailable";
        return;
      }
      const model = await response.json();
      document.getElementById("sent").textContent = numberFmt(model.summary.totals.sent);
      document.getElementById("skipped").textContent = numberFmt(model.summary.totals.skipped);
      document.getElementById("failed").textContent = numberFmt(model.summary.totals.failed);
      document.getElementById("delivered").textContent = numberFmt(model.summary.externalAttribution.delivered);
      document.getElementById("converted").textContent = numberFmt(model.summary.externalAttribution.converted);
      document.getElementById("value").textContent = numberFmt(model.summary.externalAttribution.attributedValue);
      statusEl.textContent = model.warnings.includes("external_analytics_required") ? "External delivery, conversion, and value facts required" : "External attribution facts applied";
      const max = Math.max(1, ...model.rows.map((row) => row.totalRecipients));
      rowsEl.innerHTML = model.rows.length === 0
        ? '<tr><td colspan="9" class="muted">No campaign facts</td></tr>'
        : model.rows.map((row) => {
            const pct = Math.round((row.totalRecipients / max) * 100);
            const value = row.attributedValue === null ? "-" : numberFmt(row.attributedValue) + (row.currency ? " " + html(row.currency) : "");
            return '<tr><td><strong>' + html(row.name) + '</strong><br><span class="muted">' + html(row.campaignId) + '</span><div class="bar"><i style="width:' + pct + '%"></i></div></td><td>' + html(row.tenantId) + '<br><span class="muted">' + html(row.appId) + ' / ' + html(row.lifecycleStage || "uncategorized") + '</span></td><td class="number">' + numberFmt(row.sent) + '</td><td class="number">' + numberFmt(row.skipped) + '</td><td class="number">' + numberFmt(row.failed) + '</td><td class="number">' + numberFmt(row.delivered) + '</td><td class="number">' + numberFmt(row.converted) + '</td><td class="number">' + value + '</td><td><span class="muted">' + html(row.deliverySource) + '<br>' + html(row.conversionSource) + '</span></td></tr>';
          }).join("");
    }
    document.getElementById("applyFacts").addEventListener("click", () => load(true));
    for (const id of ["tenantId", "appId", "campaignId"]) document.getElementById(id).addEventListener("change", () => load(false));
    load(false);
  </script>
</body>
</html>`;
}
