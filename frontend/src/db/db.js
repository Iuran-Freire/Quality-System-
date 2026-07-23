import Dexie from "dexie";

export const db = new Dexie("oqc_mvp");

db.version(1).stores({
  plans: "id, createdAt, updatedAt, active, type, model, name, client, resp, pn",
  insps: "id, createdAt, updatedAt, status, result, model, client, pn, planId"
});
