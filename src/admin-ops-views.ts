import { AdminUserSession } from "./admin-auth";
import { redactAdminRecord } from "./notification-channel-registry";
import { DeliveryResult, ExecutionRun } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function statusCounts(run: ExecutionRun): Record<string, number> {
  return countBy(run.results.map((result) => result.status));
}

function reasonCounts(run: ExecutionRun): Record<string, number> {
  return countBy(run.results.map((result) => result.decisionReason));
}

function queryValue(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];
  if (Array.isArray(value)) return value[0] === undefined ? undefined : String(value[0]);
  return value === undefined ? undefined : String(value);
}

function includesText(value: unknown, expected: string): boolean {
  return String(value ?? "").toLowerCase().includes(expected.toLowerCase());
}

function matchesRun(run: ExecutionRun, query: Record<string, unknown>): boolean {
  const campaignId = queryValue(query, "campaignId");
  const status = queryValue(query, "status");
  const dryRun = queryValue(query, "dryRun");
  const correlationId = queryValue(query, "correlationId");
  const outcomeStatus = queryValue(query, "outcomeStatus");
  const decisionReason = queryValue(query, "decisionReason");
  const q = queryValue(query, "q");

  if (campaignId && run.campaignId !== campaignId) return false;
  if (status && run.status !== status) return false;
  if (dryRun !== undefined && String(run.dryRun === true) !== dryRun) return false;
  if (correlationId && !run.results.some((result) => result.correlationId === correlationId)) return false;
  if (outcomeStatus && !run.results.some((result) => result.status === outcomeStatus)) return false;
  if (decisionReason && !run.results.some((result) => result.decisionReason === decisionReason)) return false;
  if (q) {
    const searchable = [
      run.id,
      run.campaignId,
      run.idempotencyKey,
      run.status,
      ...run.results.flatMap((result) => [
        result.deliveryId,
        result.recipientRef,
        result.recipientSource,
        result.status,
        result.decisionReason,
        result.correlationId ?? ""
      ])
    ];
    if (!searchable.some((value) => includesText(value, q))) return false;
  }
  return true;
}

export function filterAdminRuns(runs: ExecutionRun[], query: Record<string, unknown>): ExecutionRun[] {
  return runs.filter((run) => matchesRun(run, query));
}

export function redactedOutcome(result: DeliveryResult): Record<string, unknown> {
  return {
    deliveryId: result.deliveryId,
    campaignId: result.campaignId,
    recipientRef: result.recipientRef,
    recipientSource: result.recipientSource,
    recipientAddress: "[redacted]",
    requestedChannel: result.requestedChannel,
    effectiveChannel: result.effectiveChannel,
    status: result.status,
    decisionReason: result.decisionReason,
    processedAt: result.processedAt,
    duration_ms: result.duration_ms,
    correlationId: result.correlationId ?? null
  };
}

export function adminRunSummary(run: ExecutionRun): Record<string, unknown> {
  return {
    id: run.id,
    campaignId: run.campaignId,
    idempotencyKey: run.idempotencyKey,
    status: run.status,
    dryRun: run.dryRun === true,
    schedulerOwner: run.schedulerOwner ?? null,
    approvalEvidence: run.approvalEvidence ?? null,
    totalRecipients: run.totalRecipients,
    totalSent: run.totalSent,
    outcomeCount: run.results.length,
    statusCounts: statusCounts(run),
    decisionReasonCounts: reasonCounts(run),
    startedAt: run.startedAt,
    completedAt: run.completedAt ?? null
  };
}

export function adminRunDetail(run: ExecutionRun): Record<string, unknown> {
  return {
    ...adminRunSummary(run),
    outcomes: run.results.map(redactedOutcome),
    redaction: {
      recipientAddress: "redacted",
      messageBody: "not_exposed",
      providerCredentials: "not_exposed",
      tokens: "not_exposed"
    }
  };
}

export function adminOutcomeSearch(runs: ExecutionRun[], query: Record<string, unknown>): Record<string, unknown>[] {
  const correlationId = queryValue(query, "correlationId");
  const status = queryValue(query, "status");
  const decisionReason = queryValue(query, "decisionReason");
  const recipientRef = queryValue(query, "recipientRef");
  const q = queryValue(query, "q");
  return runs.flatMap((run) => run.results.map((result) => ({ run, result })))
    .filter(({ run, result }) => {
      if (correlationId && result.correlationId !== correlationId) return false;
      if (status && result.status !== status) return false;
      if (decisionReason && result.decisionReason !== decisionReason) return false;
      if (recipientRef && result.recipientRef !== recipientRef) return false;
      if (q) {
        const searchable = [
          run.id,
          run.campaignId,
          run.idempotencyKey,
          result.deliveryId,
          result.recipientRef,
          result.recipientSource,
          result.status,
          result.decisionReason,
          result.correlationId ?? ""
        ];
        if (!searchable.some((value) => includesText(value, q))) return false;
      }
      return true;
    })
    .map(({ run, result }) => ({ runId: run.id, ...redactedOutcome(result) }));
}

export function adminAuditEvidence(runs: ExecutionRun[], query: Record<string, unknown>): Record<string, unknown>[] {
  return filterAdminRuns(runs, query).map((run) => redactAdminRecord({
    event: "campaign_run_audit_evidence",
    runId: run.id,
    campaignId: run.campaignId,
    idempotencyKey: run.idempotencyKey,
    status: run.status,
    dryRun: run.dryRun === true,
    schedulerOwner: run.schedulerOwner ?? null,
    approvalEvidence: run.approvalEvidence ?? null,
    totals: {
      totalRecipients: run.totalRecipients,
      totalSent: run.totalSent,
      outcomeCount: run.results.length,
      statusCounts: statusCounts(run),
      decisionReasonCounts: reasonCounts(run)
    },
    correlationIds: run.results.map((result) => result.correlationId).filter(Boolean),
    outcomes: run.results.map(redactedOutcome),
    startedAt: run.startedAt,
    completedAt: run.completedAt ?? null,
    redaction: ["recipientAddress", "message.body", "providerCredentials", "authorization", "tokens"]
  }));
}

function nav(activePath: string): string {
  const routes = [
    ["/admin", "Overview"],
    ["/admin/campaigns", "Campaigns"],
    ["/admin/segments", "Segments"],
    ["/admin/journeys", "Journeys"],
    ["/admin/runs", "Runs"],
    ["/admin/audit", "Audit"],
    ["/admin/settings", "Settings"]
  ];
  return routes.map(([path, label]) => `      <a href="${path}"${path === activePath ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`).join("\n");
}

function baseShell(session: AdminUserSession, activePath: string, title: string, body: string): string {
  const label = escapeHtml(session.user.email ?? session.user.id ?? "Marketing admin");
  const accessLevel = escapeHtml(session.accessLevel);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Marketing Admin</title>
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
    h3 { margin: 0 0 12px; font-size: 16px; letter-spacing: 0; }
    .identity { color: #536471; font-size: 14px; text-align: right; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
    .panel { background: white; border: 1px solid #d8e0e8; border-radius: 8px; padding: 18px; min-width: 0; }
    label { display: block; color: #536471; font-size: 12px; font-weight: 700; margin-bottom: 5px; }
    input, select, button, textarea { box-sizing: border-box; font: inherit; }
    input, select, textarea { width: 100%; border: 1px solid #bcc8d4; border-radius: 6px; padding: 9px 10px; background: white; color: #172026; }
    button { border: 0; border-radius: 6px; background: #2f7d68; color: white; padding: 9px 12px; cursor: pointer; }
    .row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; }
    pre { margin: 0; overflow: auto; white-space: pre-wrap; word-break: break-word; background: #111827; color: #e5e7eb; border-radius: 8px; padding: 14px; max-height: 360px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e1e7ee; padding: 8px; text-align: left; vertical-align: top; }
    th { color: #536471; font-size: 12px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    .wide { grid-column: 1 / -1; }
    @media (max-width: 920px) { .shell { grid-template-columns: 1fr; } nav { padding: 16px; } main { padding: 20px; } header { align-items: flex-start; flex-direction: column; } .identity { text-align: left; } .grid { grid-template-columns: 1fr; } .row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="shell">
    <nav aria-label="Admin navigation">
      <h1>Marketing Admin</h1>
${nav(activePath)}
    </nav>
    <main>
      <header>
        <h2>${escapeHtml(title)}</h2>
        <div class="identity">${label}<br>${accessLevel}</div>
      </header>
${body}
    </main>
  </div>
</body>
</html>`;
}

export function renderAdminRunsConsole(session: AdminUserSession): string {
  return baseShell(session, "/admin/runs", "Run Operations", `      <div class="grid">
        <section class="panel wide" aria-labelledby="run-search-title">
          <h3 id="run-search-title">Runs and outcomes</h3>
          <div class="row">
            <div><label for="campaign-id">Campaign ID</label><input id="campaign-id" autocomplete="off"></div>
            <div><label for="correlation-id">Correlation ID</label><input id="correlation-id" autocomplete="off"></div>
            <div><label for="decision-reason">Decision reason</label><input id="decision-reason" autocomplete="off"></div>
          </div>
          <button id="load-runs" type="button">Search</button>
          <table aria-label="Run results"><thead><tr><th>Run</th><th>Campaign</th><th>Status</th><th>Recipients</th><th>Reasons</th></tr></thead><tbody id="runs-body"></tbody></table>
        </section>
        <section class="panel" aria-labelledby="preference-title">
          <h3 id="preference-title">Consent lookup</h3>
          <div class="row">
            <div><label for="pref-owner">Owner</label><select id="pref-owner"><option value="auth">auth</option><option value="leads">leads</option></select></div>
            <div><label for="pref-recipient">Recipient ID</label><input id="pref-recipient" autocomplete="off"></div>
            <div><label for="pref-channel">Channel</label><select id="pref-channel"><option value="">all</option><option>email</option><option>telegram</option><option>whatsapp</option></select></div>
          </div>
          <button id="lookup-pref" type="button">Lookup</button>
          <button id="unsubscribe-pref" type="button">Unsubscribe</button>
          <pre id="preference-output">{}</pre>
        </section>
        <section class="panel" aria-labelledby="channels-title">
          <h3 id="channels-title">Channel registry</h3>
          <button id="load-channels" type="button">Refresh</button>
          <pre id="channels-output">{}</pre>
        </section>
      </div>
      <script>
        const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c]));
        async function api(path, options) { const r = await fetch(path, { headers: { "content-type": "application/json" }, ...options }); const text = await r.text(); const body = text ? JSON.parse(text) : {}; if (!r.ok) throw body; return body; }
        async function loadRuns() {
          const params = new URLSearchParams();
          for (const [id, key] of [["campaign-id", "campaignId"], ["correlation-id", "correlationId"], ["decision-reason", "decisionReason"]]) { const value = document.getElementById(id).value.trim(); if (value) params.set(key, value); }
          const runs = await api("/admin/api/runs?" + params.toString());
          document.getElementById("runs-body").innerHTML = runs.map((run) => '<tr><td><code>' + esc(run.id) + '</code></td><td><code>' + esc(run.campaignId) + '</code></td><td>' + esc(run.status) + '</td><td>' + esc(run.totalRecipients) + ' / sent ' + esc(run.totalSent) + '</td><td><code>' + esc(JSON.stringify(run.decisionReasonCounts || {})) + '</code></td></tr>').join("");
        }
        async function lookupPreference() {
          const owner = document.getElementById("pref-owner").value;
          const recipient = encodeURIComponent(document.getElementById("pref-recipient").value.trim());
          document.getElementById("preference-output").textContent = JSON.stringify(await api("/admin/api/preferences/" + owner + "/" + recipient), null, 2);
        }
        async function unsubscribePreference() {
          const payload = { owner: document.getElementById("pref-owner").value, recipientId: document.getElementById("pref-recipient").value.trim(), channel: document.getElementById("pref-channel").value || undefined };
          document.getElementById("preference-output").textContent = JSON.stringify(await api("/admin/api/preferences/unsubscribe", { method: "POST", body: JSON.stringify(payload) }), null, 2);
        }
        async function loadChannels() { document.getElementById("channels-output").textContent = JSON.stringify(await api("/admin/api/channels"), null, 2); }
        document.getElementById("load-runs").addEventListener("click", () => loadRuns().catch((e) => alert(JSON.stringify(e))));
        document.getElementById("lookup-pref").addEventListener("click", () => lookupPreference().catch((e) => alert(JSON.stringify(e))));
        document.getElementById("unsubscribe-pref").addEventListener("click", () => unsubscribePreference().catch((e) => alert(JSON.stringify(e))));
        document.getElementById("load-channels").addEventListener("click", () => loadChannels().catch((e) => alert(JSON.stringify(e))));
        loadRuns().catch(() => undefined); loadChannels().catch(() => undefined);
      </script>`);
}

export function renderAdminAuditConsole(session: AdminUserSession): string {
  return baseShell(session, "/admin/audit", "Audit Evidence", `      <div class="grid">
        <section class="panel wide" aria-labelledby="audit-search-title">
          <h3 id="audit-search-title">Correlation search</h3>
          <div class="row">
            <div><label for="audit-run">Run ID</label><input id="audit-run" autocomplete="off"></div>
            <div><label for="audit-campaign">Campaign ID</label><input id="audit-campaign" autocomplete="off"></div>
            <div><label for="audit-correlation">Correlation ID</label><input id="audit-correlation" autocomplete="off"></div>
          </div>
          <button id="load-audit" type="button">Search</button>
          <pre id="audit-output">[]</pre>
        </section>
      </div>
      <script>
        async function loadAudit() {
          const params = new URLSearchParams();
          const runId = document.getElementById("audit-run").value.trim();
          const campaignId = document.getElementById("audit-campaign").value.trim();
          const correlationId = document.getElementById("audit-correlation").value.trim();
          if (runId) params.set("q", runId); if (campaignId) params.set("campaignId", campaignId); if (correlationId) params.set("correlationId", correlationId);
          const response = await fetch("/admin/api/audit?" + params.toString());
          document.getElementById("audit-output").textContent = JSON.stringify(await response.json(), null, 2);
        }
        document.getElementById("load-audit").addEventListener("click", loadAudit);
        loadAudit().catch(() => undefined);
      </script>`);
}
