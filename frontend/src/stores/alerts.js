import { defineStore } from "pinia";
import { apiFetch } from "../services/api.js";

export const useAlertsStore = defineStore("alerts", {
  state: () => ({
    items: [],
    counts: {
      new: 0,
      viewed: 0,
      resolved: 0,
    },
    loading: false,
    summaryLoading: false,
    error: "",
  }),

  getters: {
    newCount: (state) => Number(state.counts.new || 0),

    openCount: (state) =>
      Number(state.counts.new || 0) + Number(state.counts.viewed || 0),

    openItems: (state) =>
      state.items.filter((item) => item.status !== "resolved"),
  },

  actions: {
    async load(status = "") {
      this.loading = true;
      this.error = "";

      try {
        const query = status ? `?status=${encodeURIComponent(status)}` : "";
        const data = await apiFetch(`/api/alerts${query}`);

        this.items = Array.isArray(data?.items) ? data.items : [];

        return this.items;
      } catch (error) {
        this.error = error?.message || "Não foi possível carregar os alertas.";
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async loadSummary() {
      this.summaryLoading = true;

      try {
        const data = await apiFetch("/api/alerts/summary");

        this.counts = {
          new: Number(data?.newCount || 0),
          viewed: Number(data?.viewedCount || 0),
          resolved: Number(data?.resolvedCount || 0),
        };

        return data;
      } finally {
        this.summaryLoading = false;
      }
    },

    async refresh() {
      await Promise.all([this.load(), this.loadSummary()]);
    },

    async markViewed(id) {
      if (!id) return null;

      const data = await apiFetch(`/api/alerts/${id}/view`, {
        method: "PATCH",
      });

      const updated = data?.item;

      if (updated) {
        const index = this.items.findIndex(
          (item) => String(item.id) === String(updated.id)
        );

        if (index >= 0) {
          this.items[index] = updated;
        }
      }

      await this.loadSummary();

      return updated;
    },

    async markAllViewed() {
      const unreadItems = this.items.filter((item) => item.status === "new");
      if (!unreadItems.length) return [];

      const updates = await Promise.all(
        unreadItems.map((item) =>
          apiFetch(`/api/alerts/${item.id}/view`, { method: "PATCH" })
        )
      );

      const updatedById = new Map(
        updates
          .map((data) => data?.item)
          .filter(Boolean)
          .map((item) => [String(item.id), item])
      );

      this.items = this.items.map(
        (item) => updatedById.get(String(item.id)) || item
      );
      await this.loadSummary();
      return updates;
    },

    async resolve(id, resolutionNote = "") {
      if (!id) return null;

      const data = await apiFetch(`/api/alerts/${id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({
          resolutionNote,
        }),
      });

      const updated = data?.item;

      if (updated) {
        const index = this.items.findIndex(
          (item) => String(item.id) === String(updated.id)
        );

        if (index >= 0) {
          this.items[index] = updated;
        }
      }

      await this.loadSummary();

      return updated;
    },
  },
});
