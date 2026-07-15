import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./styles/main.css";
import "./styles/design-system.css";
import "./styles/modals.css";
import "./styles/plans-table.css";
import "./styles/alerts.css";
import "./styles/shell.css";
import "./styles/management.css";
import "./styles/switching.css";
import "./styles/badges.css";

createApp(App).use(createPinia()).mount("#app");
