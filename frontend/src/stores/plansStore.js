import { defineStore } from "pinia";
import { db } from "../db/oqcDb";

/**
 * Normaliza/migra uma característica para o novo padrão:
 * kind:
 *  - "variavel"        -> numérico (Cp/Cpk)
 *  - "visual_produto"  -> OK/NG por amostra (segue plan.n)
 *  - "visual_caixa"    -> OK/NG por caixa (quantidade própria)
 *
 * sampleMode:
 *  - "plan"  -> usa plan.n
 *  - "fixed" -> usa char.sampleN
 */
function normalizeChar(char = {}, planN = 5) {
  const c = { ...char };

  // id e nome
  c.id = c.id || crypto.randomUUID();
  c.name = c.name ?? "";

  // detecta se tem limites numéricos (para inferir chars antigas)
  const hasLSL =
    c.lsl !== undefined && c.lsl !== null && String(c.lsl).trim() !== "";
  const hasUSL =
    c.usl !== undefined && c.usl !== null && String(c.usl).trim() !== "";

  // MIGRAÇÃO: se não existir kind, inferir
  if (!c.kind) {
    if (hasLSL && hasUSL) c.kind = "variavel";
    else c.kind = "visual_produto";
  }

  // padrão de amostragem
  if (!c.sampleMode) {
    c.sampleMode = c.kind === "visual_caixa" ? "fixed" : "plan";
  }

  // quantidade fixa quando "fixed" (caixa)
  if (c.sampleMode === "fixed") {
    const n = Number(c.sampleN);
    c.sampleN = Number.isFinite(n) && n > 0 ? n : 2; // default 2 caixas
  } else {
    c.sampleN = null; // segue plan.n
  }

  // variavel precisa dos 2 limites
  if (c.kind === "variavel") {
    if (!(hasLSL && hasUSL)) {
      // se marcou variavel sem limites, corrige pra visual_produto
      c.kind = "visual_produto";
      c.sampleMode = "plan";
      c.sampleN = null;
    }
  }

  // visuais não precisam de limites
  if (c.kind !== "variavel") {
    c.lsl = null;
    c.usl = null;
  }

  // extras úteis (opcionais)
  c.unit = c.unit ?? "";        // ex: mm, V, A...
  c.decimals = c.decimals ?? 3; // exibição

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

  const chars = Array.isArray(p.chars) ? p.chars : [];
  p.chars = chars.map((c) => normalizeChar(c, p.n));

  // marca versão do schema (pra controle)
  p.schemaVersion = p.schemaVersion ?? 2;

  return p;
}

export const usePlansStore = defineStore("plans", {
  state: () => ({
    plans: [],
    filterModel: "",
    filterClient: "",
    filterText: "",
  }),

  actions: {
    async load() {
      try {
        const rows = await db.plans.toArray();

        // normaliza/migra tudo ao carregar
        this.plans = rows.map((p) => normalizePlan(p));
      } catch (e) {
        console.error("Erro ao carregar planos:", e);
      }
    },

    async save(plan) {
      try {
        const payload = normalizePlan(plan);

        await db.plans.put(payload);
        await this.load();
        return payload.id;
      } catch (e) {
        console.error("Erro ao salvar plano:", e);
        throw e;
      }
    },

    async remove(id) {
      try {
        await db.plans.delete(id);
        await this.load();
      } catch (e) {
        console.error("Erro ao remover plano:", e);
      }
    },

    async toggle(id) {
      try {
        const p = await db.plans.get(id);
        if (!p) return;
        p.active = !p.active;
        await db.plans.put(p);
        await this.load();
      } catch (e) {
        console.error("Erro ao alternar status:", e);
      }
    },
  },

  getters: {
    // mantém compatível com seu código atual
    items(state) {
      return state.plans;
    },

    filtered(state) {
      const m = state.filterModel.toLowerCase();
      const c = state.filterClient.toLowerCase();
      const t = state.filterText.toLowerCase();

      return state.plans.filter((p) => {
        const modelHit = !m || (p.model || "").toLowerCase().includes(m);
        const clientHit = !c || (p.client || "").toLowerCase().includes(c);

        const blob = [
          p.name,
          p.model,
          p.client,
          p.pn,
          p.resp,
          p.type,
          p.supplier,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const textHit = !t || blob.includes(t);
        return modelHit && clientHit && textHit;
      });
    },
  },
});
