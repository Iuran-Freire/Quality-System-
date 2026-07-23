import { defineStore } from "pinia";
import { db } from "../db/oqcDb";

export const useInspsStore = defineStore("insps", {
  state: () => ({
    insps: [],
    filterText: "",
    filterDateFrom: "",
    filterDateTo: "",
    filterModel: "",
    filterClient: "",
    filterStatus: "",
    filterResult: "",
  }),
  actions: {
    async load() {
      this.insps = await db.insps.toArray();
    },
    async save(insp) {
      const id = insp.id || crypto.randomUUID();
      await db.insps.put({
        id,
        planId: insp.planId,
        date: insp.date,
        lot: insp.lot || "",
        resp: insp.resp || "",
        shift: insp.shift || "",
        status: insp.status ?? "draft",
        result: insp.result ?? "",
        results: insp.results ?? [],
      });
      await this.load();
      return id;
    },
    async remove(id) {
      await db.insps.delete(id);
      await this.load();
    },
    async get(id) {
      return await db.insps.get(id);
    },
  },
});
