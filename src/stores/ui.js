import { defineStore } from "pinia";

export const useUiStore = defineStore("ui", {
  state: () => ({
    page: "forms", // forms | inspect | analytics
    sideOpen: false,
    q: ""
  }),
  actions: {
    setPage(p) { this.page = p; },
    toggleSide() {
      this.sideOpen = !this.sideOpen;
      document.body.classList.toggle("side-open", this.sideOpen);
    }
  }
});
