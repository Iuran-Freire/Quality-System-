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
    username: (state) => state.user?.username || "",
    role: (state) => state.user?.role || "",

    matricula: (state) => state.user?.matricula || "",
    cargo: (state) => state.user?.cargo || "",

    accessLevel: (state) => Number(state.user?.accessLevel || 3),

    isActive: (state) => Boolean(state.user?.active),

    // Nível 1 e 2: controle total
    canEditSystem: (state) => Number(state.user?.accessLevel || 3) <= 2,

    // Nível 1 e 2: podem criar/editar/inativar usuários
    canManageUsers: (state) => Number(state.user?.accessLevel || 3) <= 2,

    // Níveis 1, 2 e 3: podem operar inspeções
    canOperateInspection: (state) => Number(state.user?.accessLevel || 3) <= 3,

    // Níveis 1, 2 e 3: podem visualizar tudo
    canViewAll: (state) => Number(state.user?.accessLevel || 3) <= 3,

    isInspector: (state) => Number(state.user?.accessLevel || 3) === 3,
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