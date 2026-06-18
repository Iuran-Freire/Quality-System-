import { defineStore } from "pinia";
import { apiFetch } from "../services/api.js";

export const useSwitchingStore = defineStore("switching", {
  state: () => ({
    hasPassword: false,
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
  },
});