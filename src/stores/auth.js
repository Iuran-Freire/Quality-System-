import { defineStore } from "pinia";
import { apiFetch } from "../services/api.js";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: JSON.parse(localStorage.getItem("authUser") || "null"),
    token: localStorage.getItem("authToken") || "",
  }),

  getters: {
    isLogged: (state) => !!state.user && !!state.token,
    userName: (state) => state.user?.name || "",
    role: (state) => state.user?.role || "",
  },

  actions: {
    async login(username, password) {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      this.user = data.user;
      this.token = data.token;

      localStorage.setItem("authUser", JSON.stringify(data.user));
      localStorage.setItem("authToken", data.token);
    },

    logout() {
      this.user = null;
      this.token = "";

      localStorage.removeItem("authUser");
      localStorage.removeItem("authToken");
    },
  },
});