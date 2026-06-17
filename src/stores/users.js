import { defineStore } from "pinia";
import { apiFetch } from "../services/api.js";

export const useUsersStore = defineStore("users", {
  state: () => ({
    items: [],
    loading: false,
    error: "",
  }),

  getters: {
    totalUsers: (state) => state.items.length,

    totalActive: (state) =>
      state.items.filter((u) => u.active).length,

    totalAdmins: (state) =>
      state.items.filter((u) => Number(u.accessLevel) === 1).length,

    totalLevel2: (state) =>
      state.items.filter((u) => Number(u.accessLevel) === 2).length,

    totalInspectors: (state) =>
      state.items.filter((u) => Number(u.accessLevel) === 3).length,
  },

  actions: {
    async load() {
      this.loading = true;
      this.error = "";

      try {
        const data = await apiFetch("/api/users");

        this.items = Array.isArray(data.users) ? data.users : [];
      } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        this.error = error?.message || "Erro ao carregar usuários.";
      } finally {
        this.loading = false;
      }
    },
  },
});