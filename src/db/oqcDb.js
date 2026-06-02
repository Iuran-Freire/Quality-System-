import Dexie from "dexie";

export const db = new Dexie("oqc_mvp");

db.version(2).stores({
  plans: "id, model, client, pn",
  inspections: "id, planId, createdAt, status, result, lot, model, client, pn",
});

// ✅ versão nova: adiciona boxQty no plano + type/boxQty snapshot na inspeção
db.version(3)
  .stores({
    plans: "id, model, client, pn, boxQty, type",
    inspections:
      "id, planId, createdAt, status, result, lot, model, client, pn, type, planBoxQty, boxQty",
  })
  .upgrade(async (tx) => {
    // default em planos antigos
    await tx.table("plans").toCollection().modify((p) => {
      if (p.boxQty == null) p.boxQty = 2;
      if (p.type == null) p.type = "OQC";
    });

    // default em inspeções antigas (para não quebrar filtros)
    await tx.table("inspections").toCollection().modify((i) => {
      if (i.planBoxQty == null) i.planBoxQty = 2;
      if (i.boxQty == null) i.boxQty = i.planBoxQty ?? 2;
      if (i.type == null) i.type = ""; // deixa vazio (inspeções antigas)
    });
  });