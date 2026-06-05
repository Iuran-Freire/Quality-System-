import { defineStore } from "pinia";

const USERS = [
    {
        id: "1",
        name: "Iuran",
        username: "iuran",
        password: "1234",
        role: "admin",
    },
    {
        id: "2",
        name: "Inspetor 1",
        username: "inspetor",
        password: "1234",
        role: "inspetor",
    },
];

export const useAuthStore = defineStore("auth", {
    state: () => ({
        user: JSON.parse(localStorage.getItem("authUser") || "null"),
    }),

    getters: {
        isLogged: (state) => !!state.user,
        userName: (state) => state.user?.name || "",
        role: (state) => state.user?.role || "",
    },

    actions: {
        login(username, password) {
            const found = USERS.find(
                (u) =>
                    u.username.toLowerCase() === String(username).toLowerCase().trim() &&
                    u.password === String(password)
            );

            if (!found) {
                throw new Error("Usuário ou senha inválidos.");
            }

            const safeUser = {
                id: found.id,
                name: found.name,
                username: found.username,
                role: found.role,
            };

            this.user = safeUser;
            localStorage.setItem("authUser", JSON.stringify(safeUser));
        },

        logout() {
            this.user = null;
            localStorage.removeItem("authUser");
        },
    },
});