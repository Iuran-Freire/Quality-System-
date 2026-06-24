<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { usePlansStore } from "../stores/plans";
import { useInspectionsStore } from "../stores/inspections";
import { getSamplingPlan } from "../utils/sampling/nbr5426";
import { resolveSamplingSnapshot } from "../utils/sampling/resolveSamplingSnapshot";
import { useAuthStore } from "../stores/auth";
import { useSwitchingStore } from "../stores/switching";

/*async function createInspectionFromPlan(plan) {
  // lotSize vem do input do usuário (principalmente para NBR)
  const lotSize = form.lotSize; // exemplo

  const samplingSnapshot = resolveSamplingSnapshot({ plan, lotSize });

  const insp = {
    // ... seus campos atuais
    planId: plan.id,
    planName: plan.name,
    planSnapshot: {
      // características, limites etc (você já faz)  
    },

    samplingSnapshot, // <<<<< FREEZE AQUI

    // define quantas amostras a tela vai renderizar:
    sampleN: samplingSnapshot.sampleN,
  };

  // salvar no Dexie
  await inspectionsStore.add(insp);
}
*/
const props = defineProps({
  show: Boolean,
  id: { type: [String, Number, null], default: null },
});

const emit = defineEmits(["close"]);

const plans = usePlansStore();
const insps = useInspectionsStore();
const auth = useAuthStore();

const switching = useSwitchingStore();

const switchingAnalysis = ref(null);
const switchingChecking = ref(false);
const switchingCheckError = ref("");

const showSwitchingApprovalModal = ref(false);
const switchingPassword = ref("");
const switchingActionLoading = ref(false);

// ----------------- CAMPOS -----------------
const planId = ref("");
const planSearch = ref("");
const lot = ref("");
const invoice = ref("");
const lotSize = ref(""); // tamanho do lote (NBR)
const date = ref(nowLocalISO().slice(0, 10));
const resp = ref("");
const shift = ref("");
const obs = ref("");
const supplier = ref("");
const localSamples = ref({});

// amostragem do produto (visual_produto + variavel)
const planSamplesRef = ref(5);

// amostragem de caixas (visual_caixa)
const boxQtyRef = ref(2);

// snapshot do cálculo NBR (congelado na inspeção)
const samplingSnapRef = ref(null);

// accordion
const openChars = ref(new Set());

function toggleChar(id) {
  const s = new Set(openChars.value);
  const willOpen = !s.has(id);

  willOpen ? s.add(id) : s.delete(id);
  openChars.value = s;

  if (willOpen) {
    requestAnimationFrame(() => {
      const el = document.getElementById(`char-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}
function isCharOpen(id) {
  return openChars.value.has(id);
}

onMounted(async () => {
  await plans.load();
});

// inspeção atual
const insp = computed(() => insps.items.find((x) => String(x.id) === String(props.id)));
const isEdit = computed(() => props.id != null && !!insp.value);
const isDone = computed(() => insp.value?.status === "done");
const linkedReinspection = computed(() => {
  if (!insp.value?.id) return null;

  const linkedItems = insps.items.filter((item) => {
    return (
      String(item.parentInspectionId || "") === String(insp.value.id) &&
      Boolean(item.isReinspection)
    );
  });

  if (!linkedItems.length) return null;

  return linkedItems.sort((a, b) => {
    return Number(b.inspectionCycle || 1) - Number(a.inspectionCycle || 1);
  })[0];
});

const originalInspection = computed(() => {
  if (!insp.value?.isReinspection) return null;
  if (!insp.value?.parentInspectionId) return null;

  return (
    insps.items.find(
      (item) => String(item.id) === String(insp.value.parentInspectionId)
    ) || null
  );
});

const hasLinkedReinspection = computed(() => {
  return Boolean(linkedReinspection.value);
});

const canReinspect = computed(() => {
  const x = insp.value;

  return (
    isEdit.value &&
    String(x?.type || "").toUpperCase() === "OQC" &&
    String(x?.status || "").toLowerCase() === "done" &&
    String(x?.result || "").toUpperCase() === "FAIL" &&
    !hasLinkedReinspection.value
  );
});

// lista de planos
const planList = computed(() => plans.items || []);
const selectedPlan = computed(
  () => planList.value.find((p) => String(p.id) === String(planId.value)) || null
);

const canManageSwitching = computed(() => {
  return Number(auth.accessLevel || 3) <= 2;
});

const hasPendingSwitching = computed(() => {
  return selectedPlan.value?.switchingStatus === "pendente";
});

const inspectionBlockedBySwitching = computed(() => {
  if (!selectedPlan.value) return false;

  return Boolean(
    switchingChecking.value ||
      switchingCheckError.value ||
      hasPendingSwitching.value ||
      switchingAnalysis.value?.hasSuggestion
  );
});

function regimeLabel(value) {
  const regime = String(value || "normal").toLowerCase();

  if (regime === "atenuada") return "Atenuada";
  if (regime === "severa") return "Severa";

  return "Normal";
}

function planOptionLabel(p) {
  return `${p.pn || "SEM PN"} — ${p.model || "-"} — ${p.name || "-"}`;
}

async function refreshSwitchingAnalysis() {
  const p = selectedPlan.value;

  switchingAnalysis.value = null;
  switchingCheckError.value = "";

  if (!p?.id) return;

  switchingChecking.value = true;

  try {
    const data = await switching.analyzePlan(p.id);

    switchingAnalysis.value = data.analysis || null;
  } catch (error) {
    console.error("Erro ao analisar comutação do plano:", error);

    switchingCheckError.value =
      error?.message || "Não foi possível validar a situação de comutação deste plano.";
  } finally {
    switchingChecking.value = false;
  }
}

function selectPlanBySearch() {
  const text = String(planSearch.value || "").trim();

  if (!text) {
    planId.value = "";
    supplier.value = "";
    return;
  }

  const lower = text.toLowerCase();

  const found = planList.value.find((p) => {
    const pn = String(p.pn || "").toLowerCase();
    const model = String(p.model || "").toLowerCase();
    const name = String(p.name || "").toLowerCase();
    const label = planOptionLabel(p).toLowerCase();

    return (
      pn === lower ||
      label === lower ||
      label.includes(lower) ||
      model.includes(lower) ||
      name.includes(lower)
    );
  });

  if (!found) {
    planId.value = "";
    supplier.value = "";
    alert("Plano não encontrado para o PN informado.");
    return;
  }

  planId.value = found.id;
  planSearch.value = planOptionLabel(found);
}

// helpers do plano
const isNbrPlan = computed(() => selectedPlan.value?.sampling?.mode === "nbr5426");
const planSamplingConfig = computed(() => selectedPlan.value?.sampling || null);

// chars em uso
const currentChars = computed(() => {
  if (isEdit.value && insp.value) return insp.value.chars || [];
  if (selectedPlan.value) return selectedPlan.value.chars || [];
  return [];
});

// ----------------- KIND / AMOSTRAGEM POR CHAR -----------------
function hasLimits(c) {
  const lsl = c?.lsl;
  const usl = c?.usl;
  return String(lsl ?? "").trim() !== "" && String(usl ?? "").trim() !== "";
}

function getCharKind(c) {
  return c?.kind || (hasLimits(c) ? "variavel" : "visual_produto");
}

function getResultMode(c) {
  return String(c?.resultMode ?? c?.mode ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isNumericChar(c) {
  const kind = getCharKind(c);
  const mode = getResultMode(c);

  return (
    kind === "variavel" ||
    (kind === "teste_especial" &&
      ["numerico", "numeric", "number", "numero"].includes(mode))
  );
}

function shouldShowCpk(c) {
  return getCharKind(c) === "variavel";
}

function isVisualChar(c) {
  const kind = getCharKind(c);
  const mode = getResultMode(c);

  return (
    kind === "visual_produto" ||
    kind === "visual_caixa" ||
    (kind === "teste_especial" &&
      !["numerico", "numeric", "number", "numero"].includes(mode))
  );
}

// regra oficial: visual_caixa usa boxQtyRef, resto usa planSamplesRef
function getCharSampleCount(c) {
  const kind = getCharKind(c);

  if (kind === "visual_caixa") {
    const n = Number(c.sampleN ?? 2);
    return Number.isFinite(n) && n > 0 ? n : 2;
  }

  if (kind === "teste_especial") {
    const n = Number(c.sampleN ?? 1);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  const n = Number(planSamplesRef.value ?? 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

// ----------------- HELPERS (amostras por característica) -----------------
function ensureSamplesByChar(chars = [], existing = {}) {
  const out = JSON.parse(JSON.stringify(existing || {}));

  for (const c of chars) {
    const n = getCharSampleCount(c);
    if (!Array.isArray(out[c.id])) out[c.id] = [];
    out[c.id] = out[c.id].slice(0, n);
    while (out[c.id].length < n) out[c.id].push("");
  }
  return out;
}

function buildEmptySamplesByChar(chars = []) {
  const out = {};
  for (const c of chars) {
    const n = getCharSampleCount(c);
    out[c.id] = Array.from({ length: n }, () => "");
  }
  return out;
}

// quando muda N (planSamplesRef) ou boxQtyRef durante criação, ajusta os inputs
watch([planSamplesRef, boxQtyRef], () => {
  if (!props.show) return;
  if (!isEdit.value) return; // no modo "novo", só mostra a msg e não tem amostras
  localSamples.value = ensureSamplesByChar(
    currentChars.value || [],
    localSamples.value || {}
  );
});

// animação suave do accordion
function onBeforeEnter(el) {
  el.style.height = "0";
  el.style.opacity = "0";
  el.style.overflow = "hidden";
}
function onEnter(el) {
  void el.offsetHeight;
  el.style.transition = "height 220ms ease, opacity 220ms ease";
  el.style.height = el.scrollHeight + "px";
  el.style.opacity = "1";
}
function onAfterEnter(el) {
  el.style.height = "auto";
  el.style.overflow = "visible";
  el.style.transition = "";
}
function onBeforeLeave(el) {
  el.style.height = el.scrollHeight + "px";
  el.style.opacity = "1";
  el.style.overflow = "hidden";
}
function onLeave(el) {
  void el.offsetHeight;
  el.style.transition = "height 200ms ease, opacity 200ms ease";
  el.style.height = "0";
  el.style.opacity = "0";
}
function onAfterLeave(el) {
  el.style.transition = "";
}

// progresso/ações por característica
function totalCount(charId) {
  return (localSamples.value?.[charId] || []).length;
}

function filledCount(charId) {
  const arr = localSamples.value?.[charId] || [];
  return arr.filter((v) => String(v ?? "").trim() !== "").length;
}

function getCurrentUserTrace() {
  return {
    name: auth.userName || "",
    username: auth.user?.username || "",
    role: auth.role || "",
    at: nowLocalISO(),
  };
}

function isCharCompleted(c, samplesObj = localSamples.value) {
  const vals = samplesObj?.[c.id] || [];

  if (!vals.length) return false;

  return vals.every((v) => String(v ?? "").trim() !== "");
}

function applyCharTraceability(chars = [], samplesObj = localSamples.value) {
  const now = nowLocalISO();

  return (chars || []).map((raw) => {
    const c = JSON.parse(JSON.stringify(raw));
    const vals = samplesObj?.[c.id] || [];

    const hasAnyValue = vals.some((v) => String(v ?? "").trim() !== "");
    const completed = isCharCompleted(c, samplesObj);

    if (hasAnyValue && !c.startedAt) {
      c.startedAt = now;
      c.startedBy = auth.userName || "";
      c.startedByUser = auth.user?.username || "";
      c.startedByRole = auth.role || "";
    }

    if (completed && !c.finishedAt) {
      c.finishedAt = now;
      c.finishedBy = auth.userName || "";
      c.finishedByUser = auth.user?.username || "";
      c.finishedByRole = auth.role || "";
    }

    return c;
  });
}

function markCharTrace(c) {
  if (!c || isDone.value) return;

  const now = nowLocalISO();
  const vals = localSamples.value?.[c.id] || [];

  const hasAnyValue = vals.some((v) => String(v ?? "").trim() !== "");
  const completed = isCharCompleted(c, localSamples.value);

  if (hasAnyValue && !c.startedAt) {
    c.startedAt = now;
    c.startedBy = auth.userName || "";
    c.startedByUser = auth.user?.username || "";
    c.startedByRole = auth.role || "";
  }

  if (completed && !c.finishedAt) {
    c.finishedAt = now;
    c.finishedBy = auth.userName || "";
    c.finishedByUser = auth.user?.username || "";
    c.finishedByRole = auth.role || "";
  }
}

function formatUserTrace(name, role, at) {
  const user = name || "Não informado";
  const roleText = role ? ` (${role})` : "";
  const dateText = at ? ` / ${formatDateTimeBR(at)}` : " / —";

  return `${user}${roleText}${dateText}`;
}

function clearChar(charId) {
  const ok = confirm("Limpar todas as amostras desta característica?");
  if (!ok) return;
  if (!Array.isArray(localSamples.value?.[charId])) return;
  localSamples.value[charId] = localSamples.value[charId].map(() => "");
}

// ----------------- NÚMEROS / CPK -----------------
function toNumber(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdevSample(nums) {
  if (nums.length < 2) return null;
  const m = mean(nums);
  const varSum = nums.reduce((acc, x) => acc + Math.pow(x - m, 2), 0);
  return Math.sqrt(varSum / (nums.length - 1));
}

function calcCpkForChar(char, samplesObj) {
  if (!isNumericChar(char)) {
    return { ok: false, reason: "Visual (sem Cpk)" };
  }

  const lsl = toNumber(char.lsl ?? char.min);
  const usl = toNumber(char.usl ?? char.max);

  if (lsl == null || usl == null) {
    return { ok: false, reason: "Sem LSL/USL" };
  }

  const raw = samplesObj?.[char.id] || [];
  const nums = raw.map(toNumber).filter((n) => n != null);

  if (nums.length < 2) {
    return { ok: false, reason: "Poucas amostras", n: nums.length };
  }

  const m = mean(nums);
  const s = stdevSample(nums);

  if (!s || s === 0) {
    return { ok: false, reason: "Desvio 0", n: nums.length, mean: m, stdev: s };
  }

  const cp = (usl - lsl) / (6 * s);
  const cpu = (usl - m) / (3 * s);
  const cpl = (m - lsl) / (3 * s);
  const cpk = Math.min(cpu, cpl);

  return { ok: true, n: nums.length, mean: m, stdev: s, cp, cpk };
}

function cpkClass(v) {
  if (v == null) return "";
  if (v >= 1.33) return "cpk-good";
  if (v >= 1.0) return "cpk-warn";
  return "cpk-bad";
}

function fmt(v, d = 3) {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toFixed(d);
}

function nowLocalISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function parseDateTimeLocal(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  const s = String(value).trim();

  // Se vier com Z ou com fuso horário, deixa o JavaScript converter para horário local.
  // Exemplo: 2026-06-16T19:48:16.000Z -> 16/06/2026 15:48:16 em Manaus
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Se vier sem fuso, trata como horário local.
  // Exemplo: 2026-06-16T15:48:16 -> 16/06/2026 15:48:16
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);

  if (m) {
    const [, yy, mm, dd, hh = "00", mi = "00", ss = "00"] = m;

    return new Date(
      Number(yy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTimeBR(value) {
  const d = parseDateTimeLocal(value);

  if (!d) return "—";

  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function getCharStats(c) {
  const r = calcCpkForChar(c, localSamples.value);
  return {
    ok: r.ok,
    reason: r.reason,
    filled: filledCount(c.id),
    total: totalCount(c.id),
    n: r.n,
    mean: r.mean,
    stdev: r.stdev,
    cp: r.cp,
    cpk: r.cpk,
  };
}

const statsMap = computed(() => {
  const out = {};
  for (const c of currentChars.value || []) out[c.id] = getCharStats(c);
  return out;
});

// ----------------- VISUAL OK/NG HELPERS -----------------
function normVisual(v) {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
  if (!s) return "";
  if (s === "OK" || s === "PASS") return "OK";
  if (s === "NG" || s === "NOK" || s === "FAIL") return "NG";
  return "";
}

function visualLabel(c, idx) {
  const k = getCharKind(c);
  if (k === "visual_caixa") return `Caixa ${idx + 1}`;
  return `Amostra ${idx + 1}`;
}

function kindLabel(c) {
  const k = getCharKind(c);

  if (k === "variavel") return "Variável (CPK)";
  if (k === "visual_caixa") return "Visual – Caixa";

  if (k === "teste_especial") {
    return isNumericChar(c) ? "Teste Especial – Numérico" : "Teste Especial – OK/NG";
  }

  return "Visual – Produto";
}

function setVisual(charId, idx, val) {
  if (!localSamples.value?.[charId]) return;
  localSamples.value[charId][idx] = val;
}
function isVisualSelected(charId, idx, val) {
  return normVisual(localSamples.value?.[charId]?.[idx]) === val;
}

// ----------------- AQL helpers (Ac/Re) -----------------
function countNG(vals = []) {
  return (vals || []).map(normVisual).filter((v) => v === "NG").length;
}

function countFilledVisual(vals = []) {
  return (vals || []).map(normVisual).filter(Boolean).length;
}

function evalAql({ filled, total, ng, ac, re, strict = true }) {
  if (!filled) return "EMPTY";
  if (strict && filled < total) return "EMPTY";

  if (ac == null || re == null) return ng > 0 ? "NG" : "OK";

  if (ng >= re) return "NG";
  if (ng <= ac) return "OK";
  return "NG";
}

// ----------------- NBR: calcula amostragem do plano (se aplicável) -----------------
function computePlanSamplingFromSelectedPlan() {
  const p = selectedPlan.value;
  if (!p) return;

  supplier.value = p?.supplier || "";
  boxQtyRef.value = Number(p?.boxQty ?? 2) || 2;

  const mode = p?.sampling?.mode || "fixed";

  // modo fixo: usa p.n
  if (mode !== "nbr5426") {
    samplingSnapRef.value = null;
    planSamplesRef.value = Number(p?.n ?? 5) || 5;
    return;
  }

  // modo NBR: exige lotSize
  const ls = Number(lotSize.value);
  const aql = Number(p?.sampling?.aql ?? 1.0);
  const level = p?.sampling?.level ?? "II";

  if (!Number.isFinite(ls) || ls <= 0) {
    samplingSnapRef.value = {
      mode: "nbr5426",
      level,
      aql,
      lotSize: null,
      error: "Informe o tamanho do lote",
    };
    planSamplesRef.value = Number(p?.n ?? 5) || 5;
    return;
  }

  try {
    const regime = selectedPlan.value?.inspectionRegime || "normal";

    const sp = getSamplingPlan({
      lotSize: ls,
      aql,
      level,
      regime,
    });

    samplingSnapRef.value = {
      mode: "nbr5426",
      lotSize: ls,
      level,
      inspectionLevel: sp.inspectionLevel ?? level,
      aql: sp.aql ?? aql,
      inspectionRegime: sp.inspectionRegime ?? regime,
      returnToNormalOnDelta: Boolean(sp.returnToNormalOnDelta),

      // código inicial da tabela 1
      codeLetter: sp.codeLetter,
      initialCodeLetter: sp.initialCodeLetter ?? sp.codeLetter,
      initialSampleN: sp.initialSampleN ?? null,

      // código realmente usado depois da seta
      effectiveCodeLetter: sp.effectiveCodeLetter ?? sp.codeLetter,
      sampleN: sp.sampleN,

      ac: sp.ac,
      re: sp.re,
      accept: sp.accept ?? sp.ac,
      reject: sp.reject ?? sp.re,

      switched: sp.switched ?? false,
      switchPath: sp.switchPath ?? [sp.codeLetter],

      selectedAql: sp.selectedAql ?? aql,
      source: sp.source ?? "NBR_5426",
    };

    planSamplesRef.value = Number(sp.sampleN) || Number(p?.n ?? 5) || 5;
  } catch (e) {
    samplingSnapRef.value = {
      mode: "nbr5426",
      lotSize: ls,
      level,
      aql,
      error: e?.message || "Falha ao calcular NBR 5426",
    };
    planSamplesRef.value = Number(p?.n ?? 5) || 5;
  }
}

// recalcula quando muda plano/lotSize (apenas em criação)
watch([planId, lotSize], async () => {
  computePlanSamplingFromSelectedPlan();

  if (planId.value) {
    await refreshSwitchingAnalysis();
  } else {
    switchingAnalysis.value = null;
    switchingCheckError.value = "";
  }
});

// ----------------- ABRIR MODAL -----------------
watch(
  () => props.show,
  async (open) => {
    if (!open) return;

    await plans.load();
    openChars.value = new Set();

    if (isEdit.value && insp.value) {
      const x = insp.value;

      planId.value = x.planId ?? "";

      const p = planList.value.find((p) => String(p.id) === String(x.planId));

      planSearch.value = p ? planOptionLabel(p) : "";
      lot.value = x.lot ?? "";
      invoice.value = x.invoice ?? "";
      lotSize.value = x.lotSize ?? "";
      date.value = (x.createdAt || "").slice(0, 10) || nowLocalISO().slice(0, 10);
      resp.value = x.resp ?? "";
      shift.value = x.shift ?? "";
      obs.value = x.obs ?? "";

      supplier.value = x.supplier || p?.supplier || "";

      planSamplesRef.value = Number(x.planSamples ?? p?.n ?? 5) || 5;
      boxQtyRef.value = Number(x.planBoxQty ?? x.boxQty ?? p?.boxQty ?? 2) || 2;

      samplingSnapRef.value = x.sampling ?? null;

      localSamples.value = ensureSamplesByChar(x.chars || [], x.samples || {});
      if ((x.chars || []).length) openChars.value = new Set([x.chars[0].id]);
    } else {
      planId.value = "";
      planSearch.value = "";
      lot.value = "";
      invoice.value = "";
      lotSize.value = "";
      date.value = nowLocalISO().slice(0, 10);
      resp.value = auth.userName || "";
      shift.value = "";
      obs.value = "";
      supplier.value = "";
      localSamples.value = {};
      planSamplesRef.value = 5;
      boxQtyRef.value = 2;
      samplingSnapRef.value = null;
    }
  }
);

// ----------------- RESULTADO (PASS/FAIL) -----------------
function checkChar(c, vals = []) {
  // VISUAL PRODUTO / VISUAL CAIXA / TESTE ESPECIAL OK-NG
  if (isVisualChar(c)) {
    const total = (vals || []).length;
    const filled = countFilledVisual(vals);
    const ng = countNG(vals);

    if (filled === 0) return "EMPTY";
    if (filled < total) return "EMPTY";

    const kind = getCharKind(c);

    // Visual caixa e teste especial OK/NG: qualquer NG reprova
    if (kind === "visual_caixa" || kind === "teste_especial") {
      return ng > 0 ? "NG" : "OK";
    }

    // Visual produto usa AQL se existir
    const s = samplingSnapRef.value || insp.value?.sampling || null;
    const ac = s?.ac ?? null;
    const re = s?.re ?? null;

    return evalAql({
      filled,
      total,
      ng,
      ac,
      re,
      strict: true,
    });
  }

  // VARIÁVEL / TESTE ESPECIAL NUMÉRICO
  if (isNumericChar(c)) {
    const l = toNumber(c.lsl ?? c.min);
    const u = toNumber(c.usl ?? c.max);

    const raw = vals || [];
    const nums = raw.map(toNumber);

    if (!raw.length) return "EMPTY";

    if (nums.some((n) => n == null)) return "EMPTY";

    return nums.every((n) => {
      const okMin = l == null || n >= l;
      const okMax = u == null || n <= u;
      return okMin && okMax;
    })
      ? "OK"
      : "NG";
  }

  return "EMPTY";
}

function findInspectionProblems(chars, samples) {
  const problems = [];

  for (const c of chars || []) {
    const vals = samples?.[c.id] || [];

    if (!vals.length) {
      problems.push({
        charName: c.name || "Característica sem nome",
        sample: "-",
        sampleLabel: "Amostras",
        value: "",
        reason: "sem amostras geradas",
      });
      continue;
    }

    vals.forEach((v, idx) => {
      const raw = String(v ?? "").trim();

      if (!raw) {
        problems.push({
          charName: c.name || "Característica sem nome",
          sample: idx + 1,
          sampleLabel: visualLabel(c, idx),
          value: "",
          reason: "campo em branco",
        });
        return;
      }

      const numeric = isNumericChar(c);
      const visual = isVisualChar(c);

      if (numeric) {
        const num = toNumber(raw);

        if (num == null) {
          problems.push({
            charName: c.name || "Característica sem nome",
            sample: idx + 1,
            sampleLabel: visualLabel(c, idx),
            value: raw,
            reason: "valor numérico inválido",
          });
        }
      }

      if (visual) {
        const visualValue = normVisual(raw);

        if (!visualValue) {
          problems.push({
            charName: c.name || "Característica sem nome",
            sample: idx + 1,
            sampleLabel: visualLabel(c, idx),
            value: raw,
            reason: "valor visual inválido. Use OK ou NG",
          });
        }
      }
    });
  }

  return problems;
}

function calcResult(chars, samples) {
  let hasAny = false;
  for (const c of chars) {
    const st = checkChar(c, samples?.[c.id] || []);
    if (st !== "EMPTY") hasAny = true;
    if (st === "NG") return "FAIL";
    if (st === "EMPTY") return "EMPTY";
  }
  return hasAny ? "PASS" : null;
}

async function createReinspection() {
  if (!insp.value) {
    alert("Inspeção original não encontrada.");
    return;
  }

  const confirmed = confirm(
    `Deseja criar uma reinspeção para esta inspeção?\n\n` +
      `Plano: ${insp.value.planName || "-"}\n` +
      `Lote: ${insp.value.lot || "-"}\n` +
      `Resultado atual: ${insp.value.result || "-"}`
  );

  if (!confirmed) return;

  try {
    const newInspection = await insps.createReinspection(insp.value, {
      name: auth.userName || "",
      username: auth.user?.username || "",
      role: auth.role || "",
    });

    alert(
      `Reinspeção criada com sucesso.\n\n` +
        `Ciclo: ${newInspection.inspectionCycle || 2}\n` +
        `Status: Rascunho`
    );

    emit("close");
  } catch (error) {
    console.error("Erro ao criar reinspeção:", error);

    alert(error?.message || "Não foi possível criar a reinspeção.");
  }
}

async function registerSwitchingSuggestion() {
  const p = selectedPlan.value;

  if (!p?.id || !switchingAnalysis.value?.hasSuggestion) return;

  const ok = confirm("Registrar esta sugestão de comutação como pendente de aprovação?");

  if (!ok) return;

  switchingActionLoading.value = true;

  try {
    await switching.suggestPlan(p.id);

    await plans.load();
    await refreshSwitchingAnalysis();

    alert(
      "Sugestão registrada.\n\n" +
        "Agora é necessário informar a senha de comutação para liberar o plano."
    );
  } catch (error) {
    console.error("Erro ao registrar sugestão de comutação:", error);
    alert(error?.message || "Não foi possível registrar a sugestão.");
  } finally {
    switchingActionLoading.value = false;
  }
}

async function approveSwitchingFromInspection() {
  const p = selectedPlan.value;

  if (!p?.id) return;

  if (!String(switchingPassword.value || "").trim()) {
    return alert("Informe a senha de comutação.");
  }

  const approvedBy = {
    id: auth.user?.id,
    name: auth.userName || "",
    username: auth.user?.username || "",
    role: auth.role || "",
    accessLevel: auth.accessLevel,
  };

  switchingActionLoading.value = true;

  try {
    await switching.approvePlan(p.id, switchingPassword.value, approvedBy);

    switchingPassword.value = "";
    showSwitchingApprovalModal.value = false;

    await plans.load();
    await refreshSwitchingAnalysis();

    computePlanSamplingFromSelectedPlan();

    alert(
      "Comutação aprovada com sucesso.\n\n" +
        "O plano foi liberado com o novo regime de inspeção."
    );
  } catch (error) {
    console.error("Erro ao aprovar comutação:", error);
    alert(error?.message || "Não foi possível aprovar a comutação.");
  } finally {
    switchingActionLoading.value = false;
  }
}

// ----------------- AÇÕES -----------------
async function createDraft() {
  const p = selectedPlan.value;

  if (inspectionBlockedBySwitching.value) {
    return alert(
      "Esta inspeção está bloqueada por necessidade de comutação.\n\n" +
        "Solicite a confirmação da liderança antes de continuar."
    );
  }
  if (!p) return alert("Selecione um plano");
  if (!lot.value.trim()) return alert("Preencha o lote");
  if (!resp.value.trim()) return alert("Preencha o responsável");
  if (!supplier.value.trim())
    return alert("Este plano não possui fornecedor cadastrado. Edite o plano antes.");

  // calcula amostragem baseada no plano selecionado
  computePlanSamplingFromSelectedPlan();

  // se plano for NBR, lotSize é obrigatório
  const mode = p?.sampling?.mode || "fixed";
  if (mode === "nbr5426") {
    const ls = Number(lotSize.value);
    if (!Number.isFinite(ls) || ls <= 0)
      return alert("Informe o Tamanho do lote (Lot Size).");
    if (samplingSnapRef.value?.error)
      return alert(`NBR 5426: ${samplingSnapRef.value.error}`);
  }

  const chars = Array.isArray(p.chars) ? p.chars : [];

  // garante refs antes de criar samples
  boxQtyRef.value = Number(p.boxQty ?? 2) || 2;

  const planSamples = Number(planSamplesRef.value ?? p.n ?? 5) || 5;
  planSamplesRef.value = planSamples;

  const samples = buildEmptySamplesByChar(chars);

  await insps.create({
    planId: p.id,
    planName: p.name,
    type: p.type,
    pn: p.pn,
    model: p.model,
    client: p.client,
    supplier: supplier.value,

    lot: lot.value.trim(),
    invoice: invoice.value.trim(),
    lotSize: mode === "nbr5426" ? Number(lotSize.value) : null,
    shift: shift.value,
    resp: resp.value.trim(),
    createdBy: auth.userName || "",
    createdByUser: auth.user?.username || "",
    createdByRole: auth.role || "",
    obs: obs.value.trim(),

    chars,
    samples,

    planSamples: planSamplesRef.value,
    planBoxQty: Number(boxQtyRef.value ?? 2),
    boxQty: Number(boxQtyRef.value ?? 2),

    sampling: samplingSnapRef.value, // ✅ congela AQL/Ac/Re
    status: "draft",

    startedAt: nowLocalISO(),
    finishedAt: "",
    result: null,
    createdAt: date.value
      ? new Date(`${date.value}T00:00:00`).toISOString()
      : nowLocalISO(),
  });

  emit("close");
}

async function saveDraft() {
  if (!props.id) return alert("Crie a inspeção primeiro (rascunho).");

  const chars = applyCharTraceability(currentChars.value, localSamples.value);
  const res = calcResult(chars, localSamples.value);

  await insps.update(props.id, {
    lot: lot.value.trim(),
    invoice: invoice.value.trim(),
    lotSize: String(lotSize.value).trim() ? Number(lotSize.value) : null,
    shift: shift.value,
    resp: resp.value.trim(),
    obs: obs.value.trim(),
    chars: JSON.parse(JSON.stringify(chars)),
    samples: JSON.parse(JSON.stringify(localSamples.value)),
    status: "draft",
    result: res === "EMPTY" ? null : res,
    updatedBy: auth.userName || "",
    updatedByUser: auth.user?.username || "",
    updatedByRole: auth.role || "",
    updatedAt: nowLocalISO(),
    boxQty: Number(boxQtyRef.value ?? 2),
    sampling: samplingSnapRef.value || insp.value?.sampling || null, // ✅ mantém snapshot
    createdAt: date.value
      ? new Date(`${date.value}T00:00:00`).toISOString()
      : nowLocalISO(),
  });

  emit("close");
}

async function finalizeInspection() {
  if (!props.id || !insp.value) return alert("Inspeção não encontrada.");

  const chars = applyCharTraceability(currentChars.value, localSamples.value);
  const res = calcResult(chars, localSamples.value);

  const problems = findInspectionProblems(chars, localSamples.value);

  if (problems.length) {
    const msg = problems
      .slice(0, 15)
      .map((p, i) => {
        return `${i + 1}. ${p.charName} - ${p.sampleLabel || `Amostra ${p.sample}`}
Valor: "${p.value ?? ""}"
Motivo: ${p.reason}`;
      })
      .join("\n\n");

    return alert(
      `Não foi possível finalizar a inspeção.\n\nVerifique os campos abaixo:\n\n${msg}` +
        (problems.length > 15 ? `\n\nE mais ${problems.length - 15} ocorrência(s).` : "")
    );
  }

  if (res === "EMPTY") {
    return alert(
      "Não foi possível finalizar a inspeção.\n\nExistem características sem preenchimento completo."
    );
  }

  if (res === "FAIL" && !String(obs.value || "").trim()) {
    return alert("Para finalizar com FAIL, preencha o campo Observações.");
  }

  await insps.update(props.id, {
    lot: lot.value.trim(),
    invoice: invoice.value.trim(),
    lotSize: String(lotSize.value).trim() ? Number(lotSize.value) : null,
    shift: shift.value,
    resp: resp.value.trim(),
    obs: obs.value.trim(),
    chars: JSON.parse(JSON.stringify(chars)),
    samples: JSON.parse(JSON.stringify(localSamples.value)),
    status: "done",
    result: res,
    finishedAt: nowLocalISO(),

    finishedBy: auth.userName || "",
    finishedByUser: auth.user?.username || "",
    finishedByRole: auth.role || "",

    boxQty: Number(boxQtyRef.value ?? 2),
    sampling: samplingSnapRef.value || insp.value?.sampling || null,
    createdAt: date.value
      ? new Date(`${date.value}T00:00:00`).toISOString()
      : nowLocalISO(),
    updatedBy: auth.userName || "",
    updatedByUser: auth.user?.username || "",
    updatedAt: nowLocalISO(),
  });

  emit("close");
}
</script>

<template>
  <div class="modal" :class="{ show: props.show }" @click.self="emit('close')">
    <div class="sheet vstack">
      <div class="hstack" style="justify-content: space-between; align-items: center">
        <div>
          <h3>{{ isEdit ? "Editar Inspeção" : "Nova Inspeção" }}</h3>

          <div v-if="insp?.isReinspection" class="reinspection-header">
            REINSPEÇÃO — CICLO {{ insp?.inspectionCycle || 2 }}
          </div>
        </div>

        <div class="hstack" style="gap: 8px">
          <button
            v-if="canReinspect"
            class="btn reinspection-btn"
            type="button"
            @click="createReinspection"
          >
            Criar reinspeção
          </button>

          <button class="btn ghost" type="button" @click="emit('close')">Fechar</button>
        </div>
      </div>

      <div class="hr"></div>

      <div class="inspection-section-heading">
        <h4 class="insp-section-title">Dados da inspeção</h4>

        <span
          v-if="selectedPlan"
          class="regime-badge"
          :class="`regime-${String(selectedPlan?.inspectionRegime || 'normal')
            .toLowerCase()
            .trim()}`"
        >
          Regime: {{ regimeLabel(selectedPlan?.inspectionRegime) }}
        </span>
      </div>

      <div
        v-if="hasLinkedReinspection && !insp?.isReinspection"
        class="linked-reinspection-alert"
      >
        <div>
          <strong>Esta inspeção possui uma reinspeção criada</strong>

          <span>
            Ciclo {{ linkedReinspection?.inspectionCycle || 2 }}
            · Status:
            {{ linkedReinspection?.status === "done" ? "Finalizada" : "Em andamento" }}
          </span>
        </div>
      </div>

      <div v-if="insp?.isReinspection" class="reinspection-info">
        <div>
          <span>Tipo</span>
          <b>Reinspeção OQC</b>
        </div>

        <div>
          <span>Ciclo</span>
          <b>{{ insp?.inspectionCycle || 2 }}</b>
        </div>

        <div class="origin-inspection-info">
          <span>Inspeção de origem</span>

          <b v-if="originalInspection">
            {{ originalInspection.pn || "PN não informado" }}
            —
            {{ originalInspection.model || "Modelo não informado" }}
            —
            {{ originalInspection.planName || "Plano não informado" }}
          </b>

          <small v-if="originalInspection">
            Lote: {{ originalInspection.lot || "—" }} | NF:
            {{ originalInspection.invoice || "—" }}
          </small>

          <b v-else> Inspeção original não localizada </b>
        </div>
      </div>

      <div v-if="isEdit" class="inspection-time-box">
        <div>
          <span>Início da inspeção</span>
          <b>{{ formatDateTimeBR(insp?.startedAt) }}</b>
        </div>

        <div>
          <span>Finalização da inspeção</span>
          <b>{{ formatDateTimeBR(insp?.finishedAt) }}</b>
        </div>
      </div>

      <div class="row">
        <div class="span-3">
          <label class="float-label">
            <input
              v-model="planSearch"
              list="plans-list"
              placeholder=" "
              :disabled="isEdit"
              @change="selectPlanBySearch"
              @blur="selectPlanBySearch"
            />
            <span>Plano * / PN *</span>
          </label>

          <datalist id="plans-list">
            <option v-for="p in planList" :key="p.id" :value="planOptionLabel(p)" />
          </datalist>
        </div>

        <div class="span-3">
          <label class="float-label">
            <input v-model="lot" placeholder=" " :disabled="isDone" />
            <span>Lote *</span>
          </label>
        </div>

        <div class="span-3">
          <label class="float-label">
            <input v-model="invoice" placeholder=" " :disabled="isDone" />
            <span>Invoice / NF</span>
          </label>
        </div>

        <!-- ✅ Lot Size só se plano for NBR -->
        <div class="span-3" v-if="isNbrPlan">
          <label class="float-label">
            <input
              v-model="lotSize"
              type="number"
              min="1"
              placeholder=" "
              :disabled="isDone || isEdit"
            />
            <span>Tamanho do lote (Lot Size) *</span>
          </label>
        </div>

        <div class="span-3">
          <label class="float-label">
            <input v-model="date" type="date" placeholder=" " :disabled="isDone" />
            <span>Data</span>
          </label>
        </div>

        <div class="span-3">
          <label class="float-label">
            <input v-model="resp" placeholder=" " :disabled="isDone" />
            <span>Responsável *</span>
          </label>
        </div>

        <div class="span-2">
          <label class="float-label">
            <select v-model="shift" :disabled="isDone">
              <option value="">—</option>
              <option value="1º TURNO">1º TURNO</option>
              <option value="2º TURNO">2º TURNO</option>
              <option value="3º TURNO">3º TURNO</option>
            </select>
            <span>Turno</span>
          </label>
        </div>

        <div class="span-2">
          <label class="float-label">
            <input :value="supplier" disabled />
            <span>Fornecedor (do plano)</span>
          </label>
        </div>

        <div class="span-6">
          <label class="float-label">
            <textarea
              v-model="obs"
              rows="3"
              :disabled="isDone"
              placeholder=" "
            ></textarea>
            <span>Observações</span>
          </label>
        </div>

        <!-- ✅ Info NBR (somente criação / leitura) -->
        <div class="span-6" v-if="isNbrPlan && !isEdit" style="margin-top: -6px">
          <div style="font-size: 13px; color: var(--muted)">
            <b>NBR 5426:</b>

            <!-- Regime exibido no título da seção acima -->

            <template v-if="samplingSnapRef?.error">
              {{ samplingSnapRef.error }}
            </template>
            <template v-else-if="samplingSnapRef?.sampleN">
              N={{ samplingSnapRef.sampleN }} | Ac={{ samplingSnapRef.ac }} Re={{
                samplingSnapRef.re
              }}
              ( AQL {{ samplingSnapRef.aql }} / Nível {{ samplingSnapRef.level }} / Código
              <template
                v-if="
                  samplingSnapRef.effectiveCodeLetter &&
                  samplingSnapRef.effectiveCodeLetter !== samplingSnapRef.codeLetter
                "
              >
                {{ samplingSnapRef.codeLetter }} →
                {{ samplingSnapRef.effectiveCodeLetter }}
              </template>
              <template v-else>
                {{ samplingSnapRef.codeLetter }}
              </template>
              )
            </template>
            <template v-else>
              Informe o tamanho do lote para calcular n / Ac / Re.
            </template>
          </div>
        </div>
      </div>

      <div v-if="selectedPlan && switchingChecking" class="switching-gate checking">
        <strong>Validando comutação do plano...</strong>
        <span>Aguarde antes de iniciar a inspeção.</span>
      </div>

      <div v-else-if="selectedPlan && switchingCheckError" class="switching-gate blocked">
        <strong>Não foi possível validar a comutação deste plano.</strong>
        <span>
          A inspeção foi bloqueada por segurança. Solicite suporte da liderança.
        </span>
      </div>

      <div v-else-if="selectedPlan && hasPendingSwitching" class="switching-gate blocked">
        <strong>Comutação pendente de aprovação</strong>

        <span> Este plano está bloqueado até a confirmação da liderança. </span>

        <div class="switching-gate-details">
          <span>
            Regime atual:
            <b>{{ regimeLabel(selectedPlan.inspectionRegime) }}</b>
          </span>

          <span>
            Regime sugerido:
            <b>{{ regimeLabel(selectedPlan.suggestedRegime) }}</b>
          </span>
        </div>

        <button
          v-if="canManageSwitching"
          class="btn"
          type="button"
          @click="showSwitchingApprovalModal = true"
        >
          Aprovar comutação
        </button>

        <small v-else>
          Solicite a aprovação da liderança para continuar esta inspeção.
        </small>
      </div>

      <div
        v-else-if="selectedPlan && switchingAnalysis?.hasSuggestion"
        class="switching-gate suggestion"
      >
        <strong>Comutação necessária para este plano</strong>

        <span>
          {{ switchingAnalysis.reason }}
        </span>

        <div class="switching-gate-details">
          <span>
            Regime atual:
            <b>{{ regimeLabel(switchingAnalysis.currentRegime) }}</b>
          </span>

          <span>
            Regime sugerido:
            <b>{{ regimeLabel(switchingAnalysis.suggestedRegime) }}</b>
          </span>
        </div>

        <button
          v-if="canManageSwitching"
          class="btn"
          type="button"
          @click="registerSwitchingSuggestion"
        >
          Registrar sugestão para aprovação
        </button>

        <small v-else>
          Solicite a confirmação da liderança antes de iniciar esta inspeção.
        </small>
      </div>

      <div class="hr"></div>

      <h4 class="insp-section-title">Características e amostras</h4>

      <div v-if="!isEdit" style="color: var(--muted); font-size: 13px">
        Crie a inspeção (rascunho) primeiro. Depois clique em <b>Abrir</b> na tabela para
        preencher.
      </div>

      <div v-else class="vstack" style="gap: 12px">
        <div v-for="c in currentChars" :key="c.id" class="char-card" :id="`char-${c.id}`">
          <button class="char-head" type="button" @click="toggleChar(c.id)">
            <div class="char-title">
              <div class="char-name">{{ c.name || "Característica" }}</div>

              <div class="char-limits">
                <b>{{ kindLabel(c) }}</b>

                <template v-if="isNumericChar(c)">
                  — Mín: {{ c.lsl ?? c.min ?? "-" }} | Máx: {{ c.usl ?? c.max ?? "-" }}
                </template>

                <template v-else-if="getCharKind(c) === 'visual_caixa'">
                  — Qtd. Caixas: {{ c.sampleN || 2 }}
                </template>

                <template v-else-if="getCharKind(c) === 'teste_especial'">
                  — Amostras: {{ c.sampleN || 1 }}
                </template>

                <template v-else>
                  — Amostragem do plano: {{ planSamplesRef }}
                  <template v-if="(samplingSnapRef?.ac ?? null) != null">
                    | Ac/Re: {{ samplingSnapRef.ac }}/{{ samplingSnapRef.re }}
                  </template>
                </template>

                <span class="char-mini">
                  • {{ statsMap[c.id]?.filled ?? 0 }}/{{ statsMap[c.id]?.total ?? 0 }}
                </span>
              </div>
            </div>

            <div class="char-right">
              <template v-if="shouldShowCpk(c) && statsMap[c.id]?.ok">
                <span class="cpk-pill" :class="cpkClass(statsMap[c.id]?.cpk)">
                  Cpk {{ fmt(statsMap[c.id]?.cpk, 2) }}
                </span>
              </template>
              <template v-else-if="shouldShowCpk(c)">
                <span class="cpk-pill cpk-warn">Cpk —</span>
              </template>

              <template v-else-if="isNumericChar(c)">
                <span class="cpk-pill cpk-warn">Numérico</span>
              </template>
              <template v-else>
                <span class="cpk-pill cpk-warn">Visual</span>
              </template>

              <span class="chev" :class="{ open: isCharOpen(c.id) }">▾</span>
            </div>
          </button>

          <transition
            @before-enter="onBeforeEnter"
            @enter="onEnter"
            @after-enter="onAfterEnter"
            @before-leave="onBeforeLeave"
            @leave="onLeave"
            @after-leave="onAfterLeave"
          >
            <div v-if="isCharOpen(c.id)" class="char-body">
              <div class="char-body-top">
                <div class="char-stats">
                  <template v-if="shouldShowCpk(c) && statsMap[c.id]?.ok">
                    <span class="badge"><b>N</b>&nbsp;{{ statsMap[c.id]?.n }}</span>
                    <span class="badge"
                      ><b>μ</b>&nbsp;{{ fmt(statsMap[c.id]?.mean, 4) }}</span
                    >
                    <span class="badge"
                      ><b>s</b>&nbsp;{{ fmt(statsMap[c.id]?.stdev, 4) }}</span
                    >
                    <span class="badge"
                      ><b>Cp</b>&nbsp;{{ fmt(statsMap[c.id]?.cp, 2) }}</span
                    >
                    <span class="badge"
                      ><b>Cpk</b>&nbsp;{{ fmt(statsMap[c.id]?.cpk, 2) }}</span
                    >
                  </template>

                  <template v-else-if="shouldShowCpk(c)">
                    <span class="char-stats-muted">
                      Cpk indisponível: {{ statsMap[c.id]?.reason || "—" }}
                    </span>
                  </template>

                  <template v-else-if="isNumericChar(c)">
                    <span class="char-stats-muted">
                      Numérico: preencha os valores dentro do mínimo e máximo definidos.
                    </span>
                  </template>

                  <template v-else>
                    <div class="char-stats-muted">
                      Visual: selecione OK/NG para cada item.

                      <div class="visual-summary">
                        <span class="ok">
                          OK:
                          {{
                            (localSamples[c.id] || []).filter(
                              (v) => normVisual(v) === "OK"
                            ).length
                          }}
                        </span>

                        <span class="ng">
                          NG:
                          {{
                            (localSamples[c.id] || []).filter(
                              (v) => normVisual(v) === "NG"
                            ).length
                          }}
                        </span>

                        <span class="total">
                          Total: {{ filledCount(c.id) }} / {{ totalCount(c.id) }}
                        </span>
                      </div>
                    </div>
                  </template>
                </div>

                <div class="char-body-actions">
                  <div class="char-progress">
                    {{ filledCount(c.id) }} / {{ totalCount(c.id) }} preenchidas
                  </div>

                  <div v-if="isDone" class="char-trace-box">
                    <div>
                      <span>Iniciado por</span>
                      <b>
                        {{ formatUserTrace(c.startedBy, c.startedByRole, c.startedAt) }}
                      </b>
                    </div>

                    <div>
                      <span>Finalizado por</span>
                      <b>
                        {{
                          formatUserTrace(c.finishedBy, c.finishedByRole, c.finishedAt)
                        }}
                      </b>
                    </div>
                  </div>

                  <div class="char-actions" v-if="!isDone">
                    <button class="mini-btn" type="button" @click.stop="clearChar(c.id)">
                      Limpar
                    </button>
                  </div>
                </div>
              </div>

              <div class="samples-wrap">
                <div class="samples-grid">
                  <div
                    v-for="(_, idx) in localSamples[c.id] || []"
                    :key="idx"
                    class="sample-cell"
                  >
                    <!-- VARIÁVEL OU TESTE ESPECIAL NUMÉRICO -->
                    <template v-if="isNumericChar(c)">
                      <label class="float-label">
                        <input
                          v-model="localSamples[c.id][idx]"
                          inputmode="decimal"
                          placeholder=" "
                          :disabled="isDone"
                          @input="markCharTrace(c)"
                        />
                        <span>{{ visualLabel(c, idx) }}</span>
                      </label>
                    </template>

                    <!-- VISUAL / OK-NG -->
                    <template v-else>
                      <div class="visual-box">
                        <label class="float-label">
                          <input
                            v-model="localSamples[c.id][idx]"
                            placeholder=" "
                            :disabled="isDone"
                            maxlength="2"
                            @input="markCharTrace(c)"
                            @blur="
                              localSamples[c.id][idx] = normVisual(
                                localSamples[c.id][idx]
                              );
                              markCharTrace(c);
                            "
                          />
                          <span>{{ visualLabel(c, idx) }} - OK/NG</span>
                        </label>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <div class="hr"></div>

      <div class="hstack" style="justify-content: flex-end; gap: 8px">
        <button class="btn ghost" type="button" @click="emit('close')">Cancelar</button>

        <button
          v-if="!isEdit"
          class="btn"
          :class="{ 'btn-switching-blocked': inspectionBlockedBySwitching }"
          type="button"
          :disabled="inspectionBlockedBySwitching"
          @click="createDraft"
        >
          {{
            inspectionBlockedBySwitching
              ? "Bloqueado: aprovação necessária"
              : "Criar inspeção (rascunho)"
          }}
        </button>

        <template v-else>
          <button v-if="!isDone" class="btn ghost" type="button" @click="saveDraft">
            Salvar rascunho
          </button>

          <button v-if="!isDone" class="btn" type="button" @click="finalizeInspection">
            Finalizar inspeção
          </button>

          <span v-else style="font-size: 13px; color: var(--muted)">
            Inspeção finalizada. Somente leitura.
          </span>
        </template>
      </div>
    </div>
  </div>
  <div
    v-if="showSwitchingApprovalModal"
    class="modal show"
    @click.self="showSwitchingApprovalModal = false"
  >
    <div class="sheet vstack switching-password-modal">
      <div class="hstack" style="justify-content: space-between; align-items: center">
        <h3>Aprovar comutação</h3>

        <button
          class="btn ghost"
          type="button"
          @click="showSwitchingApprovalModal = false"
        >
          Fechar
        </button>
      </div>

      <div class="hr"></div>

      <p class="switching-password-text">
        Confirme a comutação do plano usando a senha cadastrada pela liderança.
      </p>

      <label class="float-label">
        <input
          v-model="switchingPassword"
          type="password"
          placeholder=" "
          @keyup.enter="approveSwitchingFromInspection"
        />
        <span>Senha de comutação</span>
      </label>

      <div class="hstack" style="justify-content: flex-end; gap: 8px">
        <button
          class="btn ghost"
          type="button"
          @click="showSwitchingApprovalModal = false"
        >
          Cancelar
        </button>

        <button
          class="btn"
          type="button"
          :disabled="switchingActionLoading"
          @click="approveSwitchingFromInspection"
        >
          Confirmar e liberar plano
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.visual-summary {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
  font-size: 13px;
}

.visual-summary .ok {
  color: #16a34a;
  font-weight: 700;
}

.visual-summary .ng {
  color: #dc2626;
  font-weight: 700;
}

.visual-summary .total {
  color: var(--muted);
  font-weight: 600;
}

.inspection-time-box {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
}

.inspection-time-box div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 220px;
}

.inspection-time-box span {
  font-size: 12px;
  color: var(--muted, #64748b);
  font-weight: 700;
}

.inspection-time-box b {
  font-size: 14px;
  color: var(--text, #111827);
}

.reinspection-btn {
  background: #f59e0b;
  border-color: #f59e0b;
  color: #ffffff;
  font-weight: 700;
}

.reinspection-btn:hover {
  background: #d97706;
  border-color: #d97706;
}

.reinspection-header {
  display: inline-flex;
  align-items: center;
  margin-top: 4px;
  padding: 4px 10px;
  border: 1px solid #f59e0b;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.reinspection-info {
  display: grid;
  grid-template-columns: 1fr 100px 2fr;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #fed7aa;
  border-radius: 14px;
  background: #fff7ed;
}

.reinspection-info div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.reinspection-info span {
  font-size: 12px;
  color: #9a3412;
  font-weight: 700;
}

.reinspection-info b {
  font-size: 14px;
  color: #7c2d12;
}

@media (max-width: 800px) {
  .reinspection-info {
    grid-template-columns: 1fr;
  }
}

.linked-reinspection-alert {
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid #fdba74;
  border-radius: 14px;
  background: #fff7ed;
}

.linked-reinspection-alert div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.linked-reinspection-alert strong {
  color: #9a3412;
  font-size: 14px;
}

.linked-reinspection-alert span {
  color: #c2410c;
  font-size: 13px;
  font-weight: 600;
}

.origin-inspection-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.origin-inspection-info small {
  color: #9a3412;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
}
.char-trace-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 260px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
}

.char-trace-box div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.char-trace-box span {
  font-size: 11px;
  color: var(--muted, #64748b);
  font-weight: 700;
}

.char-trace-box b {
  font-size: 12px;
  color: var(--text, #111827);
  font-weight: 700;
}

.switching-gate {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
}

.switching-gate strong {
  font-size: 14px;
  font-weight: 900;
}

.switching-gate span {
  font-size: 13px;
  line-height: 1.4;
}

.switching-gate small {
  font-size: 12px;
  font-weight: 700;
}

.switching-gate.checking {
  background: #f8fafc;
  color: #475569;
}

.switching-gate.suggestion {
  background: #fff7ed;
  border-color: #fdba74;
  color: #9a3412;
}

.switching-gate.blocked {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #991b1b;
}

.switching-gate-details {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 13px;
}

.switching-password-modal {
  max-width: 520px;
}

.switching-password-text {
  margin: 0;
  font-size: 14px;
  color: var(--muted, #64748b);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(0.35);
  pointer-events: none;
}

.btn-switching-blocked {
  background: #e5e7eb !important;
  border-color: #d1d5db !important;
  color: #6b7280 !important;
}

.regime-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.2px;
  vertical-align: middle;
}

.regime-normal {
  color: #1d4ed8;
  background: #dbeafe;
  border: 1px solid #93c5fd;
}

.regime-atenuada {
  color: #166534;
  background: #dcfce7;
  border: 1px solid #86efac;
}

.regime-severa {
  color: #991b1b;
  background: #fee2e2;
  border: 1px solid #fca5a5;
}
.nbr-summary {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border-left: 3px solid #f59e0b;
  border-radius: 8px;
  background: #fffbeb;
}

.nbr-summary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nbr-summary-header b {
  color: #92400e;
  font-size: 13px;
}

.nbr-summary-result {
  font-size: 13px;
  color: var(--muted);
}

.inspection-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.inspection-section-heading .insp-section-title {
  margin: 0;
}

.inspection-section-heading .regime-badge {
  margin-left: 0;
  padding: 6px 12px;
  font-size: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
}
</style>
