import { NextFunction, Request, Response } from "express";

export type AdminAccessLevel = "viewer" | "operator" | "admin" | "owner";

export type AdminUserSession = {
  user: {
    id: string | null;
    email: string | null;
    type: string | null;
    roles: string[];
  };
  accessLevel: AdminAccessLevel;
};

type AuthValidationResponse = {
  valid?: boolean;
  user?: unknown;
};

const ACCESS_RANK: Record<AdminAccessLevel, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
  owner: 4
};

const DEFAULT_ROLE_MAP: Record<AdminAccessLevel, string[]> = {
  viewer: [
    "marketing_viewer",
    "global:marketing_viewer",
    "app:marketing-microservice:marketing_viewer",
    "internal:marketing-microservice:marketing_viewer"
  ],
  operator: [
    "marketing_operator",
    "global:marketing_operator",
    "app:marketing-microservice:marketing_operator",
    "internal:marketing-microservice:marketing_operator"
  ],
  admin: [
    "marketing_admin",
    "global:marketing_admin",
    "app:marketing-microservice:marketing_admin",
    "internal:marketing-microservice:marketing_admin",
    "global:platform_admin",
    "internal:marketing-microservice:admin"
  ],
  owner: [
    "marketing_owner",
    "global:marketing_owner",
    "app:marketing-microservice:marketing_owner",
    "internal:marketing-microservice:marketing_owner",
    "global:superadmin"
  ]
};

const ROLE_ENV_KEYS: Record<AdminAccessLevel, string> = {
  viewer: "MARKETING_ADMIN_VIEWER_ROLES",
  operator: "MARKETING_ADMIN_OPERATOR_ROLES",
  admin: "MARKETING_ADMIN_ADMIN_ROLES",
  owner: "MARKETING_ADMIN_OWNER_ROLES"
};

class AdminAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function roleListFromEnv(level: AdminAccessLevel): string[] {
  const configured = process.env[ROLE_ENV_KEYS[level]];
  if (!configured || configured.trim().length === 0) return DEFAULT_ROLE_MAP[level];
  return configured.split(",").map((role) => role.trim()).filter(Boolean);
}

export function resolveAdminAccessLevel(roles: string[]): AdminAccessLevel | null {
  const userRoles = new Set(roles);
  for (const level of ["owner", "admin", "operator", "viewer"] as const) {
    if (roleListFromEnv(level).some((role) => userRoles.has(role))) return level;
  }
  return null;
}

export function hasAdminAccessLevel(actual: AdminAccessLevel, required: AdminAccessLevel): boolean {
  return ACCESS_RANK[actual] >= ACCESS_RANK[required];
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator === -1) return cookies;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function tokenFromAdminRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim() || null;
  const cookieName = process.env.AUTH_ADMIN_ACCESS_TOKEN_COOKIE || "auth_access_token";
  return parseCookieHeader(req.headers.cookie)[cookieName] ?? null;
}

function authValidateUrl(): string {
  const baseUrl = process.env.AUTH_SERVICE_URL;
  if (!baseUrl) {
    throw new AdminAuthError(503, "admin_auth_not_configured", "Admin auth requires AUTH_SERVICE_URL.");
  }
  const path = process.env.AUTH_SESSION_VALIDATE_PATH || "/auth/validate";
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function postAuthValidation(token: string): Promise<AuthValidationResponse> {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.AUTH_SESSION_VALIDATE_TIMEOUT_MS || 5000);
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000);
  try {
    const response = await fetch(authValidateUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: controller.signal
    });
    if (response.status === 401 || response.status === 403) {
      throw new AdminAuthError(401, "admin_auth_invalid", "Auth rejected the supplied session token.");
    }
    if (!response.ok) {
      throw new AdminAuthError(503, "admin_auth_unavailable", "Auth session verification is unavailable.");
    }
    return await response.json() as AuthValidationResponse;
  } catch (error) {
    if (error instanceof AdminAuthError) throw error;
    throw new AdminAuthError(503, "admin_auth_unavailable", "Auth session verification is unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}

function sessionFromAuthUser(user: unknown): AdminUserSession {
  if (!isRecord(user)) {
    throw new AdminAuthError(401, "admin_auth_invalid", "Auth returned an invalid user session.");
  }
  const rolesValue = user.roles;
  const roles = Array.isArray(rolesValue) ? rolesValue.filter((role): role is string => typeof role === "string" && role.length > 0) : [];
  const accessLevel = resolveAdminAccessLevel(roles);
  if (!accessLevel) {
    throw new AdminAuthError(403, "admin_forbidden", "Authenticated user does not have Marketing admin access.");
  }
  return {
    user: {
      id: readString(user.id) ?? readString(user.userId) ?? readString(user.sub),
      email: readString(user.email),
      type: readString(user.type),
      roles
    },
    accessLevel
  };
}

export async function verifyAdminSession(req: Request): Promise<AdminUserSession> {
  const token = tokenFromAdminRequest(req);
  if (!token) {
    throw new AdminAuthError(401, "admin_auth_required", "Admin access requires an Auth user session.");
  }
  const validation = await postAuthValidation(token);
  if (validation.valid !== true) {
    throw new AdminAuthError(401, "admin_auth_invalid", "Auth rejected the supplied session token.");
  }
  return sessionFromAuthUser(validation.user);
}

export function requireAdminAuth(requiredLevel: AdminAccessLevel = "viewer") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      const session = await verifyAdminSession(req);
      if (!hasAdminAccessLevel(session.accessLevel, requiredLevel)) {
        return res.status(403).json({ error: "admin_forbidden", message: "Authenticated user does not have the required Marketing admin role." });
      }
      res.locals.adminSession = session;
      return next();
    } catch (error) {
      if (error instanceof AdminAuthError) {
        return res.status(error.status).json({ error: error.code, message: error.message });
      }
      return res.status(503).json({ error: "admin_auth_unavailable", message: "Auth session verification is unavailable." });
    }
  };
}

export function adminSessionResponse(session: AdminUserSession): Record<string, unknown> {
  return {
    authenticated: true,
    accessLevel: session.accessLevel,
    user: session.user
  };
}
