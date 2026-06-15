// src/stores/inspections.js
import { defineStore } from "pinia";
import { apiFetch } from "../services/api.js";
import { resolveSamplingSnapshot } from "../utils/sampling/resolveSamplingSnapshot";

function uid() {
  return crypto.randomUUID();
}

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function hasLimits(c) {
  const lsl = c?.lsl;
  const usl = c?.usl;
  return String(lsl ?? "").trim() !== "" && String(usl ?? "").trim() !== "";
}

function normKind(c) {
  return c?.kind || (hasLimits(c) ? "variavel" : "visual_produto");
}

function safeNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getSampleCountForChar(char, insp) {
  const kind = normKind(char);

  if (kind === "visual_caixa") {
    return safeNum(insp.boxQty ?? insp.planBoxQty, 2);
  }

  if (kind === "teste_especial") {
    return safeNum(char.sampleN, 1);
  }

  return safeNum(insp.planSamples, 5);
}

function initSamplesFromSnapshot(chars = [], insp) {
  const samples = {};

  for (const c of chars) {
    const n = getSampleCountForChar(c, insp);
    samples[c.id] = Array.from({ length: n }, () => "");
  }

  return samples;
}

function ensureSamplesSized(chars = [], samples = {}, insp) {
  const out = deepClone(samples || {});

  for (const c of chars) {
    const n = getSampleCountForChar(c, insp);

    if (!Array.isArray(out[c.id])) out[c.id] = [];

    out[c.id] = out[c.id].slice(0, n);

    while (out[c.id].length < n) {
      out[c.id].push("");
    }
  }

  return out;
}

function normalizeInspection(row = {}) {
  const x = deepClone(row);

  x.id = String(x.id || uid());

  x.status = x.status ?? "draft";
  x.result = x.result ?? null;

  x.planSamples = safeNum(x.planSamples, 5);
  x.planBoxQty = safeNum(x.planBoxQty, 2);
  x.boxQty = safeNum(x.boxQty ?? x.planBoxQty, x.planBoxQty);

  x.type = x.type ?? "IQC";

  x.chars = Array.isArray(x.chars) ? x.chars : [];
  x.samples = ensureSamplesSized(x.chars, x.samples || {}, x);

  x.sampling = x.sampling ?? x.samplingSnapshot ?? null;

  x.startedAt = x.startedAt || "";
  x.finishedAt = x.finishedAt || "";

  x.parentInspectionId =
    x.parentInspectionId ??
    x.parent_inspection_id ??
    null;

  x.isReinspection =
    x.isReinspection ??
    x.is_reinspection ??
    false;

  x.inspectionCycle = safeNum(
    x.inspectionCycle ??
    x.inspection_cycle,
    1
  );

  return x;
}

export const useInspectionsStore = defineStore("inspections", {
  state: () => ({
    items: [],
    loading: false,
  }),

  actions: {
    async load() {
      this.loading = true;

      try {
        const data = await apiFetch("/inspections");

        const rows = Array.isArray(data.items) ? data.items : [];

        this.items = rows.map((r) => normalizeInspection(r));
      } catch (error) {
        console.error("Erro ao carregar inspeções da API:", error);
        this.items = [];
      } finally {
        this.loading = false;
      }
    },

    async createFromPlan(plan, meta = {}) {
      const now = new Date().toISOString();

      const samplingSnapshot = resolveSamplingSnapshot({
        plan,
        lotSize: meta.lotSize,
      });

      const planSamples = safeNum(
        samplingSnapshot?.sampleN,
        safeNum(plan?.n, 5)
      );

      const planBoxQty = safeNum(plan?.boxQty, 2);

      const insp = {
        id: uid(),

        planId: plan.id,
        planName: plan.name,
        type: plan.type ?? "IQC",

        pn: plan.pn,
        model: plan.model,
        client: plan.client,
        supplier: plan.supplier,
        resp: plan.resp,

        lot: meta.lot ?? "",
        invoice: meta.invoice ?? "",
        lotSize: meta.lotSize ?? null,
        shift: meta.shift ?? "",
        obs: meta.obs ?? "",

        chars: deepClone(plan.chars || []),

        planSamples,
        planBoxQty,
        boxQty: safeNum(meta.boxQty ?? planBoxQty, planBoxQty),

        sampling: samplingSnapshot,

        status: "draft",
        result: null,

        startedAt: now,
        finishedAt: "",

        createdAt: now,
        updatedAt: now,
      };

      insp.samples = initSamplesFromSnapshot(insp.chars, insp);

      return await this.create(insp);
    },

    async createReinspection(originalInspection, user = {}) {
      if (!originalInspection) {
        throw new Error("Inspeção original não encontrada.");
      }

      const originalType = String(
        originalInspection.type || ""
      ).toUpperCase();

      const originalStatus = String(
        originalInspection.status || ""
      ).toLowerCase();

      const originalResult = String(
        originalInspection.result || ""
      ).toUpperCase();

      if (originalType !== "OQC") {
        throw new Error(
          "A reinspeção está disponível somente para inspeções OQC."
        );
      }

      if (originalStatus !== "done") {
        throw new Error(
          "A inspeção original ainda não foi finalizada."
        );
      }

      if (originalResult !== "FAIL") {
        throw new Error(
          "Somente inspeções OQC com resultado FAIL podem ser reinspecionadas."
        );
      }

      const rootInspectionId =
        originalInspection.parentInspectionId ||
        originalInspection.parent_inspection_id ||
        originalInspection.id;

      const existingOpenReinspection = this.items.find((item) => {
        const itemParentId =
          item.parentInspectionId ||
          item.parent_inspection_id;

        return (
          String(itemParentId || "") ===
          String(rootInspectionId) &&
          Boolean(
            item.isReinspection ??
            item.is_reinspection
          ) &&
          String(item.status || "").toLowerCase() !== "done"
        );
      });

      if (existingOpenReinspection) {
        throw new Error(
          "Já existe uma reinspeção em andamento para esta inspeção."
        );
      }

      const now = new Date().toISOString();

      const currentCycle = safeNum(
        originalInspection.inspectionCycle ??
        originalInspection.inspection_cycle,
        1
      );

      const chars = deepClone(
        originalInspection.chars || []
      );

      const newInspection = {
        id: uid(),

        planId: originalInspection.planId,
        planName: originalInspection.planName,
        type: "OQC",

        pn: originalInspection.pn,
        model: originalInspection.model,
        client: originalInspection.client,
        supplier: originalInspection.supplier,

        lot: originalInspection.lot,
        invoice: originalInspection.invoice,
        lotSize: originalInspection.lotSize ?? null,
        shift: originalInspection.shift,
        resp:
          user.name ||
          originalInspection.resp ||
          "",

        obs: `Reinspeção OQC — ciclo ${currentCycle + 1}`,

        chars,

        planSamples: safeNum(
          originalInspection.planSamples,
          5
        ),

        planBoxQty: safeNum(
          originalInspection.planBoxQty,
          2
        ),

        boxQty: safeNum(
          originalInspection.boxQty ??
          originalInspection.planBoxQty,
          2
        ),

        sampling: deepClone(
          originalInspection.sampling || null
        ),

        status: "draft",
        result: null,

        startedAt: now,
        finishedAt: "",

        createdAt: now,
        updatedAt: now,

        createdBy: user.name || "",
        createdByUser: user.username || "",
        createdByRole: user.role || "",

        finishedBy: "",
        finishedByUser: "",
        finishedByRole: "",

        parentInspectionId: rootInspectionId,
        isReinspection: true,
        inspectionCycle: currentCycle + 1,
      };

      newInspection.samples = initSamplesFromSnapshot(
        chars,
        newInspection
      );

      return await this.create(newInspection);
    },

    async create(inspection) {
      const now = new Date().toISOString();

      const obj = {
        id: inspection.id ?? uid(),
        status: inspection.status ?? "draft",
        result: inspection.result ?? null,
        startedAt: inspection.startedAt ?? now,
        finishedAt: inspection.finishedAt ?? "",
        createdAt: inspection.createdAt ?? now,
        updatedAt: inspection.updatedAt ?? now,
        ...inspection,
      };

      const payload = normalizeInspection(obj);

      const data = await apiFetch("/inspections", {
        method: "POST",
        body: JSON.stringify(deepClone(payload)),
      });

      const saved = normalizeInspection(data.item || payload);

      this.items.unshift(saved);

      return saved;
    },

    async update(id, patch) {
      const idx = this.items.findIndex((x) => String(x.id) === String(id));

      if (idx === -1) return;

      const updated = {
        ...this.items[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      const payload = normalizeInspection(updated);

      const data = await apiFetch(`/inspections/${id}`, {
        method: "PUT",
        body: JSON.stringify(deepClone(payload)),
      });

      const saved = normalizeInspection(data.item || payload);

      this.items[idx] = saved;

      return saved;
    },

    async remove(id) {
      await apiFetch(`/inspections/${id}`, {
        method: "DELETE",
      });

      this.items = this.items.filter((x) => String(x.id) !== String(id));
    },
  },
});