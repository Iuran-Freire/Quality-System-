// src/stores/plans.js
import { defineStore } from "pinia";
import { apiFetch } from "../services/api.js";

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function normalizeXrfElement(raw = {}) {
  const element = { ...raw };

  element.id = element.id || crypto.randomUUID();
  element.name = String(element.name || "").trim();
  element.max = element.max ?? "";
  element.unit = "ppm";

  return element;
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

  const hasLSL =
    c.lsl !== undefined &&
    c.lsl !== null &&
    String(c.lsl).trim() !== "";

  const hasUSL =
    c.usl !== undefined &&
    c.usl !== null &&
    String(c.usl).trim() !== "";

  if (!c.kind) {
    if (hasLSL && hasUSL) c.kind = "variavel";
    else c.kind = "visual_produto";
  }

  if (c.kind === "xrf_rohs") {
  const sn = Number(c.sampleN ?? 1);

  c.sampleN = Number.isFinite(sn) && sn > 0 ? sn : 1;
  c.sampleMode = "fixed";
  c.resultMode = null;

  c.lsl = "";
  c.usl = "";
  c.unit = "";
  c.method = c.method ?? "";
  c.category = "Químico";
  c.decimals = c.decimals ?? 3;
  c.traceOnly = false;

  c.elements = Array.isArray(c.elements)
    ? c.elements.map(normalizeXrfElement)
    : [];

  return c;
}

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

  if (c.kind === "teste_especial") {
    c.resultMode = c.resultMode || "visual";

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
  c.decimals = c.decimals ?? 3;

  return c;
}

function normalizePlan(plan = {}) {
  const p = { ...plan };

  // IMPORTANTE:
  // Agora o ID do plano vem do PostgreSQL.
  // Não criamos UUID para plano novo.
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

  const inferredBoxQty =
    charsRaw
      .map((c) => {
        const n = Number(c.sampleN);
        const fixed = c.sampleMode === "fixed";

        if (c.kind === "visual_caixa" && Number.isFinite(n) && n > 0) {
          return n;
        }

        if (fixed && Number.isFinite(n) && n > 0) {
          return n;
        }

        return null;
      })
      .find((v) => v != null) ?? null;

  const bq = Number(p.boxQty ?? inferredBoxQty ?? 2);
  p.boxQty = Number.isFinite(bq) && bq > 0 ? bq : 2;

  const s = p.sampling || {};
  const mode = String(s.mode || "fixed");

  const levelRaw = String(s.level || "II").toUpperCase().trim();
  const validLevels = ["S1", "S2", "S3", "S4", "I", "II", "III"];
  const level = validLevels.includes(levelRaw) ? levelRaw : "II";

  const aqlNum =
    s.aql == null || String(s.aql).trim() === "" ? null : Number(s.aql);

  const aql = Number.isFinite(aqlNum) && aqlNum > 0 ? aqlNum : null;

  let standard = String(s.standard || "").trim();

  if (!standard) {
    standard =
      mode === "nbr5426"
        ? "NBR 5426"
        : mode === "client"
          ? "Norma do cliente"
          : "Fixo (n)";
  }

  let clientName = String(s.clientName || "").trim();

  if (mode !== "client") {
    clientName = "";
  }

  const note = String(s.note || "").trim();

  const fixedNormalN =
  Number(s.fixedNormalN || s.normalN || p.n || 5) || 5;

const fixedReducedN =
  Number(
    s.fixedReducedN ||
      s.reducedN ||
      s.atenuadaN ||
      fixedNormalN ||
      5
  ) || 5;

const fixedTightenedN =
  Number(
    s.fixedTightenedN ||
      s.tightenedN ||
      s.severaN ||
      fixedNormalN ||
      5
  ) || 5;

p.sampling = {
  mode,
  standard,
  level,
  aql,
  clientName,
  note,

  fixedNormalN: mode === "fixed" ? fixedNormalN : null,
  fixedReducedN: mode === "fixed" ? fixedReducedN : null,
  fixedTightenedN: mode === "fixed" ? fixedTightenedN : null,
};

if (mode === "fixed") {
  const currentRegimeForSample = String(
    p.inspectionRegime || p.inspection_regime || "normal"
  )
    .trim()
    .toLowerCase();

  if (currentRegimeForSample === "atenuada") {
    p.n = fixedReducedN;
  } else if (currentRegimeForSample === "severa") {
    p.n = fixedTightenedN;
  } else {
    p.n = fixedNormalN;
  }
}

  p.chars = charsRaw.map((c) => normalizeChar(c, p.n));

  p.schemaVersion = 4;

  // Campos novos da comutação
  p.inspectionRegime =
    p.inspectionRegime || p.inspection_regime || "normal";

  p.switchingStatus =
    p.switchingStatus || p.switching_status || "sem_pendencia";

  p.suggestedRegime =
    p.suggestedRegime || p.suggested_regime || null;

  p.switchingReason =
    p.switchingReason || p.switching_reason || "";

  p.currentSampleN =
    p.currentSampleN ?? p.current_sample_n ?? null;

  p.suggestedSampleN =
    p.suggestedSampleN ?? p.suggested_sample_n ?? null;

  return p;
}

function isPersistedId(id) {
  return Number.isInteger(Number(id)) && Number(id) > 0;
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
        const data = await apiFetch("/plans");

        const rows = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.plans)
            ? data.plans
            : [];

        this.items = rows.map((p) => normalizePlan(p));
      } catch (error) {
        console.error("Erro ao carregar planos:", error);
        this.items = [];
      }
    },

    async save(plan) {
      try {
        const payload = normalizePlan(plan);

        let data;

        if (isPersistedId(payload.id)) {
          data = await apiFetch(`/plans/${payload.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        } else {
          const cleanPayload = deepClone(payload);
          delete cleanPayload.id;

          data = await apiFetch("/plans", {
            method: "POST",
            body: JSON.stringify(cleanPayload),
          });
        }

        await this.load();

        const savedPlan = data.item || data.plan || data.data || null;

        return savedPlan?.id || payload.id;
      } catch (error) {
        console.error("Erro ao salvar plano:", error);
        throw error;
      }
    },

    async remove(id) {
      try {
        await apiFetch(`/plans/${id}`, {
          method: "DELETE",
        });

        await this.load();
      } catch (error) {
        console.error("Erro ao remover plano:", error);
        throw error;
      }
    },

    async toggle(id) {
      try {
        const p = this.items.find((item) => String(item.id) === String(id));

        if (!p) return;

        const payload = {
          ...deepClone(p),
          active: !p.active,
        };

        await apiFetch(`/plans/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        await this.load();
      } catch (error) {
        console.error("Erro ao alternar status:", error);
        throw error;
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

        const blob = [
          p.name,
          p.model,
          p.client,
          p.pn,
          p.resp,
          p.type,
          p.supplier,
          p.inspectionRegime,
          p.switchingStatus,
          p.suggestedRegime,
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