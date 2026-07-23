import { defineStore } from "pinia";
import { apiFetch } from "../services/api.js";

function normalizeInspectionArea(value) {
  const area = String(value || "").trim().toUpperCase();

  if (["IQC", "OQC", "ALL"].includes(area)) {
    return area;
  }

  return "";
}

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

    inspectionArea: (state) =>
      normalizeInspectionArea(state.user?.inspectionArea),

    inspectionAreaLabel: (state) => {
      const area = normalizeInspectionArea(state.user?.inspectionArea);

      if (area === "ALL") return "IQC + OQC";
      if (area === "IQC") return "IQC";
      if (area === "OQC") return "OQC";

      return "Não definida";
    },

    isActive: (state) => Boolean(state.user?.active),

    // Nível 1 e 2: controle do sistema dentro da área permitida
    canEditSystem: (state) => Number(state.user?.accessLevel || 3) <= 2,

    // Nível 1 e 2: podem criar/editar/inativar usuários
    canManageUsers: (state) => Number(state.user?.accessLevel || 3) <= 2,

    // Níveis 1, 2 e 3: podem operar inspeções na área permitida
    canOperateInspection: (state) =>
      Number(state.user?.accessLevel || 3) <= 3,

    // Mantido para não quebrar telas já existentes.
    // O filtro IQC/OQC será aplicado separadamente.
    canViewAll: (state) => Number(state.user?.accessLevel || 3) <= 3,

    isInspector: (state) => Number(state.user?.accessLevel || 3) === 3,

    canAccessInspectionArea: (state) => (type) => {
      const userArea = normalizeInspectionArea(state.user?.inspectionArea);
      const inspectionType = String(type || "").trim().toUpperCase();

      if (!["IQC", "OQC"].includes(inspectionType)) {
        return false;
      }

      return userArea === "ALL" || userArea === inspectionType;
    },
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