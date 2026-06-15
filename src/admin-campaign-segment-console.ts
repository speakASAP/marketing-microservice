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

type ConsoleOptions = {
  page: AdminConsolePage;
  title: string;
  content: string;
};

function renderConsolePage(session: AdminUserSession, options: ConsoleOptions): string {
  const label = escapeHtml(session.user.email ?? session.user.id ?? "Marketing admin");
  const accessLevel = escapeHtml(session.accessLevel);
  const activeCampaigns = options.page === "campaigns" ? " aria-current=\"page\"" : "";
  const activeSegments = options.page === "segments" ? " aria-current=\"page\"" : "";
  const canDryRun = hasAdminAccessLevel(session.accessLevel, "operator");
  const canApprove = hasAdminAccessLevel(session.accessLevel, "admin");
  const canEdit = hasAdminAccessLevel(session.accessLevel, "admin");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Marketing Admin - ${escapeHtml(options.title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172026; background: #f6f8fb; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 248px 1fr; }
    nav { background: #172026; color: #f8fafc; padding: 24px 18px; }
    nav h1 { margin: 0 0 24px; font-size: 18px; font-weight: 700; letter-spacing: 0; }
    nav a { display: block; color: #d9e2ec; text-decoration: none; padding: 10px 12px; border-radius: 6px; margin: 2px 0; font-size: 14px; }
    nav a[aria-current="page"] { background: #2f7d68; color: white; }
    main { padding: 28px; min-width: 0; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
    h2 { margin: 0; font-size: 24px; letter-spacing: 0; }
    h3 { margin: 0; font-size: 16px; letter-spacing: 0; }
    h4 { margin: 0 0 10px; font-size: 14px; letter-spacing: 0; }
    .identity { color: #536471; font-size: 14px; text-align: right; }
    .workspace { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(360px, .9fr); gap: 18px; align-items: start; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .status { color: #536471; font-size: 13px; }
    .surface { background: white; border: 1px solid #d8e0e8; border-radius: 8px; padding: 16px; }
    .table-wrap { overflow-x: auto; border: 1px solid #d8e0e8; border-radius: 8px; background: white; }
    table { width: 100%; border-collapse: collapse; min-width: 720px; }
    th, td { padding: 11px 12px; border-bottom: 1px solid #e7edf3; text-align: left; vertical-align: top; font-size: 14px; }
    th { color: #536471; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; background: #fbfcfe; }
    tr:last-child td { border-bottom: 0; }
    tr[data-selected="true"] { background: #edf8f4; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 12px; color: #334155; }
    .pill { display: inline-flex; align-items: center; min-height: 22px; padding: 0 8px; border-radius: 999px; background: #e7edf3; color: #172026; font-size: 12px; white-space: nowrap; }
    .pill.approved, .pill.scheduled { background: #dff4ea; color: #17624f; }
    .pill.pending, .pill.draft { background: #fff1d6; color: #73510d; }
    .pill.paused { background: #e8ebff; color: #3842a0; }
    .pill.archived { background: #eceff3; color: #4b5563; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    button { border: 1px solid #b9c6d3; background: white; color: #172026; border-radius: 6px; min-height: 34px; padding: 0 10px; font: inherit; font-size: 13px; cursor: pointer; }
    button.primary { border-color: #2f7d68; background: #2f7d68; color: white; }
    button.warning { border-color: #9b6a11; color: #6f4a09; }
    button.danger { border-color: #9f2d2d; color: #842121; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    form { display: grid; gap: 12px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    label { display: grid; gap: 5px; font-size: 12px; color: #536471; }
    input, select, textarea { width: 100%; border: 1px solid #b9c6d3; border-radius: 6px; padding: 8px 9px; min-height: 36px; font: inherit; font-size: 14px; color: #172026; background: white; }
    input:disabled { background: #f4f7fa; color: #536471; }
    textarea { min-height: 84px; resize: vertical; }
    .detail { display: grid; gap: 12px; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .metric { border: 1px solid #d8e0e8; border-radius: 8px; padding: 10px; background: #fbfcfe; }
    .metric span { display: block; color: #536471; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .metric strong { display: block; margin-top: 4px; font-size: 13px; overflow-wrap: anywhere; }
    pre { margin: 0; max-height: 320px; overflow: auto; border: 1px solid #d8e0e8; border-radius: 8px; background: #101820; color: #edf6f9; padding: 12px; font-size: 12px; line-height: 1.5; }
    .hidden { display: none !important; }
    @media (max-width: 980px) { .workspace { grid-template-columns: 1fr; } }
    @media (max-width: 760px) { .shell { grid-template-columns: 1fr; } nav { padding: 16px; } main { padding: 18px; } header { align-items: flex-start; flex-direction: column; } .identity { text-align: left; } .toolbar { align-items: flex-start; flex-direction: column; } .grid, .summary { grid-template-columns: 1fr; } table { min-width: 640px; } }
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
    <main data-page="${options.page}" data-can-dry-run="${canDryRun}" data-can-approve="${canApprove}" data-can-edit="${canEdit}">
      <header>
        <h2>${escapeHtml(options.title)}</h2>
        <div class="identity">${label}<br>${accessLevel}</div>
      </header>
      ${options.content}
    </main>
  </div>
</body>
</html>`;
}

function campaignContent(session: AdminUserSession): string {
  const canDryRun = hasAdminAccessLevel(session.accessLevel, "operator");
  const canApprove = hasAdminAccessLevel(session.accessLevel, "admin");
  const canEdit = hasAdminAccessLevel(session.accessLevel, "admin");
  return `<section class="workspace" aria-labelledby="campaigns-table-title">
    <div>
      <div class="toolbar">
        <h3 id="campaigns-table-title">Campaign definitions</h3>
        <div class="actions"><span class="status" id="campaigns-status">Loading</span><button class="primary" id="new-campaign" ${canEdit ? "" : "disabled"}>New campaign</button></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Scope</th><th>Segment</th><th>Status</th><th>Approval</th><th>Schedule</th><th>Actions</th></tr></thead>
          <tbody id="campaigns-body"></tbody>
        </table>
      </div>
    </div>
    <aside class="detail">
      <section class="surface" aria-labelledby="campaign-detail-title">
        <h3 id="campaign-detail-title">Campaign detail</h3>
        <div class="summary" id="campaign-summary"></div>
      </section>
      <section class="surface" aria-labelledby="campaign-form-title">
        <h3 id="campaign-form-title">Create or edit</h3>
        <form id="campaign-form">
          <input type="hidden" name="campaignId">
          <div class="grid">
            <label>Tenant<input name="tenant" required></label>
            <label>Name<input name="name" required></label>
            <label>Tenant ID<input name="tenantId" required></label>
            <label>App ID<input name="appId" required></label>
            <label>Brand ID<input name="brandId" required></label>
            <label>Environment<select name="environment"><option value="">None</option><option>production</option><option>staging</option><option>development</option><option>test</option></select></label>
            <label>Segment<select name="segmentId" required></select></label>
            <label>Template ref<input name="templateRef" required></label>
            <label>Purpose<select name="purpose"><option>marketing</option><option>retention</option><option>transactional-not-marketing</option></select></label>
            <label>Primary channel<select name="primaryChannel"><option>email</option><option>telegram</option><option>whatsapp</option></select></label>
            <label>Fallback channels<input name="fallbackChannels" placeholder="telegram,whatsapp"></label>
            <label>Channel key<input name="channelKey"></label>
            <label>Frequency cap/day<input name="frequencyCapPerDay" type="number" min="1" value="1"></label>
            <label>Throttle/minute<input name="throttlePerMinute" type="number" min="0"></label>
            <label>Schedule at<input name="scheduleAt" type="datetime-local"></label>
            <label>Status<select name="status"><option>draft</option><option>scheduled</option><option>paused</option><option>archived</option></select></label>
            <label>Approval status<input name="approvalStatus" disabled></label>
            <label>Approved by<input name="approvedBy" disabled></label>
          </div>
          <label>Description<textarea name="description"></textarea></label>
          <label>Subject<input name="subject"></label>
          <label>Message body<textarea name="body" required></textarea></label>
          <div class="actions">
            <button class="primary" type="submit" ${canEdit ? "" : "disabled"}>Save campaign</button>
            <button type="button" id="dry-run-campaign" ${canDryRun ? "" : "disabled"}>Dry run</button>
            <button type="button" id="approve-campaign" ${canApprove ? "" : "disabled"}>Approve</button>
            <button type="button" id="schedule-campaign" ${canEdit ? "" : "disabled"}>Schedule</button>
            <button class="warning" type="button" id="pause-campaign" ${canEdit ? "" : "disabled"}>Pause</button>
            <button class="danger" type="button" id="archive-campaign" ${canEdit ? "" : "disabled"}>Archive</button>
          </div>
        </form>
      </section>
      <pre id="campaign-result" class="hidden"></pre>
    </aside>
  </section>
  <script>
    const state = { campaigns: [], segments: [], selectedCampaignId: null, canEdit: ${JSON.stringify(canEdit)}, canDryRun: ${JSON.stringify(canDryRun)}, canApprove: ${JSON.stringify(canApprove)} };
    const text = (value) => value == null || value === "" ? "-" : String(value);
    const esc = (value) => text(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    const pill = (value) => '<span class="pill ' + esc(value) + '">' + esc(value) + '</span>';
    const form = document.getElementById("campaign-form");
    async function api(path, options = {}) {
      const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || response.statusText);
      return body;
    }
    function toLocalDateTime(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    }
    function toIso(value) {
      return value ? new Date(value).toISOString() : undefined;
    }
    function selectedCampaign() {
      return state.campaigns.find((campaign) => campaign.campaignId === state.selectedCampaignId) || null;
    }
    function segmentName(id) {
      return state.segments.find((segment) => segment.segmentId === id)?.name || id;
    }
    function renderSegmentOptions() {
      form.segmentId.innerHTML = state.segments.map((segment) => '<option value="' + esc(segment.segmentId) + '">' + esc(segment.name) + '</option>').join("");
    }
    function renderRows() {
      const body = document.getElementById("campaigns-body");
      body.innerHTML = state.campaigns.map((campaign) => '<tr data-id="' + esc(campaign.campaignId) + '" data-selected="' + String(campaign.campaignId === state.selectedCampaignId) + '">' +
        '<td><strong>' + esc(campaign.name) + '</strong><br><code>' + esc(campaign.campaignId) + '</code></td>' +
        '<td>' + esc(campaign.tenantId) + ' / ' + esc(campaign.appId) + '<br>' + esc(campaign.brandId) + '</td>' +
        '<td>' + esc(segmentName(campaign.segmentId)) + '</td>' +
        '<td>' + pill(campaign.status) + '</td>' +
        '<td>' + pill(campaign.approvalStatus) + '</td>' +
        '<td>' + esc(campaign.scheduleAt || 'unscheduled') + '</td>' +
        '<td><div class="actions"><button data-action="select" data-id="' + esc(campaign.campaignId) + '">Open</button><button data-action="dry-run" data-id="' + esc(campaign.campaignId) + '" ' + (state.canDryRun ? '' : 'disabled') + '>Dry run</button></div></td>' +
      '</tr>').join("") || '<tr><td colspan="7">No campaigns found.</td></tr>';
      document.getElementById("campaigns-status").textContent = state.campaigns.length + " campaigns";
    }
    function renderSummary(campaign) {
      document.getElementById("campaign-summary").innerHTML = campaign ? [
        ["ID", campaign.campaignId], ["Status", campaign.status], ["Approval", campaign.approvalStatus],
        ["Approved by", campaign.approvedBy || "-"], ["Approved at", campaign.approvedAt || "-"], ["Channel", campaign.primaryChannel]
      ].map(([label, value]) => '<div class="metric"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>').join("") : '<div class="metric"><span>Selection</span><strong>No campaign selected</strong></div>';
    }
    function fillForm(campaign) {
      form.reset();
      form.frequencyCapPerDay.value = "1";
      form.status.value = "draft";
      if (!campaign) {
        form.campaignId.value = "";
        renderSummary(null);
        return;
      }
      form.campaignId.value = campaign.campaignId;
      for (const key of ["tenant", "tenantId", "appId", "brandId", "name", "templateRef", "purpose", "primaryChannel", "channelKey", "frequencyCapPerDay", "throttlePerMinute", "status", "approvalStatus", "approvedBy"]) {
        if (form[key]) form[key].value = campaign[key] ?? "";
      }
      form.environment.value = campaign.environment || "";
      form.segmentId.value = campaign.segmentId;
      form.fallbackChannels.value = (campaign.fallbackChannels || []).join(",");
      form.scheduleAt.value = toLocalDateTime(campaign.scheduleAt);
      form.description.value = campaign.description || "";
      form.subject.value = campaign.message?.subject || "";
      form.body.value = campaign.message?.body || "";
      renderSummary(campaign);
    }
    function readForm() {
      const fallbackChannels = form.fallbackChannels.value.split(",").map((item) => item.trim()).filter(Boolean);
      const payload = {
        tenant: form.tenant.value.trim(), tenantId: form.tenantId.value.trim(), appId: form.appId.value.trim(), brandId: form.brandId.value.trim(),
        name: form.name.value.trim(), segmentId: form.segmentId.value, templateRef: form.templateRef.value.trim(), purpose: form.purpose.value,
        primaryChannel: form.primaryChannel.value, fallbackChannels, frequencyCapPerDay: Number(form.frequencyCapPerDay.value || 1),
        message: { body: form.body.value.trim() }, status: form.status.value
      };
      if (form.environment.value) payload.environment = form.environment.value;
      if (form.channelKey.value.trim()) payload.channelKey = form.channelKey.value.trim();
      if (form.throttlePerMinute.value !== "") payload.throttlePerMinute = Number(form.throttlePerMinute.value);
      if (form.scheduleAt.value) payload.scheduleAt = toIso(form.scheduleAt.value);
      if (form.description.value.trim()) payload.description = form.description.value.trim();
      if (form.subject.value.trim()) payload.message.subject = form.subject.value.trim();
      return payload;
    }
    function showResult(value) {
      const result = document.getElementById("campaign-result");
      result.classList.remove("hidden");
      result.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    }
    async function load() {
      const [segments, campaigns] = await Promise.all([api("/admin/api/segments"), api("/admin/api/campaigns")]);
      state.segments = segments;
      state.campaigns = campaigns;
      renderSegmentOptions();
      if (!state.selectedCampaignId && campaigns[0]) state.selectedCampaignId = campaigns[0].campaignId;
      renderRows();
      fillForm(selectedCampaign());
    }
    async function saveCampaign(event) {
      event.preventDefault();
      if (!state.canEdit) return;
      const id = form.campaignId.value;
      const saved = await api(id ? "/admin/api/campaigns/" + encodeURIComponent(id) : "/admin/api/campaigns", { method: id ? "PUT" : "POST", body: JSON.stringify(readForm()) });
      state.selectedCampaignId = saved.campaignId;
      showResult(saved);
      await load();
    }
    async function runCampaignAction(action, id = form.campaignId.value) {
      if (!id) return showResult({ error: "campaign_required" });
      let body = {};
      let path = "/admin/api/campaigns/" + encodeURIComponent(id) + "/" + action;
      if (action === "dry-run") body = { idempotencyKey: "admin-console-" + id + "-" + Date.now() };
      if (action === "approve") body = { approvalNote: "Approved from Marketing admin console" };
      if (["scheduled", "paused", "archived"].includes(action)) {
        path = "/admin/api/campaigns/" + encodeURIComponent(id) + "/status";
        body = { status: action === "scheduled" ? "scheduled" : action, scheduleAt: toIso(form.scheduleAt.value) };
      }
      const response = await api(path, { method: "POST", body: JSON.stringify(body) });
      state.selectedCampaignId = id;
      showResult(response);
      await load();
    }
    document.getElementById("new-campaign").addEventListener("click", () => { state.selectedCampaignId = null; renderRows(); fillForm(null); });
    document.getElementById("dry-run-campaign").addEventListener("click", () => runCampaignAction("dry-run"));
    document.getElementById("approve-campaign").addEventListener("click", () => runCampaignAction("approve"));
    document.getElementById("schedule-campaign").addEventListener("click", () => runCampaignAction("scheduled"));
    document.getElementById("pause-campaign").addEventListener("click", () => runCampaignAction("paused"));
    document.getElementById("archive-campaign").addEventListener("click", () => runCampaignAction("archived"));
    form.addEventListener("submit", (event) => saveCampaign(event).catch((error) => showResult({ error: error.message })));
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      if (button.dataset.action === "select") { state.selectedCampaignId = button.dataset.id; renderRows(); fillForm(selectedCampaign()); return; }
      runCampaignAction(button.dataset.action, button.dataset.id).catch((error) => showResult({ error: error.message }));
    });
    load().catch((error) => { document.getElementById("campaigns-status").textContent = error.message; });
  </script>`;
}

function segmentContent(session: AdminUserSession): string {
  const canEdit = hasAdminAccessLevel(session.accessLevel, "admin");
  return `<section class="workspace" aria-labelledby="segments-table-title">
    <div>
      <div class="toolbar">
        <h3 id="segments-table-title">Segment definitions</h3>
        <div class="actions"><span class="status" id="segments-status">Loading</span><button class="primary" id="new-segment" ${canEdit ? "" : "disabled"}>New segment</button></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Scope</th><th>Sources</th><th>Mode</th><th>Estimated</th><th>Actions</th></tr></thead>
          <tbody id="segments-body"></tbody>
        </table>
      </div>
    </div>
    <aside class="detail">
      <section class="surface" aria-labelledby="segment-detail-title">
        <h3 id="segment-detail-title">Segment detail</h3>
        <div class="summary" id="segment-summary"></div>
      </section>
      <section class="surface" aria-labelledby="segment-form-title">
        <h3 id="segment-form-title">Create or edit</h3>
        <form id="segment-form">
          <input type="hidden" name="segmentId">
          <div class="grid">
            <label>Name<input name="name" required></label>
            <label>Tenant ID<input name="tenantId" required></label>
            <label>App ID<input name="appId" required></label>
            <label>Brand ID<input name="brandId" required></label>
            <label>Environment<select name="environment"><option value="">None</option><option>production</option><option>staging</option><option>development</option><option>test</option></select></label>
            <label>Source types<input name="sourceTypes" required placeholder="auth_users,leads"></label>
            <label>Dynamic<select name="isDynamic"><option value="true">Dynamic</option><option value="false">Static</option></select></label>
            <label>Estimated count<input name="estimatedCount" type="number" min="0"></label>
          </div>
          <label>Rules JSON<textarea name="rules" required>{}</textarea></label>
          <div class="actions"><button class="primary" type="submit" ${canEdit ? "" : "disabled"}>Save segment</button></div>
        </form>
      </section>
      <pre id="segment-result" class="hidden"></pre>
    </aside>
  </section>
  <script>
    const state = { segments: [], selectedSegmentId: null, canEdit: ${JSON.stringify(canEdit)} };
    const text = (value) => value == null || value === "" ? "-" : String(value);
    const esc = (value) => text(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    const form = document.getElementById("segment-form");
    async function api(path, options = {}) {
      const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || response.statusText);
      return body;
    }
    function selectedSegment() {
      return state.segments.find((segment) => segment.segmentId === state.selectedSegmentId) || null;
    }
    function renderRows() {
      document.getElementById("segments-body").innerHTML = state.segments.map((segment) => '<tr data-id="' + esc(segment.segmentId) + '" data-selected="' + String(segment.segmentId === state.selectedSegmentId) + '">' +
        '<td><strong>' + esc(segment.name) + '</strong><br><code>' + esc(segment.segmentId) + '</code></td>' +
        '<td>' + esc(segment.tenantId) + ' / ' + esc(segment.appId) + '<br>' + esc(segment.brandId) + '</td>' +
        '<td>' + esc((segment.sourceTypes || []).join(", ")) + '</td>' +
        '<td>' + (segment.isDynamic ? 'Dynamic' : 'Static') + '</td>' +
        '<td>' + esc(segment.estimatedCount) + '</td>' +
        '<td><button data-action="select" data-id="' + esc(segment.segmentId) + '">Open</button></td>' +
      '</tr>').join("") || '<tr><td colspan="6">No segments found.</td></tr>';
      document.getElementById("segments-status").textContent = state.segments.length + " segments";
    }
    function renderSummary(segment) {
      document.getElementById("segment-summary").innerHTML = segment ? [
        ["ID", segment.segmentId], ["Sources", (segment.sourceTypes || []).join(", ")], ["Mode", segment.isDynamic ? "Dynamic" : "Static"],
        ["Tenant", segment.tenantId], ["App", segment.appId], ["Brand", segment.brandId]
      ].map(([label, value]) => '<div class="metric"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>').join("") : '<div class="metric"><span>Selection</span><strong>No segment selected</strong></div>';
    }
    function fillForm(segment) {
      form.reset();
      form.rules.value = "{}";
      if (!segment) { form.segmentId.value = ""; renderSummary(null); return; }
      form.segmentId.value = segment.segmentId;
      for (const key of ["name", "tenantId", "appId", "brandId"]) form[key].value = segment[key] || "";
      form.environment.value = segment.environment || "";
      form.sourceTypes.value = (segment.sourceTypes || []).join(",");
      form.isDynamic.value = String(Boolean(segment.isDynamic));
      form.estimatedCount.value = segment.estimatedCount ?? "";
      form.rules.value = JSON.stringify(segment.rules || {}, null, 2);
      renderSummary(segment);
    }
    function readForm() {
      const payload = {
        name: form.name.value.trim(), tenantId: form.tenantId.value.trim(), appId: form.appId.value.trim(), brandId: form.brandId.value.trim(),
        sourceTypes: form.sourceTypes.value.split(",").map((item) => item.trim()).filter(Boolean), rules: JSON.parse(form.rules.value || "{}"),
        isDynamic: form.isDynamic.value === "true"
      };
      if (form.environment.value) payload.environment = form.environment.value;
      if (form.estimatedCount.value !== "") payload.estimatedCount = Number(form.estimatedCount.value);
      return payload;
    }
    function showResult(value) {
      const result = document.getElementById("segment-result");
      result.classList.remove("hidden");
      result.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    }
    async function load() {
      state.segments = await api("/admin/api/segments");
      if (!state.selectedSegmentId && state.segments[0]) state.selectedSegmentId = state.segments[0].segmentId;
      renderRows();
      fillForm(selectedSegment());
    }
    async function saveSegment(event) {
      event.preventDefault();
      if (!state.canEdit) return;
      const id = form.segmentId.value;
      const saved = await api(id ? "/admin/api/segments/" + encodeURIComponent(id) : "/admin/api/segments", { method: id ? "PUT" : "POST", body: JSON.stringify(readForm()) });
      state.selectedSegmentId = saved.segmentId;
      showResult(saved);
      await load();
    }
    document.getElementById("new-segment").addEventListener("click", () => { state.selectedSegmentId = null; renderRows(); fillForm(null); });
    form.addEventListener("submit", (event) => saveSegment(event).catch((error) => showResult({ error: error.message })));
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action='select']");
      if (!button) return;
      state.selectedSegmentId = button.dataset.id;
      renderRows();
      fillForm(selectedSegment());
    });
    load().catch((error) => { document.getElementById("segments-status").textContent = error.message; });
  </script>`;
}

export function renderAdminCampaignsConsole(session: AdminUserSession): string {
  return renderConsolePage(session, { page: "campaigns", title: "Campaigns", content: campaignContent(session) });
}

export function renderAdminSegmentsConsole(session: AdminUserSession): string {
  return renderConsolePage(session, { page: "segments", title: "Segments", content: segmentContent(session) });
}
