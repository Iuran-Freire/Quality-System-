// src/stores/inspections.js
import { defineStore } from "pinia";
import { db } from "../db/oqcDb";
import { resolveSamplingSnapshot } from "../utils/sampling/resolveSamplingSnapshot";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
    while (out[c.id].length < n) out[c.id].push("");
  }
  return out;
}

function normalizeInspection(row = {}) {
  const x = deepClone(row);

  // defaults seguros
  x.status = x.status ?? "draft";
  x.result = x.result ?? null;

  // planSamples (produto/variável)
  x.planSamples = safeNum(x.planSamples, 5);

  // box qty (caixa)
  x.planBoxQty = safeNum(x.planBoxQty, 2);
  x.boxQty = safeNum(x.boxQty ?? x.planBoxQty, x.planBoxQty);

  // type pode faltar em inspeções antigas
  x.type = x.type ?? "";

  // chars/samples
  x.chars = Array.isArray(x.chars) ? x.chars : [];
  x.samples = ensureSamplesSized(x.chars, x.samples || {}, x);

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
        const rows = await db.inspections.orderBy("createdAt").reverse().toArray();

        // ✅ migra/normaliza inspeções antigas ao carregar
        const normalized = rows.map((r) => normalizeInspection(r));

        // ✅ opcional: persistir migração no Dexie (para não recalcular sempre)
        // Só grava se detectar diferenças importantes
        for (let i = 0; i < rows.length; i++) {
          const before = rows[i];
          const after = normalized[i];

          const changed =
            before.type !== after.type ||
            before.planSamples !== after.planSamples ||
            before.planBoxQty !== after.planBoxQty ||
            before.boxQty !== after.boxQty ||
            JSON.stringify(before.samples || {}) !== JSON.stringify(after.samples || {}) ||
            JSON.stringify(before.chars || []) !== JSON.stringify(after.chars || []);

          if (changed) {
            await db.inspections.put(after);
          }
        }

        this.items = normalized;
      } finally {
        this.loading = false;
      }
    },

    // ✅ criação recomendada: sempre a partir do plano
    async createFromPlan(plan, meta = {}) {
      const now = new Date().toISOString();

      // ✅ resolve sampling snapshot (FIXED / NBR / CLIENT)
      const samplingSnapshot = resolveSamplingSnapshot({
        plan,
        lotSize: meta.lotSize, // virá do InspModal quando for NBR 5426
      });

      // ✅ n da inspeção sempre vem do snapshot
      const planSamples = safeNum(
        samplingSnapshot.sampleN,
        safeNum(plan?.n, 5)
      );

      const planBoxQty = safeNum(plan?.boxQty, 2);

      const insp = {
        id: uid(),

        planId: plan.id,
        planName: plan.name,
        type: plan.type ?? "OQC",
        samplingSnapshot,
        pn: plan.pn,
        model: plan.model,
        client: plan.client,
        supplier: plan.supplier,
        resp: plan.resp,

        lot: meta.lot ?? "",
        shift: meta.shift ?? "",
        obs: meta.obs ?? "",

        // ✅ snapshot
        chars: deepClone(plan.chars || []),

        // ✅ amostragem
        planSamples,
        planBoxQty,
        boxQty: safeNum(meta.boxQty ?? planBoxQty, planBoxQty),

        status: "draft",
        result: null,
        createdAt: now,
      };

      insp.samples = initSamplesFromSnapshot(insp.chars, insp);

      return await this.create(insp);
    },

    async create(inspection) {
      const id = inspection.id ?? uid();
      const now = new Date().toISOString();

      const obj = {
        id,
        status: inspection.status ?? "draft",
        result: inspection.result ?? null,
        createdAt: inspection.createdAt ?? now,
        ...inspection,
      };

      const plain = normalizeInspection(obj);

      await db.inspections.put(plain);
      this.items.unshift(plain);
      return plain;
    },

    async update(id, patch) {
      const idx = this.items.findIndex((x) => x.id === id);
      if (idx === -1) return;

      const updated = {
        ...this.items[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      const plain = normalizeInspection(updated);

      await db.inspections.put(plain);
      this.items[idx] = plain;
    },

    async remove(id) {
      await db.inspections.delete(id);
      this.items = this.items.filter((x) => x.id !== id);
    },
  },
});