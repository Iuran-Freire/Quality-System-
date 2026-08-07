import { db } from "../db.js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let tableReady = false;

async function ensureAuditTable() {
  if (tableReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      action VARCHAR(20) NOT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id TEXT,
      route TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      user_id TEXT,
      user_name TEXT,
      username TEXT,
      access_level INTEGER,
      inspection_area VARCHAR(10),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at DESC)
  `);

  tableReady = true;
}

function entityTypeFromRoute(baseUrl = "") {
  return String(baseUrl).replace(/^\/api\//, "").replace(/^\//, "") || "system";
}

export function auditMutations(req, res, next) {
  if (!MUTATION_METHODS.has(req.method)) return next();

  res.on("finish", async () => {
    if (!req.user || res.statusCode >= 500) return;

    try {
      await ensureAuditTable();

      const metadata = {
        planId: req.body?.planId ?? req.body?.plan_id ?? null,
        type: req.body?.type ?? null,
        status: req.body?.status ?? null,
        result: req.body?.result ?? null,
        lot: req.body?.lot ?? null,
        invoice: req.body?.invoice ?? null,
      };

      await db.query(
        `INSERT INTO audit_logs (
          action, entity_type, entity_id, route, status_code,
          user_id, user_name, username, access_level,
          inspection_area, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          req.method,
          entityTypeFromRoute(req.baseUrl),
          req.params?.id ?? req.params?.planId ?? null,
          req.originalUrl,
          res.statusCode,
          req.user.id ?? null,
          req.user.name ?? null,
          req.user.username ?? null,
          Number(req.user.accessLevel ?? 3),
          req.user.inspectionArea ?? null,
          JSON.stringify(metadata),
        ]
      );
    } catch (error) {
      console.error("Falha ao registrar auditoria:", error.message);
    }
  });

  next();
}
