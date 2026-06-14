import { AdminUserSession, hasAdminAccessLevel } from "./admin-auth";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type AdminConsolePage = "campaigns" | "segments";

function renderConsolePage(session: AdminUserSession, page: AdminConsolePage): string {
  const label = escapeHtml(session.user.email ?? session.user.id ?? "Marketing admin");
  const accessLevel = escapeHtml(session.accessLevel);
  const canDryRun = hasAdminAccessLevel(session.accessLevel, "operator");
  const canApprove = hasAdminAccessLevel(session.accessLevel, "admin");
  const title = page === "campaigns" ? "Campaigns" : "Segments";
  const activeCampaigns = page === "campaigns" ? " aria-current=\"page\"" : "";
  const activeSegments = page === "segments" ? " aria-current=\"page\"" : "";
  const content = page === "campaigns" ? campaignContent(canDryRun, canApprove) : segmentContent();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Marketing Admin - ${title}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; color: #172026; background: #f6f8fb; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 248px 1fr; }
    nav { background: #172026; color: #f8fafc; padding: 24px 18px; }
    nav h1 { margin: 0 0 24px; font-size: 18px; font-weight: 700; letter-spacing: 0; }
    nav a { display: block; color: #d9e2ec; text-decoration: none; padding: 10px 12px; border-radius: 6px; margin: 2px 0; font-size: 14px; }
    nav a[aria-current="page"] { background: #2f7d68; color: white; }
    main { padding: 32px; min-width: 0; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    h2 { margin: 0; font-size: 24px; letter-spacing: 0; }
    .identity { color: #536471; font-size: 14px; text-align: right; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .status { color: #536471; font-size: 14px; }
    .table-wrap { overflow-x: auto; border: 1px solid #d8e0e8; border-radius: 8px; background: white; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { padding: 12px 14px; border-bottom: 1px solid #e7edf3; text-align: left; vertical-align: top; font-size: 14px; }
    th { color: #536471; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; background: #fbfcfe; }
    tr:last-child td { border-bottom: 0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 12px; color: #334155; }
    .pill { display: inline-flex; align-items: center; min-height: 22px; padding: 0 8px; border-radius: 999px; background: #e7edf3; color: #172026; font-size: 12px; white-space: nowrap; }
    .pill.approved { background: #dff4ea; color: #17624f; }
    .pill.pending { background: #fff1d6; color: #73510d; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    button { border: 1px solid #b9c6d3; background: white; color: #172026; border-radius: 6px; min-height: 34px; padding: 0 10px; font: inherit; font-size: 13px; cursor: pointer; }
    button.primary { border-color: #2f7d68; background: #2f7d68; color: white; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    pre { margin: 16px 0 0; max-width: 960px; overflow: auto; border: 1px solid #d8e0e8; border-radius: 8px; background: #101820; color: #edf6f9; padding: 14px; font-size: 12px; line-height: 1.5; }
    @media (max-width: 760px) { .shell { grid-template-columns: 1fr; } nav { padding: 16px; } main { padding: 20px; } header { align-items: flex-start; flex-direction: column; } .identity { text-align: left; } .toolbar { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <div class="shell">
    <nav aria-label="Admin navigation">
      <h1>Marketing Admin</h1>
      <a href="/admin">Overview</a>
      <a href="/admin/campaigns"${activeCampaigns}>Campaigns</a>
      <a href="/admin/segments"${activeSegments}>Segments</a>
      <a href="/admin/journeys">Journeys</a>
      <a href="/admin/runs">Runs</a>
      <a href="/admin/audit">Audit</a>
      <a href="/admin/settings">Settings</a>
    </nav>
    <main data-page="${page}" data-can-dry-run="${canDryRun}" data-can-approve="${canApprove}">
      <header>
        <h2>${title}</h2>
        <div class="identity">${label}<br>${accessLevel}</div>
      </header>
      ${content}
    </main>
  </div>
</body>
</html>`;
}

function campaignContent(canDryRun: boolean, canApprove: boolean): string {
  return `<section aria-labelledby="campaigns-table-title">
    <div class="toolbar">
      <h3 id="campaigns-table-title">Campaign definitions</h3>
      <span class="status" id="campaigns-status">Loading</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Scope</th><th>Segment</th><th>Status</th><th>Approval</th><th>Channel</th><th>Actions</th></tr></thead>
        <tbody id="campaigns-body"></tbody>
      </table>
    </div>
    <pre id="campaign-result" hidden></pre>
  </section>
  <script>
    const state = { canDryRun: ${JSON.stringify(canDryRun)}, canApprove: ${JSON.stringify(canApprove)}, segments: new Map() };
    const text = (value) => value == null || value === "" ? "-" : String(value);
    const esc = (value) => text(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    const pill = (value) => '<span class="pill ' + esc(value) + '">' + esc(value) + '</span>';
    async function api(path, options) {
      const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || response.statusText);
      return body;
    }
    function renderRows(campaigns) {
      const body = document.getElementById("campaigns-body");
      body.innerHTML = campaigns.map((campaign) => {
        const segment = state.segments.get(campaign.segmentId);
        const approveDisabled = !state.canApprove || campaign.approvalStatus === "approved";
        const dryRunDisabled = !state.canDryRun;
        return '<tr>' +
          '<td><strong>' + esc(campaign.name) + '</strong><br><code>' + esc(campaign.campaignId) + '</code></td>' +
          '<td>' + esc(campaign.tenantId) + ' / ' + esc(campaign.appId) + '<br>' + esc(campaign.brandId) + '</td>' +
          '<td>' + esc(segment?.name || campaign.segmentId) + '</td>' +
          '<td>' + pill(campaign.status) + '</td>' +
          '<td>' + pill(campaign.approvalStatus) + '</td>' +
          '<td>' + esc(campaign.primaryChannel) + '<br><code>' + esc(campaign.channelKey || "default") + '</code></td>' +
          '<td><div class="actions"><button class="primary" data-action="dry-run" data-id="' + esc(campaign.campaignId) + '" ' + (dryRunDisabled ? 'disabled' : '') + '>Dry run</button><button data-action="approve" data-id="' + esc(campaign.campaignId) + '" ' + (approveDisabled ? 'disabled' : '') + '>Approve</button></div></td>' +
        '</tr>';
      }).join("") || '<tr><td colspan="7">No campaigns found.</td></tr>';
    }
    async function load() {
      const [segments, campaigns] = await Promise.all([api("/admin/api/segments"), api("/admin/api/campaigns")]);
      state.segments = new Map(segments.map((segment) => [segment.segmentId, segment]));
      renderRows(campaigns);
      document.getElementById("campaigns-status").textContent = campaigns.length + " campaigns";
    }
    async function runAction(action, id) {
      const result = document.getElementById("campaign-result");
      result.hidden = false;
      result.textContent = "Working";
      try {
        const body = action === "approve"
          ? await api('/admin/api/campaigns/' + encodeURIComponent(id) + '/approve', { method: "POST", body: JSON.stringify({ approvalNote: "Approved from Marketing admin console" }) })
          : await api('/admin/api/campaigns/' + encodeURIComponent(id) + '/dry-run', { method: "POST", body: JSON.stringify({ idempotencyKey: 'admin-console-' + id + '-' + Date.now() }) });
        result.textContent = JSON.stringify(body, null, 2);
        await load();
      } catch (error) {
        result.textContent = JSON.stringify({ error: error.message }, null, 2);
      }
    }
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      runAction(button.dataset.action, button.dataset.id);
    });
    load().catch((error) => { document.getElementById("campaigns-status").textContent = error.message; });
  </script>`;
}

function segmentContent(): string {
  return `<section aria-labelledby="segments-table-title">
    <div class="toolbar">
      <h3 id="segments-table-title">Segment definitions</h3>
      <span class="status" id="segments-status">Loading</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Scope</th><th>Sources</th><th>Mode</th><th>Estimated</th><th>Rules</th></tr></thead>
        <tbody id="segments-body"></tbody>
      </table>
    </div>
  </section>
  <script>
    const text = (value) => value == null || value === "" ? "-" : String(value);
    const esc = (value) => text(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    async function load() {
      const response = await fetch("/admin/api/segments");
      const segments = await response.json();
      if (!response.ok) throw new Error(segments.error || response.statusText);
      document.getElementById("segments-body").innerHTML = segments.map((segment) => '<tr>' +
        '<td><strong>' + esc(segment.name) + '</strong><br><code>' + esc(segment.segmentId) + '</code></td>' +
        '<td>' + esc(segment.tenantId) + ' / ' + esc(segment.appId) + '<br>' + esc(segment.brandId) + '</td>' +
        '<td>' + esc((segment.sourceTypes || []).join(", ")) + '</td>' +
        '<td>' + (segment.isDynamic ? 'Dynamic' : 'Static') + '</td>' +
        '<td>' + esc(segment.estimatedCount) + '</td>' +
        '<td><code>' + esc(JSON.stringify(segment.rules || {})) + '</code></td>' +
      '</tr>').join("") || '<tr><td colspan="6">No segments found.</td></tr>';
      document.getElementById("segments-status").textContent = segments.length + " segments";
    }
    load().catch((error) => { document.getElementById("segments-status").textContent = error.message; });
  </script>`;
}

export function renderAdminCampaignsConsole(session: AdminUserSession): string {
  return renderConsolePage(session, "campaigns");
}

export function renderAdminSegmentsConsole(session: AdminUserSession): string {
  return renderConsolePage(session, "segments");
}
