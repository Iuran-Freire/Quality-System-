<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { usePlansStore } from "../stores/plans";
import { useInspectionsStore } from "../stores/inspections";
import { getSamplingPlan } from "../utils/sampling/nbr5426";
import { resolveSamplingSnapshot } from "../utils/sampling/resolveSamplingSnapshot";

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

// ----------------- CAMPOS -----------------
const planId = ref("");
const planSearch = ref("");
const lot = ref("");
const invoice = ref("");
const lotSize = ref(""); // tamanho do lote (NBR)
const date = ref(new Date().toISOString().slice(0, 10));
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

// lista de planos
const planList = computed(() => plans.items || []);
const selectedPlan = computed(
  () => planList.value.find((p) => String(p.id) === String(planId.value)) || null
);

function planOptionLabel(p) {
  return `${p.pn || "SEM PN"} — ${p.model || "-"} — ${p.name || "-"}`;
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

  const lsl = toNumber(char.lsl);
  const usl = toNumber(char.usl);

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
    const sp = getSamplingPlan({ lotSize: ls, aql, level });

    samplingSnapRef.value = {
      mode: "nbr5426",
      lotSize: ls,
      level,
      aql,
      codeLetter: sp.codeLetter,
      sampleN: sp.sampleN,
      ac: sp.ac,
      re: sp.re,
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
watch([planId, lotSize], () => {
  if (isEdit.value) return;
  computePlanSamplingFromSelectedPlan();
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
      date.value =
        (x.createdAt || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
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
      date.value = new Date().toISOString().slice(0, 10);
      resp.value = "";
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
    const l = toNumber(c.lsl);
    const u = toNumber(c.usl);

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
    const kind = getCharKind(c);

    if (!vals.length) {
      problems.push({
        charName: c.name || "Característica sem nome",
        sample: "-",
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
          reason: "em branco",
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

// ----------------- AÇÕES -----------------
async function createDraft() {
  const p = selectedPlan.value;
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
    obs: obs.value.trim(),

    chars,
    samples,

    planSamples: planSamplesRef.value,
    planBoxQty: Number(boxQtyRef.value ?? 2),
    boxQty: Number(boxQtyRef.value ?? 2),

    sampling: samplingSnapRef.value, // ✅ congela AQL/Ac/Re
    status: "draft",
    result: null,
    createdAt: new Date().toISOString(),
  });

  emit("close");
}

async function saveDraft() {
  if (!props.id) return alert("Crie a inspeção primeiro (rascunho).");

  const chars = currentChars.value;
  const res = calcResult(chars, localSamples.value);

  await insps.update(props.id, {
    lot: lot.value.trim(),
    invoice: invoice.value.trim(),
    lotSize: String(lotSize.value).trim() ? Number(lotSize.value) : null,
    shift: shift.value,
    resp: resp.value.trim(),
    obs: obs.value.trim(),
    samples: JSON.parse(JSON.stringify(localSamples.value)),
    status: "draft",
    result: res === "EMPTY" ? null : res,
    boxQty: Number(boxQtyRef.value ?? 2),
    sampling: samplingSnapRef.value || insp.value?.sampling || null, // ✅ mantém snapshot
  });

  emit("close");
}

async function finalizeInspection() {
  if (!props.id || !insp.value) return alert("Inspeção não encontrada.");

  const chars = currentChars.value;
  const res = calcResult(chars, localSamples.value);

  if (res === "EMPTY") {
    const problems = findInspectionProblems(chars, localSamples.value);

    console.table(problems);

    const msg = problems
      .slice(0, 15)
      .map((p) => {
        const valueText = p.value ? ` | valor: ${p.value}` : "";
        return `${p.charName} - Amostra ${p.sample}: ${p.reason}${valueText}`;
      })
      .join("\n");

    return alert(
      "Não foi possível finalizar a inspeção.\n\n" +
        "Existem amostras em branco ou com valor inválido:\n\n" +
        (msg || "Não foi possível identificar o item.") +
        (problems.length > 15 ? `\n\nE mais ${problems.length - 15} ocorrência(s).` : "")
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
    samples: JSON.parse(JSON.stringify(localSamples.value)),
    status: "done",
    result: res,
    finishedAt: new Date().toISOString(),
    boxQty: Number(boxQtyRef.value ?? 2),
    sampling: samplingSnapRef.value || insp.value?.sampling || null, // ✅ mantém snapshot
  });

  emit("close");
}
</script>

<template>
  <div class="modal" :class="{ show: props.show }" @click.self="emit('close')">
    <div class="sheet vstack">
      <div class="hstack" style="justify-content: space-between; align-items: center">
        <h3>{{ isEdit ? "Editar Inspeção" : "Nova Inspeção" }}</h3>
        <button class="btn ghost" type="button" @click="emit('close')">Fechar</button>
      </div>

      <div class="hr"></div>

      <h4 class="insp-section-title">Dados da inspeção</h4>

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
            <template v-if="samplingSnapRef?.error">
              {{ samplingSnapRef.error }}
            </template>
            <template v-else-if="samplingSnapRef?.sampleN">
              N={{ samplingSnapRef.sampleN }} | Ac={{ samplingSnapRef.ac }} Re={{
                samplingSnapRef.re
              }}
              (AQL {{ samplingSnapRef.aql }} / Nível {{ samplingSnapRef.level }} / Código
              {{ samplingSnapRef.codeLetter }})
            </template>
            <template v-else>
              Informe o tamanho do lote para calcular n / Ac / Re.
            </template>
          </div>
        </div>
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

                <template v-if="getCharKind(c) === 'variavel'">
                  — LSL: {{ c.lsl ?? "-" }} | USL: {{ c.usl ?? "-" }}
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
              <template v-if="isNumericChar(c) && statsMap[c.id]?.ok">
                <span class="cpk-pill" :class="cpkClass(statsMap[c.id]?.cpk)">
                  Cpk {{ fmt(statsMap[c.id]?.cpk, 2) }}
                </span>
              </template>
              <template v-else-if="isNumericChar(c)">
                <span class="cpk-pill cpk-warn">Cpk —</span>
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
                  <template v-if="isNumericChar(c) && statsMap[c.id]?.ok">
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

                  <template v-else-if="isNumericChar(c)">
                    <span class="char-stats-muted">
                      Cpk indisponível: {{ statsMap[c.id]?.reason || "—" }}
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
                            @blur="
                              localSamples[c.id][idx] = normVisual(
                                localSamples[c.id][idx]
                              )
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

        <button v-if="!isEdit" class="btn" type="button" @click="createDraft">
          Criar inspeção (rascunho)
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
</style>
