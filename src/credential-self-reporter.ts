// eslint-disable-next-line @typescript-eslint/no-var-requires
const reporter = require("./vendor/credential-reporter.js");

const ORDERS_URL =
  process.env.ORDERS_SERVICE_URL ||
  "http://orders-microservice.statex-apps.svc.cluster.local:3203";

const MONITORING_URL =
  process.env.MONITORING_URL ||
  "http://monitoring-microservice.statex-apps.svc.cluster.local:3395";

/**
 * This service's orders principal, exactly as auth lists it.
 *
 * Hardcoded rather than derived from the token: the reporter must name the
 * principal the inventory knows even when the deployed token is wrong, which is
 * the case worth reporting.
 */
const PRINCIPAL = "svc-marketing-microservice--orders-microservice@internal.alfares.cz";

const TARGET = "orders-microservice";

/**
 * The ingest credential is read from CREDENTIAL_INGEST_TOKEN here, NOT from
 * NOTIFICATION_SERVICE_TOKEN as in every other reporter.
 *
 * This service already sets NOTIFICATION_SERVICE_TOKEN to a different
 * credential — its notifications-service token, verified distinct from
 * monitoring's ingest value in production. Reusing the name would either
 * clobber a working credential or send the wrong one to the ingest guard, so
 * this lane gets its own variable.
 */
const INGEST_TOKEN_ENV = "CREDENTIAL_INGEST_TOKEN";

const REPORT_INTERVAL_MS = Number(process.env.CREDENTIAL_SELF_REPORT_INTERVAL_MS || 30 * 60 * 1000);

/**
 * Reports this service's orders credential, per
 * `monitoring-microservice/docs/CREDENTIAL_SELF_REPORT_CONTRACT.md`.
 *
 * Wave 3 of the prober plan's Task A. This service is plain express rather than
 * NestJS, so there is no `@Cron` to hang the schedule on and the interval is
 * driven by setInterval instead. The vendored module and the classification
 * rule are identical to every other reporter — only the trigger differs.
 *
 * Probe target: `GET /api/orders/internal/order-affinity/replay-candidates`,
 * decorated `@Roles(...ORDER_AFFINITY_REPLAY_READ_ROLES)`, which includes
 * `internal:marketing-microservice:service` — this credential's role. Verified
 * live before adoption: 200 with the deployed token, 401 with a garbage token,
 * and 403 on `/api/orders/admin/lifecycle` with the same token, which is the
 * useful part: it proves the route discriminates on this role rather than
 * accepting any authenticated principal.
 */
export async function runCredentialSelfReport(): Promise<{
  verdict: string;
  posted: boolean;
} | null> {
  const token = (process.env.ORDERS_SERVICE_TOKEN || "").trim();
  const ingestToken = (process.env[INGEST_TOKEN_ENV] || "").trim();

  if (!ingestToken) {
    // A reporter that stops reporting is indistinguishable from a credential
    // that broke, and silence is this design's primary signal. Say so.
    console.error(
      JSON.stringify({
        event: "credential_self_report_undeliverable",
        timestamp: new Date().toISOString(),
        principal: PRINCIPAL,
        reason: `${INGEST_TOKEN_ENV} is empty`,
      }),
    );
    return null;
  }

  const outcome = await reporter.reportCredential({
    url: `${ORDERS_URL}/api/orders/internal/order-affinity/replay-candidates`,
    token,
    serviceName: "marketing-microservice",
    monitoringUrl: MONITORING_URL,
    ingestToken,
    principal: PRINCIPAL,
    target: TARGET,
  });

  console.log(
    JSON.stringify({
      event: "credential_self_report_sent",
      timestamp: new Date().toISOString(),
      principal: PRINCIPAL,
      target: TARGET,
      verdict: outcome.verdict,
      posted: outcome.posted,
      error: outcome.error ?? null,
    }),
  );

  return { verdict: outcome.verdict, posted: outcome.posted };
}

/**
 * Starts the reporting loop. `unref()` so a pending timer never holds the
 * process open during shutdown.
 */
export function startCredentialSelfReporter(): void {
  if (process.env.CREDENTIAL_SELF_REPORT_ENABLED === "false") return;

  const tick = () => {
    runCredentialSelfReport().catch((error: unknown) => {
      // Never let a reporting failure take down the service it observes.
      console.error(
        JSON.stringify({
          event: "credential_self_report_failed",
          timestamp: new Date().toISOString(),
          principal: PRINCIPAL,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  };

  const timer = setInterval(tick, REPORT_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
}
