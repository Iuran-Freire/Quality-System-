// src/utils/pdf.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


function getCharKind(c) {
  return c?.kind || c?.type || "visual_produto";
}

function getSpecialMode(c) {
  const mode = String(
    c?.resultMode ??
    c?.mode ??
    c?.specialMode ??
    ""
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    mode === "numerico" ||
    mode === "numeric" ||
    mode === "number" ||
    mode === "numero"
  ) {
    return "numerico";
  }

  // No PlanModal, Teste Especial OK/NG está salvo como resultMode: "visual"
  // Então qualquer teste especial que não seja numérico deve ser tratado como OK/NG.
  return "ok_ng";
}

function isSpecialOkNg(c) {
  return isSpecialChar(c) && getSpecialMode(c) !== "numerico";
}

function isSpecialChar(c) {
  return getCharKind(c) === "teste_especial";
}

function isSpecialNumeric(c) {
  return isSpecialChar(c) && getSpecialMode(c) === "numerico";
}

function isNumericChar(c) {
  return getCharKind(c) === "variavel" || isSpecialNumeric(c);
}

function isVisualChar(c) {
  const kind = getCharKind(c);

  return (
    kind === "visual_produto" ||
    kind === "visual_caixa" ||
    isSpecialOkNg(c)
  );
}

function charTypeLabel(c) {
  const kind = getCharKind(c);

  if (kind === "variavel") return "Variável";
  if (kind === "visual_produto") return "Visual (Produto)";
  if (kind === "visual_caixa") return "Visual (Caixa)";
  if (isSpecialNumeric(c)) return "Teste Esp. Numérico";
  if (isSpecialOkNg(c)) return "Teste Esp. OK/NG";

  return "Característica";
}

function getCharSampleCount(c, insp) {
  const kind = getCharKind(c);

  if (kind === "visual_caixa") {
    return Number(insp?.boxQty ?? insp?.planBoxQty ?? 2) || 2;
  }

  if (isSpecialChar(c)) {
    return Number(c?.sampleN ?? c?.n ?? c?.samples ?? 1) || 1;
  }

  return Number(
    insp?.sampling?.sampleN ??
    insp?.planSamples ??
    insp?.sampleN ??
    insp?.n ??
    1
  ) || 1;
}

function toNumber(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normVisual(v) {
  const s = String(v ?? "").trim().toUpperCase();

  if (!s) return "";
  if (s === "OK" || s === "PASS") return "OK";
  if (s === "NG" || s === "NOK" || s === "FAIL") return "NG";

  return "";
}

function safe(s) {
  return String(s || "").replace(/[\\/:*?"<>|]/g, "-").trim();
}
function parseDateTime(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();

  /*
   * Quando o PostgreSQL retorna uma data sem fuso:
   *
   * 2026-06-12 16:18:22
   *
   * tratamos como horário local para impedir que o navegador
   * adicione ou retire horas indevidamente.
   */
  const localTimestampPattern =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

  const match = raw.match(localTimestampPattern);

  if (match) {
    const [, year, month, day, hour, minute, second = "0"] = match;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  /*
   * Valores com Z ou offset continuam sendo convertidos normalmente:
   *
   * 2026-06-12T20:18:22.000Z
   * 2026-06-12T16:18:22-04:00
   */
  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

function fmtDate(value) {
  const date = parseDateTime(value);

  if (!date) return "-";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateTime(value) {
  const date = parseDateTime(value);

  if (!date) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function userWithDateTime(name, role, dateTime) {
  const user = name || "Não informado";
  const roleText = role ? ` (${role})` : "";

  const dateTimeText = dateTime
    ? ` / ${fmtDateTime(dateTime)}`
    : " / Data não informada";

  return `${user}${roleText}${dateTimeText}`;
}
function fmtTime(value) {
  const date = parseDateTime(value);

  if (!date) return "-";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function charTraceSummary(c) {
  const startedUser = c.startedBy || c.startedByUser || "Não informado";
  const finishedUser = c.finishedBy || c.finishedByUser || startedUser;

  const startedAt = c.startedAt ? fmtTime(c.startedAt) : "-";
  const finishedAt = c.finishedAt ? fmtTime(c.finishedAt) : "-";

  if (startedUser === finishedUser) {
    return `Trace: ${startedUser} ${startedAt} - ${finishedAt}`;
  }

  return `Trace: ${startedUser} ${startedAt} - ${finishedUser} ${finishedAt}`;
}

function summaryWithTrace(summary, c) {
  return `${summary || "-"}\n${charTraceSummary(c)}`;
}
function normKind(c) {
  return getCharKind(c);
}
function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function stdevSample(nums) {
  if (nums.length < 2) return null;
  const m = mean(nums);
  const varSum = nums.reduce((acc, x) => acc + (x - m) ** 2, 0);
  return Math.sqrt(varSum / (nums.length - 1));
}
function calcCpkForChar(char, samplesObj) {
  if (getCharKind(char) !== "variavel") return null;

  const lsl = toNumber(char.lsl ?? char.min);
  const usl = toNumber(char.usl ?? char.max);
  if (lsl == null || usl == null) return null;

  const raw = samplesObj?.[char.id] || [];
  const nums = raw.map(toNumber).filter((n) => n != null);
  if (nums.length < 2) return null;

  const m = mean(nums);
  const s = stdevSample(nums);
  if (!s || s === 0) return null;

  const cp = (usl - lsl) / (6 * s);
  const cpu = (usl - m) / (3 * s);
  const cpl = (m - lsl) / (3 * s);
  const cpk = Math.min(cpu, cpl);

  return { n: nums.length, mean: m, stdev: s, cp, cpk };
}
function fmt(v, d = 3) {
  if (v == null || !Number.isFinite(v)) return "-";
  return Number(v).toFixed(d);
}
function getBoxQty(insp) {
  const raw = Number(insp?.boxQty ?? insp?.planBoxQty ?? 2);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}
function getPlanSamples(insp) {
  const raw = Number(insp?.planSamples ?? 5);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

// -------- Logo sem distorção --------
function getImageTypeFromDataUrl(dataUrl) {
  const head = String(dataUrl || "").slice(0, 60).toLowerCase();
  if (head.includes("image/png")) return "PNG";
  if (head.includes("image/jpeg") || head.includes("image/jpg")) return "JPEG";
  return "PNG";
}
function getPngSize(bytes) {
  const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return { w: Math.abs(w), h: Math.abs(h) };
}
function getJpegSize(bytes) {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    const size = (bytes[i + 2] << 8) + bytes[i + 3];
    if (marker === 0xc0 || marker === 0xc2) {
      const h = (bytes[i + 5] << 8) + bytes[i + 6];
      const w = (bytes[i + 7] << 8) + bytes[i + 8];
      return { w, h };
    }
    i += 2 + size;
  }
  return null;
}
function getImageSizeFromDataUrl(dataUrl) {
  try {
    const base64 = String(dataUrl).split(",")[1] || "";
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (isPng) return getPngSize(bytes);

    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (isJpeg) return getJpegSize(bytes);

    return null;
  } catch {
    return null;
  }
}
function addLogo(doc, dataUrl, x, y, maxW, maxH) {
  if (!dataUrl) return;
  const type = getImageTypeFromDataUrl(dataUrl);
  const size = getImageSizeFromDataUrl(dataUrl);

  let w = maxW;
  let h = maxH;

  if (size?.w && size?.h) {
    const ratio = size.w / size.h;
    w = maxW;
    h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
  }
  doc.addImage(dataUrl, type, x, y, w, h);
}

// -------- Resumos --------
function summarizeVisual(samples, expectedN) {
  const arr = (samples || []).map(normVisual);
  const ok = arr.filter((v) => v === "OK").length;
  const ng = arr.filter((v) => v === "NG").length;
  const filled = ok + ng;
  if (!filled) return `— (0/${expectedN})`;
  return `OK: ${ok} | NG: ${ng} (${filled}/${expectedN})`;
}
function summarizeVariable(samples) {
  const nums = (samples || []).map(toNumber).filter((n) => n != null);
  if (!nums.length) return "—";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return `Mín: ${fmt(min, 3)} | Máx: ${fmt(max, 3)} (n=${nums.length})`;
}

// -------- Estilo --------
const COLORS = {
  headFill: [220, 220, 220],
  grid: [190, 190, 190],
  text: [40, 40, 40],
  muted: [110, 110, 110],
  pass: [34, 153, 84],
  fail: [192, 57, 43],
};

function sectionTitle(doc, text, x, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.text);
  doc.text(text, x, y);
  doc.setFont("helvetica", "normal");
}

function badgeResult(doc, x, y, result) {
  const isFail = String(result || "").toUpperCase() === "FAIL";
  const label = isFail ? "FAIL" : "PASS";
  const fill = isFail ? COLORS.fail : COLORS.pass;

  doc.setFillColor(...fill);
  doc.roundedRect(x, y - 5.2, 24, 7.5, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(label, x + 12, y, { align: "center" });

  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
}

function commonTableStyle(fontSize = 9) {
  return {
    theme: "grid",
    styles: {
      fontSize,
      cellPadding: 2.2,
      textColor: COLORS.text,
      lineColor: COLORS.grid,
      lineWidth: 0.15,
    },
    headStyles: { fillColor: COLORS.headFill, textColor: COLORS.text, fontStyle: "bold" },
    bodyStyles: { fillColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  };
}

// ---------- helpers para página 2 compacta ----------
function catOfChar(c) {
  const cat = String(c?.category || "").trim().toLowerCase();
  if (cat.includes("func")) return "FUNCIONAL";
  if (cat.includes("dim")) return "DIMENSIONAL";
  if (cat.includes("visual") || cat.includes("apar")) return "VISUAL";
  // fallback: variavel -> dimensional, visual -> visual
  if (isSpecialChar(c)) return "FUNCIONAL";
  return getCharKind(c) === "variavel" ? "DIMENSIONAL" : "VISUAL";
}
function shortName(name) {
  const s = String(name || "").trim();
  if (!s) return "—";
  return s.length > 18 ? s.slice(0, 18) + "…" : s;
}
function maxSampleLenFor(chars, samplesObj, fallbackN) {
  let m = 0;
  for (const c of chars) {
    const arr = samplesObj?.[c.id];
    if (Array.isArray(arr)) m = Math.max(m, arr.length);
  }
  return m || fallbackN;
}

export function exportInspectionPdf(insp, opts = {}) {
  if (!insp) return;
    const originalInspection = opts.originalInspection || null;
  const isReinspection = Boolean(insp?.isReinspection);

  const inspectionTypeText = isReinspection
    ? `${insp.type || "OQC"} — Reinspeção ciclo ${insp.inspectionCycle || 2}`
    : insp.type || "-";

  const originalInspectionText = originalInspection
    ? `${originalInspection.pn || "PN não informado"} — ${
        originalInspection.model || "Modelo não informado"
      } — ${originalInspection.planName || "Plano não informado"}`
    : "Inspeção original não localizada";

  const originalLotInvoiceText = originalInspection
    ? `Lote: ${originalInspection.lot || "—"} | NF: ${
        originalInspection.invoice || "—"
      }`
    : "—";
  if (insp.status !== "done") {
    alert("Somente inspeções finalizadas podem gerar PDF.");
    return;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const M = 14;
  const COL_GAP = 8;
  const colW = (pageWidth - M * 2 - COL_GAP) / 2;

  const planSamples = getPlanSamples(insp);
  const boxQty = getBoxQty(insp);
  const hasVisualCaixa = (insp.chars || []).some((c) => normKind(c) === "visual_caixa");

  // ===== Header clean =====
  if (opts.logoDataUrl) {
    try { addLogo(doc, opts.logoDataUrl, M, 8, 30, 12); } catch { }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.text("RELATÓRIO DE INSPEÇÃO", pageWidth / 2, 16, { align: "center" });
  doc.setDrawColor(...COLORS.grid);
  doc.setLineWidth(0.3);
  doc.line(M, 24, pageWidth - M, 24);

  // Resultado
  sectionTitle(doc, "Resultado", M, 33);
  badgeResult(doc, M + 24, 33, insp.result || "—");

  // Dados
  sectionTitle(doc, "Dados da inspeção", M, 43);

const startedDateTime =
  insp.startedAt ||
  insp.started_at ||
  insp.createdAt ||
  insp.created_at;

const finishedDateTime =
  insp.finishedAt ||
  insp.finished_at;

const startedUser =
  insp.createdBy ||
  insp.createdByUser ||
  insp.inspector_name ||
  insp.inspectorName;

const finishedUser =
  insp.finishedBy ||
  insp.finishedByUser ||
  insp.inspector_name ||
  insp.inspectorName;

const left = [
  ["Plano", insp.planName || "-"],
  ["Tipo", inspectionTypeText],
  ...(isReinspection
    ? [
        ["Origem", originalInspectionText],
        ["Lote/NF origem", originalLotInvoiceText],
      ]
    : []),
  ["Modelo", insp.model || "-"],
  ["Cliente", insp.client || "-"],
  ["Fornecedor", insp.supplier || "-"],
  [
    "Iniciado por:",
    userWithDateTime(
      startedUser,
      insp.createdByRole,
      startedDateTime
    ),
  ],
  [
    "Finalizado por:",
    userWithDateTime(
      finishedUser,
      insp.finishedByRole,
      finishedDateTime
    ),
  ],
];
const right = [
  ["Data", fmtDate(startedDateTime || finishedDateTime)],
  ["PN", insp.pn || "-"],
  ["Lote", insp.lot || "-"],
  ["Invoice / NF", insp.invoice || "-"],
  ["Turno", insp.shift || "-"],
  ["Responsável", insp.resp || "-"],
  ["Amostras (plano)", String(planSamples)],
  ...(hasVisualCaixa
    ? [["Qtd. Caixas (plano)", String(boxQty)]]
    : []),
];

  autoTable(doc, {
  ...commonTableStyle(9),
  startY: 47,
  body: left,
  margin: { left: M },
  tableWidth: colW,
  columnStyles: {
    0: { cellWidth: 32, fontStyle: "bold", textColor: COLORS.muted },
    1: { cellWidth: colW - 32 },
  },
});

const leftTableFinalY = doc.lastAutoTable?.finalY || 90;

 autoTable(doc, {
  ...commonTableStyle(9),
  startY: 47,
  body: right,
  margin: { left: M + colW + COL_GAP },
  tableWidth: colW,
  columnStyles: {
    0: { cellWidth: 34, fontStyle: "bold", textColor: COLORS.muted },
    1: { cellWidth: colW - 34 },
  },
});

const rightTableFinalY = doc.lastAutoTable?.finalY || 90;;

  const yAfterData = Math.max(leftTableFinalY, rightTableFinalY);

  // Características (resumo)
  sectionTitle(doc, "Características", M, yAfterData + 12);

  const chars = insp.chars || [];
  const samplesObj = insp.samples || {};

  const characteristicRows = [];
  const specialRows = [];

for (const c of chars) {
  const rawSamples = samplesObj[c.id] || [];
  const expectedN = getCharSampleCount(c, insp);
  const cpk = calcCpkForChar(c, samplesObj);
  const isSpecial = isSpecialChar(c);

 if (isSpecial) {
  if (isSpecialNumeric(c)) {
    specialRows.push([
      c.name || "Teste especial",
      "Numérico",
      `${c.lsl ?? c.min ?? "-"} / ${c.usl ?? c.max ?? "-"}`,
      String(expectedN),
      summaryWithTrace(summarizeVariable(rawSamples), c),
    ]);
  } else {
    specialRows.push([
      c.name || "Teste especial",
      "OK/NG",
      "-",
      String(expectedN),
      summaryWithTrace(summarizeVisual(rawSamples, expectedN), c),
    ]);
  }

  continue;
}

  if (isNumericChar(c)) {
  characteristicRows.push([
    c.name || "Característica",
    charTypeLabel(c),
    `${c.lsl ?? c.min ?? "-"} / ${c.usl ?? c.max ?? "-"}`,
    String(expectedN),
    cpk ? fmt(cpk.mean, 4) : "-",
    cpk ? fmt(cpk.stdev, 4) : "-",
    cpk ? fmt(cpk.cp, 2) : "-",
    cpk ? fmt(cpk.cpk, 2) : "-",
    summaryWithTrace(summarizeVariable(rawSamples), c),
  ]);
} else if (isVisualChar(c)) {
  characteristicRows.push([
    c.name || "Característica",
    charTypeLabel(c),
    "-",
    String(expectedN),
    "-",
    "-",
    "-",
    "-",
    summaryWithTrace(summarizeVisual(rawSamples, expectedN), c),
  ]);
}
}

  autoTable(doc, {
    theme: "grid",
    startY: yAfterData + 16,
    margin: { left: M, right: M },
    styles: {
      fontSize: 8.2,
      cellPadding: 2.1,
      overflow: "linebreak",
      lineColor: COLORS.grid,
      lineWidth: 0.15,
      textColor: COLORS.text,
    },
    headStyles: { fillColor: COLORS.headFill, fontStyle: "bold", textColor: COLORS.text },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    head: [[
      "Característica",
      "Tipo",
      "Mín/Máx",
      "N",
      "Média",
      "s",
      "Cp",
      "Cpk",
      "Resumo",
    ]],
    body: characteristicRows,
    columnStyles: {
     0: { cellWidth: 42 },
     1: { cellWidth: 20 },
     2: { cellWidth: 18 },
     3: { cellWidth: 8 },
     4: { cellWidth: 13 },
     5: { cellWidth: 13 },
     6: { cellWidth: 11 },
     7: { cellWidth: 11 },
     8: { cellWidth: "auto" },
   },
  });

  let yAfterMainTables = doc.lastAutoTable?.finalY || 200;

if (specialRows.length) {
  sectionTitle(doc, "Testes Especiais", M, yAfterMainTables + 10);

  autoTable(doc, {
    theme: "grid",
    startY: yAfterMainTables + 14,
    margin: { left: M, right: M },
    styles: {
      fontSize: 8,
      cellPadding: 2.1,
      overflow: "linebreak",
      lineColor: COLORS.grid,
      lineWidth: 0.15,
      textColor: COLORS.text,
    },
    headStyles: {
      fillColor: COLORS.headFill,
      fontStyle: "bold",
      textColor: COLORS.text,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    head: [["Teste", "Tipo", "Mín/Máx", "N", "Resumo"]],
    body: specialRows,
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 24 },
      2: { cellWidth: 28 },
      3: { cellWidth: 10 },
      4: { cellWidth: "auto" },
    },
  });

  yAfterMainTables = doc.lastAutoTable?.finalY || yAfterMainTables;
}

 // Observações
const yAfterChars = yAfterMainTables;
sectionTitle(doc, "Observações", M, yAfterChars + 12);
  autoTable(doc, {
    ...commonTableStyle(9),
    startY: yAfterChars + 16,
    margin: { left: M, right: M },
    body: [[insp.obs?.trim() ? insp.obs.trim() : "—"]],
    columnStyles: { 0: { cellWidth: "auto" } },
  });

  // Assinaturas
  const yAfterObs = doc.lastAutoTable?.finalY || 240;
  sectionTitle(doc, "Assinaturas", M, yAfterObs + 12);
  autoTable(doc, {
    ...commonTableStyle(9),
    startY: yAfterObs + 16,
    margin: { left: M, right: M },
    head: [["Responsável", "Qualidade", "Data"]],
    body: [[
  insp.resp || "—",
  "__________________",
  fmtDate(
    finishedDateTime ||
      startedDateTime
  ),
]],
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 70 },
      2: { cellWidth: "auto" },
    },
  });

  // Rodapé página 1
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);

  // ===== Página 2: AMOSTRAS BRUTAS (compacta e inteligente) =====
  if (opts.includeRawSamples) {
    doc.addPage();

    // Header clean
    if (opts.logoDataUrl) {
      try { addLogo(doc, opts.logoDataUrl, M, 8, 30, 12); } catch { }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.text);
    doc.text("AMOSTRAS BRUTAS (AGRUPADAS)", pageWidth / 2, 16, { align: "center" });
    doc.setDrawColor(...COLORS.grid);
    doc.setLineWidth(0.3);
    doc.line(M, 24, pageWidth - M, 24);

    // ---- agrupamento ----
    const byCat = { DIMENSIONAL: [], FUNCIONAL: [], VISUAL: [] };
    for (const c of chars) byCat[catOfChar(c)].push(c);

    let y = 32;

    // ============================
    // 1) VARIÁVEIS: juntar quando couber
    // ============================
    const dimVars = byCat.DIMENSIONAL.filter((c) => isNumericChar(c));
    const funcVars = byCat.FUNCIONAL.filter((c) => isNumericChar(c));
    const varsAll = [...dimVars, ...funcVars];

    // ajuste o limite conforme seu layout (A4). 6~8 costuma ficar bom.
    const LIMITE_COLUNAS = 6;

    function renderVarsTable(title, list) {
      if (!list.length) return;

      // quebra página se faltar espaço
      if (y > 250) { doc.addPage(); y = 20; }

      sectionTitle(doc, title, M, y);
      y += 4;

      const N = maxSampleLenFor(list, samplesObj, planSamples);

      // Head: # + colunas
      const head = [["#", ...list.map((c) => shortName(c.name))]];

      // Body: Amostra 1..N
      const body = Array.from({ length: N }, (_, i) => {
        const row = [String(i + 1)];
        for (const c of list) {
          const v = samplesObj?.[c.id]?.[i];
          row.push(String(v ?? "").trim() || "—");
        }
        return row;
      });

      // quanto mais colunas, menor a fonte/padding
      const manyCols = list.length >= 6;
      const fs = manyCols ? 7.2 : 7.8;
      const pad = manyCols ? 1.4 : 1.6;

      autoTable(doc, {
        ...commonTableStyle(fs),
        startY: y,
        margin: { left: M, right: M },
        head,
        body,
        styles: { ...commonTableStyle(fs).styles, cellPadding: pad },
        columnStyles: { 0: { cellWidth: 8, fontStyle: "bold" } },
      });

      y = (doc.lastAutoTable?.finalY || y) + 10;
    }

    if (varsAll.length) {
      if (varsAll.length <= LIMITE_COLUNAS) {
        renderVarsTable("MEDIÇÕES — Dimensional + Funcional", varsAll);
      } else {
        renderVarsTable("DIMENSIONAL — Medições", dimVars);
        renderVarsTable("FUNCIONAL — Medições", funcVars);
      }
    }

    // ============================
    // 2) VISUAL: uma tabela só
    // ============================
   const normalVisuals = chars.filter(
  (c) => isVisualChar(c) && !isSpecialChar(c)
);

const specialVisuals = chars.filter(
  (c) => isSpecialOkNg(c)
);

    if (normalVisuals.length) {
      if (y > 250) { doc.addPage(); y = 20; }

      sectionTitle(doc, "VISUAL — Resultados (OK/NG)", M, y);
      y += 4;

      // N visual: produto (planSamples) e caixa (boxQty)
      const N = Math.max(...normalVisuals.map((c) => getCharSampleCount(c, insp)), 1);
      const head = [["Item", ...normalVisuals.map((c) => shortName(c.name))]];

      const body = Array.from({ length: N }, (_, i) => {
        const label = i < boxQty ? `Caixa ${i + 1}` : `Amostra ${i + 1}`;
        const row = [label];

        for (const c of normalVisuals) {
          const expected = getCharSampleCount(c, insp);

          if (i >= expected) { row.push("—"); continue; }

          const v = normVisual(samplesObj?.[c.id]?.[i]);
          row.push(v || "—");
        }
        return row;
      });

      // se tiver muitas colunas visuais, reduz um pouco
      const manyCols = normalVisuals.length >= 6;
      const fs = manyCols ? 7.6 : 8.0;
      const pad = manyCols ? 1.6 : 1.8;

      autoTable(doc, {
        ...commonTableStyle(fs),
        startY: y,
        margin: { left: M, right: M },
        head,
        body,
        styles: { ...commonTableStyle(fs).styles, cellPadding: pad },
        columnStyles: { 0: { cellWidth: 22, fontStyle: "bold" } },
      });

      y = (doc.lastAutoTable?.finalY || y) + 10;
    }

    if (specialVisuals.length) {
  // Se estiver muito perto do fim da página, começa em nova página
    if (y > 210) {
    doc.addPage();

    if (opts.logoDataUrl) {
      try { addLogo(doc, opts.logoDataUrl, M, 8, 30, 12); } catch {}
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.text);
    doc.text("AMOSTRAS BRUTAS (AGRUPADAS)", pageWidth / 2, 16, { align: "center" });

    doc.setDrawColor(...COLORS.grid);
    doc.setLineWidth(0.3);
    doc.line(M, 24, pageWidth - M, 24);

    y = 32;
  }

  sectionTitle(doc, "TESTES ESPECIAIS — OK/NG", M, y);
  y += 4;

  const N = Math.max(
    ...specialVisuals.map((c) => getCharSampleCount(c, insp)),
    1
  );

  const head = [["Amostra", ...specialVisuals.map((c) => shortName(c.name))]];

  const body = Array.from({ length: N }, (_, i) => {
    const row = [`Amostra ${i + 1}`];

    for (const c of specialVisuals) {
      const expected = getCharSampleCount(c, insp);

      if (i >= expected) {
        row.push("—");
        continue;
      }

      const v = normVisual(samplesObj?.[c.id]?.[i]);
      row.push(v || "—");
    }

    return row;
  });

  autoTable(doc, {
    ...commonTableStyle(8),
    startY: y,
    margin: { left: M, right: M },
    head,
    body,
    styles: { ...commonTableStyle(8).styles, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: "bold" },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 10;
}

    // Rodapé da página 2 (fixo)
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
  }

  const invoicePart = insp.invoice ? `_NF_${safe(insp.invoice)}` : "";

   const filename = `Inspecao_${safe(
  insp.planName || "Plano"
)}_${safe(
  insp.lot || "Lote"
)}${invoicePart}_${fmtDate(
  finishedDateTime || startedDateTime
).replaceAll("/", "-")}.pdf`;

   const totalPages = doc.getNumberOfPages();
3
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(`OQC/IQC Inspection V3 • Página ${i}/${totalPages}`, M, 292);
}

  doc.save(filename);
}