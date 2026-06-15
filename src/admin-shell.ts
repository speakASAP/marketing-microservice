import { AdminUserSession } from "./admin-auth";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type AdminShellRoute = {
  path: string;
  label: string;
  title: string;
  description: string;
};

export const ADMIN_SHELL_ROUTES: AdminShellRoute[] = [
  { path: "/admin", label: "Overview", title: "Overview", description: "Protected Marketing administration surface." },
  { path: "/admin/campaigns", label: "Campaigns", title: "Campaigns", description: "Protected placeholder for campaign administration." },
  { path: "/admin/segments", label: "Segments", title: "Segments", description: "Protected placeholder for segment administration." },
  { path: "/admin/journeys", label: "Journeys", title: "Journeys", description: "Protected placeholder for journey administration." },
  { path: "/admin/runs", label: "Runs", title: "Runs", description: "Protected placeholder for run inspection." },
  { path: "/admin/audit", label: "Audit", title: "Audit", description: "Protected placeholder for audit evidence review." },
  { path: "/admin/analytics", label: "Analytics", title: "Analytics", description: "Protected campaign analytics and attribution dashboard." },
  { path: "/admin/settings", label: "Settings", title: "Settings", description: "Protected placeholder for administrative settings." }
];

function routeForPath(path: string): AdminShellRoute {
  return ADMIN_SHELL_ROUTES.find((route) => route.path === path) ?? ADMIN_SHELL_ROUTES[0];
}

export function renderAdminShell(session: AdminUserSession, activePath = "/admin"): string {
  const label = escapeHtml(session.user.email ?? session.user.id ?? "Marketing admin");
  const accessLevel = escapeHtml(session.accessLevel);
  const activeRoute = routeForPath(activePath);
  const navigation = ADMIN_SHELL_ROUTES.map((route) => {
    const current = route.path === activeRoute.path ? ' aria-current="page"' : "";
    return `      <a href="${route.path}"${current}>${escapeHtml(route.label)}</a>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Marketing Admin</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; color: #172026; background: #f6f8fb; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 248px 1fr; }
    nav { background: #172026; color: #f8fafc; padding: 24px 18px; }
    nav h1 { margin: 0 0 24px; font-size: 18px; font-weight: 700; letter-spacing: 0; }
    nav a { display: block; color: #d9e2ec; text-decoration: none; padding: 10px 12px; border-radius: 6px; margin: 2px 0; font-size: 14px; }
    nav a[aria-current="page"] { background: #2f7d68; color: white; }
    main { padding: 32px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
    h2 { margin: 0; font-size: 24px; letter-spacing: 0; }
    .identity { color: #536471; font-size: 14px; text-align: right; }
    .panel { background: white; border: 1px solid #d8e0e8; border-radius: 8px; padding: 20px; max-width: 920px; }
    .panel h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: 0; }
    .panel p { margin: 0; color: #536471; line-height: 1.5; }
    @media (max-width: 760px) { .shell { grid-template-columns: 1fr; } nav { padding: 16px; } main { padding: 20px; } header { align-items: flex-start; flex-direction: column; } .identity { text-align: left; } }
  </style>
</head>
<body>
  <div class="shell">
    <nav aria-label="Admin navigation">
      <h1>Marketing Admin</h1>
${navigation}
    </nav>
    <main>
      <header>
        <h2>${escapeHtml(activeRoute.title)}</h2>
        <div class="identity">${label}<br>${accessLevel}</div>
      </header>
      <section class="panel" aria-labelledby="admin-shell-status">
        <h3 id="admin-shell-status">Admin shell</h3>
        <p>${escapeHtml(activeRoute.description)}</p>
      </section>
    </main>
  </div>
</body>
</html>`;
}
