import { defineStore } from "pinia";
import { apiFetch } from "../services/api.js";

export const useSwitchingStore = defineStore("switching", {
 state: () => ({
  hasPassword: false,
  history: [],
  loading: false,
  error: "",
}),

  actions: {
    async loadPasswordStatus() {
      this.loading = true;
      this.error = "";

      try {
        const data = await apiFetch("/api/switching/password-status");
        this.hasPassword = Boolean(data.hasPassword);
      } catch (error) {
        console.error("Erro ao carregar status da senha de comutação:", error);
        this.error =
          error?.message || "Erro ao carregar status da senha de comutação.";
      } finally {
        this.loading = false;
      }
    },

       async savePassword(password, confirmPassword) {
      const data = await apiFetch("/api/switching/password", {
        method: "POST",
        body: JSON.stringify({
          password,
          confirmPassword,
        }),
      });

      this.hasPassword = Boolean(data.hasPassword);

      return data;
    },

    async analyzePlan(planId) {
      const data = await apiFetch(`/api/switching/plans/${planId}/analyze`);

      return data;
    },

    async suggestPlan(planId) {
      const data = await apiFetch(`/api/switching/plans/${planId}/suggest`, {
        method: "POST",
      });

      return data;
    },

    async approvePlan(planId, password, approvedBy) {
      const data = await apiFetch(`/api/switching/plans/${planId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          password,
          approvedBy,
        }),
      });

      return data;
    },

    async loadHistory() {
  this.loading = true;
  this.error = "";

  try {
    const data = await apiFetch("/api/switching/history");

    this.history = Array.isArray(data.items) ? data.items : [];

    return this.history;
  } catch (error) {
    console.error("Erro ao carregar histórico de comutação:", error);
    this.error = error?.message || "Erro ao carregar histórico de comutação.";
    this.history = [];
    return [];
  } finally {
    this.loading = false;
  }
},
  },
});