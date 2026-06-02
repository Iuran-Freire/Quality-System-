// src/stores/plans.js
import { defineStore } from "pinia";
import { db } from "../db/oqcDb";

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

/**
 * Normaliza/migra uma característica para o novo padrão:
 * kind:
 *  - "variavel"        -> numérico (Cp/Cpk), segue plano.n/NBR
 *  - "visual_produto"  -> OK/NG por amostra, segue plano.n/NBR
 *  - "visual_caixa"    -> OK/NG por caixa, usa sampleN da própria característica
 *  - "teste_especial"  -> usa sampleN próprio e pode ser OK/NG ou numérico
 */


function normalizeChar(char = {}, planN = 5) {
  const c = { ...char };

  c.id = c.id || crypto.randomUUID();
  c.name = c.name ?? "";

  const hasLSL = c.lsl !== undefined && c.lsl !== null && String(c.lsl).trim() !== "";
  const hasUSL = c.usl !== undefined && c.usl !== null && String(c.usl).trim() !== "";

  // MIGRAÇÃO: se não existir "kind", inferir
  if (!c.kind) {
    if (hasLSL && hasUSL) c.kind = "variavel";
    else c.kind = "visual_produto";
  }

// ✅ REGRA NOVA:
// visual_caixa usa sampleN próprio definido na característica
// teste_especial usa sampleN próprio definido na característica
if (c.kind === "teste_especial") {
  const sn = Number(c.sampleN ?? 1);
  c.sampleN = Number.isFinite(sn) && sn > 0 ? sn : 1;
  c.sampleMode = "fixed";
} else if (c.kind === "visual_caixa") {
  const sn = Number(c.sampleN ?? c.boxQty ?? 2);
  c.sampleN = Number.isFinite(sn) && sn > 0 ? sn : 2;
  c.sampleMode = "fixed";
} else {
  c.sampleMode = null;
  c.sampleN = null;
}

  /// ✅ Teste especial: define modo de resultado
if (c.kind === "teste_especial") {
  c.resultMode = c.resultMode || "visual"; // "visual" | "numerico"

  if (c.resultMode === "visual") {
    c.lsl = "";
    c.usl = "";
    c.unit = c.unit ?? "";
  } else {
    c.lsl = c.lsl ?? "";
    c.usl = c.usl ?? "";
    c.unit = c.unit ?? "";
  }
} else {
  c.resultMode = null;
}

 // ✅ padronização de limites
if (c.kind === "variavel") {
  c.lsl = c.lsl ?? "";
  c.usl = c.usl ?? "";
  c.unit = c.unit ?? "";
} else if (c.kind === "teste_especial" && c.resultMode === "numerico") {
  c.lsl = c.lsl ?? "";
  c.usl = c.usl ?? "";
  c.unit = c.unit ?? "";
} else {
  c.lsl = "";
  c.usl = "";
  c.unit = c.unit ?? "";
}

  c.method = c.method ?? "";
  c.category = c.category ?? "Dimensional";

  // metadados opcionais
  c.decimals = c.decimals ?? 3;

  return c;
}

function normalizePlan(plan = {}) {
  const p = { ...plan };

  p.id = p.id || crypto.randomUUID();
  p.name = p.name || "";
  p.model = p.model || "";
  p.client = p.client || "";
  p.pn = p.pn || "";
  p.resp = p.resp || "";
  p.supplier = (p.supplier || "").trim();
  p.n = Number(p.n ?? 5) || 5;
  p.type = p.type ?? "OQC";
  p.active = p.active ?? true;

  const charsRaw = Array.isArray(p.chars) ? p.chars : [];

  // ✅ Migração de legado: se plano antigo não tinha boxQty, tenta inferir de chars antigas (sampleN)
  const inferredBoxQty =
    charsRaw
      .map((c) => {
        const n = Number(c.sampleN);
        const fixed = c.sampleMode === "fixed";
        if (c.kind === "visual_caixa" && Number.isFinite(n) && n > 0) return n;
        if (fixed && Number.isFinite(n) && n > 0) return n;
        return null;
      })
      .find((v) => v != null) ?? null;

  // ✅ REGRA NOVA: boxQty é do plano
  const bq = Number(p.boxQty ?? inferredBoxQty ?? 2);
  p.boxQty = Number.isFinite(bq) && bq > 0 ? bq : 2;

  // ✅ NOVO: normaliza sampling (NBR 5426 / fixo / cliente)
  // defaults (plano antigo = fixo usando n)
 const s = p.sampling || {};
 const mode = String(s.mode || "fixed"); // "fixed" | "nbr5426" | "client"

 const levelRaw = String(s.level || "II").toUpperCase().trim();

 const validLevels = ["S1", "S2", "S3", "S4", "I", "II", "III"];

 const level = validLevels.includes(levelRaw) ? levelRaw : "II";

  // aql/nqa
  const aqlNum = s.aql == null || String(s.aql).trim() === "" ? null : Number(s.aql);
  const aql = Number.isFinite(aqlNum) && aqlNum > 0 ? aqlNum : null;

  // standard label
  let standard = String(s.standard || "").trim();
  if (!standard) standard = mode === "nbr5426" ? "NBR 5426" : mode === "client" ? "Norma do cliente" : "Fixo (n)";

  // clientName
  let clientName = String(s.clientName || "").trim();
  if (mode !== "client") clientName = "";

  // note
  const note = String(s.note || "").trim();

  p.sampling = {
    mode,          // fixed | nbr5426 | client
    standard,      // texto para PDF/UI
    level,         // S1 | S2 | S3 | S4 | I | II | III (NBR)
    aql,           // number|null
    clientName,    // string (somente modo client)
    note,          // string opcional
  };

  // normaliza chars já no novo padrão
  p.chars = charsRaw.map((c) => normalizeChar(c, p.n));

  // ✅ versão do schema (atualizada por causa de sampling)
  p.schemaVersion = 4;

  return p;
}

export const usePlansStore = defineStore("plans", {
  state: () => ({
    items: [],
    filterModel: "",
    filterClient: "",
    filterText: "",
  }),

  actions: {
    async load() {
      try {
        const rows = await db.plans.toArray();

        // normaliza/migra todos ao carregar
        const normalized = rows.map((p) => normalizePlan(p));

        // ✅ persiste migração no Dexie (para não ficar migrando sempre)
        for (let i = 0; i < rows.length; i++) {
          const before = rows[i];
          const after = normalized[i];

          const changed =
            before.boxQty !== after.boxQty ||
            before.type !== after.type ||
            before.n !== after.n ||
            before.schemaVersion !== after.schemaVersion ||
            JSON.stringify(before.chars || []) !== JSON.stringify(after.chars || []);

          if (changed) {
            await db.plans.put(deepClone(after));
          }
        }

        this.items = normalized;
      } catch (error) {
        console.error("Erro ao carregar planos:", error);
      }
    },

    async save(plan) {
      try {
        const payload = normalizePlan(plan);

        await db.plans.put(deepClone(payload));
        await this.load();
        return payload.id;
      } catch (error) {
        console.error("Erro ao salvar plano:", error);
        throw error;
      }
    },

    async remove(id) {
      try {
        await db.plans.delete(id);
        await this.load();
      } catch (error) {
        console.error("Erro ao remover plano:", error);
      }
    },

    async toggle(id) {
      try {
        const p = await db.plans.get(id);
        if (!p) return;
        p.active = !p.active;
        await db.plans.put(p);
        await this.load();
      } catch (error) {
        console.error("Erro ao alternar status:", error);
      }
    },
  },

  getters: {
    filtered(state) {
      const m = state.filterModel.toLowerCase();
      const c = state.filterClient.toLowerCase();
      const t = state.filterText.toLowerCase();

      return state.items.filter((p) => {
        const modelHit = !m || (p.model || "").toLowerCase().includes(m);
        const clientHit = !c || (p.client || "").toLowerCase().includes(c);

        const blob = [p.name, p.model, p.client, p.pn, p.resp, p.type, p.supplier]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const textHit = !t || blob.includes(t);
        return modelHit && clientHit && textHit;
      });
    },
  },
});