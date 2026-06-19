<script setup>
import { reactive, watch, computed, onMounted, ref } from "vue";
import { usePlansStore } from "../stores/plans";

const props = defineProps({
  show: { type: Boolean, default: false },
  id: { type: String, default: null }, // id do plano (edição) ou null (novo)
});

const emit = defineEmits(["close"]);

const plans = usePlansStore();
const isEdit = computed(() => !!props.id);
const cloneSourceId = ref("");

onMounted(() => {
  plans.load();
});

function cid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

// ---------------- FORM ----------------
const form = reactive({
  id: null,
  name: "",
  model: "",
  client: "",
  pn: "",
  resp: "",
  supplier: "",
  type: "OQC",

  // amostragem fixa (fallback e também usada quando sampling.mode="fixed")
  n: 10,

  // qtd fixa de caixas no nível do plano (para visual_caixa)
  boxQty: 2,

  // ✅ NOVO: definição de norma/amostragem no PLANO
  // fixed   -> usa form.n
  // nbr5426 -> usa lotSize na inspeção + AQL/Level daqui (gera n/Ac/Re)
  // client  -> norma própria do cliente (por enquanto só guardamos os campos)
  sampling: {
    mode: "fixed", // "fixed" | "nbr5426" | "client"
    standard: "NBR 5426",
    level: "II",
    aql: 1.0,
    clientName: "",
    note: "",

    // amostragem fixa por regime
    fixedNormalN: 10,
    fixedReducedN: 5,
    fixedTightenedN: 15,
  },

  chars: [],
});

const hasVisualCaixa = computed(
  () => Array.isArray(form.chars) && form.chars.some((c) => c.kind === "visual_caixa")
);

function resetForm() {
  cloneSourceId.value = "";

  form.id = null;
  form.name = "";
  form.model = "";
  form.client = "";
  form.pn = "";
  form.resp = "";
  form.supplier = "";
  form.type = "OQC";
  form.n = 10;
  form.boxQty = 2;

  form.sampling = {
    mode: "fixed",
    standard: "NBR 5426",
    level: "II",
    aql: 1.0,
    clientName: "",
    note: "",
  };

  form.chars = [];
}

function normalizeChar(raw) {
  const c = { ...raw };

  if (!c.kind) {
    const hasLimits =
      String(c.lsl ?? "").trim() !== "" && String(c.usl ?? "").trim() !== "";
    c.kind = hasLimits ? "variavel" : "visual_produto";
  }

  c.id = c.id || cid();
  c.name = c.name ?? "";
  c.category = c.category ?? "Dimensional";
  c.lsl = c.lsl ?? "";
  c.usl = c.usl ?? "";
  c.unit = c.unit ?? "";
  c.method = c.method ?? "";

  if (c.kind === "visual_caixa") {
    c.resultMode = null;

    const sn = Number(c.sampleN ?? c.boxQty ?? form.boxQty ?? 2);
    c.sampleN = Number.isFinite(sn) && sn > 0 ? sn : 2;

    c.lsl = "";
    c.usl = "";
    c.unit = "";

    return c;
  }

  if (c.kind === "teste_especial") {
    c.resultMode = c.resultMode || "visual";

    const sn = Number(c.sampleN ?? 1);
    c.sampleN = Number.isFinite(sn) && sn > 0 ? sn : 1;

    if (c.resultMode !== "numerico") {
      c.lsl = "";
      c.usl = "";
      c.unit = "";
    }

    return c;
  }

  c.resultMode = null;
  c.sampleN = null;

  if (c.kind !== "variavel") {
    c.lsl = "";
    c.usl = "";
    c.unit = "";
  }

  return c;
}

/**
 * Quando o modal abre:
 *  - se props.id → carrega plano (edição)
 *  - se não → reset (novo)
 */
watch(
  () => props.show,
  (open) => {
    if (!open) return;

    if (props.id) {
      const p = plans.items.find((x) => x.id === props.id);
      if (p) {
        form.id = p.id;
        form.name = p.name || "";
        form.model = p.model || "";
        form.client = p.client || "";
        form.pn = p.pn || "";
        form.resp = p.resp || "";
        form.supplier = p.supplier || "";
        form.type = p.type || "OQC";

        form.n = p.n ?? 10;
        form.boxQty = p.boxQty ?? 2;

        // ✅ carregar sampling (com defaults)
        const s = p.sampling || {};
        form.sampling.mode = s.mode || "fixed";
        form.sampling.standard = s.standard || "NBR 5426";
        form.sampling.level = s.level || "II";
        form.sampling.aql =
          s.aql != null && String(s.aql).trim() !== "" ? Number(s.aql) : 1.0;
        form.sampling.clientName = s.clientName || "";
        form.sampling.note = s.note || "";
        form.sampling.fixedNormalN =
          Number(s.fixedNormalN || s.normalN || p.n || 10) || 10;

        form.sampling.fixedReducedN =
          Number(
            s.fixedReducedN ||
              s.reducedN ||
              s.atenuadaN ||
              form.sampling.fixedNormalN ||
              5
          ) || 5;

        form.sampling.fixedTightenedN =
          Number(
            s.fixedTightenedN ||
              s.tightenedN ||
              s.severaN ||
              form.sampling.fixedNormalN ||
              15
          ) || 15;

        const rawChars = Array.isArray(p.chars) ? p.chars : [];
        form.chars = rawChars.map((c) => normalizeChar(JSON.parse(JSON.stringify(c))));
      }
    } else {
      resetForm();
    }
  }
);
function cloneCharacteristicsFromPlan() {
  if (!cloneSourceId.value) {
    alert("Selecione um plano para clonar as características.");
    return;
  }

  const sourcePlan = plans.items.find(
    (p) => String(p.id) === String(cloneSourceId.value)
  );

  if (!sourcePlan) {
    alert("Plano selecionado não encontrado.");
    return;
  }

  const sourceChars = Array.isArray(sourcePlan.chars) ? sourcePlan.chars : [];

  if (!sourceChars.length) {
    alert("O plano selecionado não possui características para clonar.");
    return;
  }

  const ok = confirm(
    "Deseja clonar as características deste plano?\n\n" +
      "Atenção: os valores Mín/Máx serão removidos.\n" +
      "Os dados do plano atual não serão alterados."
  );

  if (!ok) return;

  form.chars = sourceChars.map((raw) => {
    const c = normalizeChar(JSON.parse(JSON.stringify(raw)));

    c.id = cid();

    // remove limites numéricos
    c.lsl = "";
    c.usl = "";

    // mantém unidade/método/categoria/nome/tipo para agilizar
    c.unit = c.unit || "";
    c.method = c.method || "";
    c.category = c.category || "Outros";

    // se for teste especial numérico, mantém como numérico,
    // mas sem mínimo e máximo
    if (c.kind === "teste_especial" && c.resultMode === "numerico") {
      c.lsl = "";
      c.usl = "";
    }

    return c;
  });

  alert(
    `${form.chars.length} característica(s) clonada(s).\n\n` +
      "Agora preencha os dados do novo plano e ajuste os limites quando necessário."
  );
}

function addChar(kind = "variavel") {
  form.chars.push({
    id: cid(),
    kind,
    name: "",
    lsl: "",
    usl: "",
    unit: "",
    method: "",
    category:
      kind === "visual_produto" || kind === "visual_caixa"
        ? "Visual"
        : kind === "teste_especial"
        ? "Funcional"
        : "Dimensional",

    resultMode: kind === "teste_especial" ? "visual" : null,

    sampleN: kind === "teste_especial" ? 1 : kind === "visual_caixa" ? 2 : null,
  });
}

function removeChar(id) {
  const i = form.chars.findIndex((c) => c.id === id);
  if (i >= 0) form.chars.splice(i, 1);
}

function onKindChange(c) {
  if (c.kind === "visual_caixa") {
    c.resultMode = null;

    const sn = Number(c.sampleN ?? 2);
    c.sampleN = Number.isFinite(sn) && sn > 0 ? sn : 2;

    c.lsl = "";
    c.usl = "";
    c.unit = "";
    return;
  }

  if (c.kind === "teste_especial") {
    c.resultMode = c.resultMode || "visual";

    const sn = Number(c.sampleN ?? 1);
    c.sampleN = Number.isFinite(sn) && sn > 0 ? sn : 1;

    if (c.resultMode !== "numerico") {
      c.lsl = "";
      c.usl = "";
      c.unit = "";
    }

    return;
  }

  c.resultMode = null;
  c.sampleN = null;

  if (c.kind !== "variavel") {
    c.lsl = "";
    c.usl = "";
    c.unit = "";
  }
}

function onResultModeChange(c) {
  if (c.kind !== "teste_especial") return;

  if (c.resultMode !== "numerico") {
    c.lsl = "";
    c.usl = "";
    c.unit = "";
  }
}

const isSamplingFixed = computed(() => form.sampling?.mode === "fixed");
const isSamplingNBR = computed(() => form.sampling?.mode === "nbr5426");
const isSamplingClient = computed(() => form.sampling?.mode === "client");

watch(
  () => form.sampling.mode,
  (mode) => {
    // limpeza/ajustes básicos ao trocar
    if (mode === "fixed") {
      form.sampling.standard = form.sampling.standard || "NBR 5426";
      form.sampling.level = form.sampling.level || "II";
      form.sampling.aql = Number(form.sampling.aql ?? 1.0) || 1.0;
      form.sampling.clientName = "";

      form.sampling.fixedNormalN =
        Number(form.sampling.fixedNormalN || form.n || 10) || 10;

      form.sampling.fixedReducedN = Number(form.sampling.fixedReducedN || 5) || 5;

      form.sampling.fixedTightenedN = Number(form.sampling.fixedTightenedN || 15) || 15;

      form.n = Number(form.sampling.fixedNormalN || form.n || 10) || 10;
    }
    if (mode === "nbr5426") {
      form.sampling.standard = "NBR 5426";
      form.sampling.level = form.sampling.level || "II";
      form.sampling.aql = Number(form.sampling.aql ?? 1.0) || 1.0;
      form.sampling.clientName = "";
    }
    if (mode === "client") {
      // mantém campos, mas sugere
      form.sampling.standard = form.sampling.standard || "Norma do cliente";
    }
  }
);

function charBadgeLabel(c) {
  if (c.kind === "variavel") return "Variável Numérica";
  if (c.kind === "visual_caixa") return "Visual (Caixa)";
  if (c.kind === "visual_produto") return "Visual (Produto)";

  if (c.kind === "teste_especial") {
    return c.resultMode === "numerico"
      ? "Teste Especial — Numérico"
      : "Teste Especial — OK/NG";
  }

  return "Característica";
}

function normalizeNumber(v) {
  return Number(String(v ?? "").replace(",", "."));
}

async function save() {
  // validação mínima
  if (!form.name.trim()) return alert("Preencha o Nome do plano.");
  if (!form.model.trim()) return alert("Preencha o Modelo.");
  if (!form.client.trim()) return alert("Preencha o Cliente.");
  if (!form.supplier.trim()) return alert("Preencha o Fornecedor.");
  if (!form.pn.trim()) return alert("Preencha o PN.");
  if (!form.resp.trim()) return alert("Preencha o Responsável.");

  // amostragem fixa exige n
  // amostragem fixa exige n por regime
  if (isSamplingFixed.value) {
    const normalN = Number(form.sampling.fixedNormalN);
    const reducedN = Number(form.sampling.fixedReducedN);
    const tightenedN = Number(form.sampling.fixedTightenedN);

    if (!Number.isFinite(normalN) || normalN < 1) {
      return alert("Amostra Normal precisa ser >= 1.");
    }

    if (!Number.isFinite(reducedN) || reducedN < 1) {
      return alert("Amostra Atenuada precisa ser >= 1.");
    }

    if (!Number.isFinite(tightenedN) || tightenedN < 1) {
      return alert("Amostra Severa precisa ser >= 1.");
    }

    form.n = normalN;
  } else {
    if (form.n && Number(form.n) < 1) {
      return alert("Amostras (n) precisa ser >= 1.");
    }
  }
  // NBR exige AQL + Level válidos
  if (isSamplingNBR.value) {
    const aql = Number(form.sampling.aql);
    if (!Number.isFinite(aql) || aql <= 0) {
      return alert("AQL (NQA) precisa ser um número > 0.");
    }
    const level = String(form.sampling.level || "").toUpperCase();
    if (!["S1", "S2", "S3", "S4", "I", "II", "III"].includes(level)) {
      return alert("Nível de inspeção inválido. Use S1, S2, S3, S4, I, II ou III.");
    }
    form.sampling.level = level;
    form.sampling.standard = "NBR 5426";
  }

  // Norma do cliente exige nome
  if (isSamplingClient.value) {
    if (!String(form.sampling.clientName || "").trim()) {
      return alert("Informe o nome/identificação da norma do cliente.");
    }
  }

  // limpa chars vazias
  const chars = form.chars
    .map((c) => {
      const kind = c.kind || "variavel";

      return {
        ...c,
        kind,
        category: c.category || "Outros",
        name: String(c.name || "").trim(),
        unit: String(c.unit || "").trim(),
        method: String(c.method || "").trim(),
        lsl: c.lsl ?? "",
        usl: c.usl ?? "",

        resultMode: kind === "teste_especial" ? c.resultMode || "visual" : null,

        sampleN:
          kind === "teste_especial"
            ? Math.max(1, Number(c.sampleN ?? 1) || 1)
            : kind === "visual_caixa"
            ? Math.max(1, Number(c.sampleN ?? 2) || 2)
            : null,
      };
    })
    .filter((c) => c.name.length > 0)
    .map((c) => {
      if (c.kind === "visual_caixa") {
        c.resultMode = null;
        c.lsl = "";
        c.usl = "";
        c.unit = "";
        c.sampleN = Math.max(1, Number(c.sampleN ?? 2) || 2);
        return c;
      }

      if (c.kind === "teste_especial") {
        c.sampleN = Math.max(1, Number(c.sampleN ?? 1) || 1);

        if (c.resultMode !== "numerico") {
          c.lsl = "";
          c.usl = "";
          c.unit = "";
        }

        return c;
      }

      if (c.kind !== "variavel") {
        c.lsl = "";
        c.usl = "";
        c.unit = "";
        c.sampleN = null;
        c.resultMode = null;
      }
      return c;
    });

  if (!chars.length) {
    return alert("Adicione pelo menos uma característica ou teste ao plano.");
  }

  for (const c of chars) {
    const isNumeric =
      c.kind === "variavel" ||
      (c.kind === "teste_especial" && c.resultMode === "numerico");

    if (!isNumeric) continue;

    const hasMin = String(c.lsl ?? "").trim() !== "";
    const hasMax = String(c.usl ?? "").trim() !== "";

    if (!hasMin || !hasMax) {
      return alert(`Informe Mín e Máx para: ${c.name}`);
    }

    const min = normalizeNumber(c.lsl);
    const max = normalizeNumber(c.usl);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return alert(`Mín e Máx precisam ser numéricos em: ${c.name}`);
    }

    if (min >= max) {
      return alert(`O valor Mín precisa ser menor que o Máx em: ${c.name}`);
    }
  }

  for (const c of chars) {
    if (c.kind === "teste_especial") {
      if (!Number.isFinite(Number(c.sampleN)) || Number(c.sampleN) < 1) {
        return alert(`Informe a quantidade de amostras do teste: ${c.name}`);
      }

      if (c.resultMode === "numerico") {
        const hasLsl = String(c.lsl ?? "").trim() !== "";
        const hasUsl = String(c.usl ?? "").trim() !== "";

        if (!hasLsl || !hasUsl) {
          return alert(`Informe LSL e USL para o teste especial numérico: ${c.name}`);
        }
      }
    }
  }

  for (const c of chars) {
    if (c.kind === "visual_caixa") {
      if (!Number.isFinite(Number(c.sampleN)) || Number(c.sampleN) < 1) {
        return alert(`Informe a quantidade de caixas do teste: ${c.name}`);
      }
    }
  }

  const payload = {
    id: form.id || props.id || null,
    name: form.name.trim(),
    model: form.model.trim(),
    client: form.client.trim(),
    pn: form.pn.trim(),
    resp: form.resp.trim(),
    supplier: form.supplier.trim(),
    type: form.type,

    // sempre mantém n como fallback (mesmo que o plano use NBR)
    n: form.n ? Number(form.n) : 10,

    // boxQty no plano (só relevante se existir visual_caixa)
    boxQty: chars.find((c) => c.kind === "visual_caixa")?.sampleN
      ? Number(chars.find((c) => c.kind === "visual_caixa").sampleN)
      : 2,

    // ✅ NOVO: sampling do plano
    sampling: {
      mode: form.sampling.mode,
      standard: String(form.sampling.standard || "").trim(),
      level: String(form.sampling.level || "II").toUpperCase(),
      aql: form.sampling.aql != null ? Number(form.sampling.aql) : null,
      clientName: String(form.sampling.clientName || "").trim(),
      note: String(form.sampling.note || "").trim(),

      fixedNormalN: isSamplingFixed.value ? Number(form.sampling.fixedNormalN) : null,

      fixedReducedN: isSamplingFixed.value ? Number(form.sampling.fixedReducedN) : null,

      fixedTightenedN: isSamplingFixed.value
        ? Number(form.sampling.fixedTightenedN)
        : null,
    },

    active: true,
    chars,
  };

  await plans.save(payload);
  emit("close");
}
</script>

<template>
  <div class="modal" :class="{ show: show }" @click.self="emit('close')">
    <div class="sheet vstack">
      <div class="hstack" style="justify-content: space-between; align-items: center">
        <h3>{{ isEdit ? "Editar Plano de Inspeção" : "Novo Plano de Inspeção" }}</h3>
        <button class="btn ghost" @click="emit('close')">Fechar</button>
      </div>

      <div v-if="!isEdit" class="clone-plan-box">
        <div class="clone-plan-text">
          <strong>Usar plano existente como base</strong>
          <span>
            Importe a estrutura de características e testes de um plano existente,
            mantendo os limites em branco para nova parametrização.
          </span>
        </div>

        <div class="clone-plan-actions">
          <label class="float-label clone-select">
            <select v-model="cloneSourceId">
              <option value="">Selecione um plano...</option>

              <option v-for="p in plans.items" :key="p.id" :value="p.id">
                {{ p.type }} | {{ p.pn }} | {{ p.model }} | {{ p.name }}
              </option>
            </select>
            <span>Plano base</span>
          </label>

          <button
            class="btn ghost clone-btn"
            type="button"
            @click="cloneCharacteristicsFromPlan"
          >
            Clonar características
          </button>
        </div>
      </div>

      <h4 class="modal-section-title">Dados do plano</h4>

      <div class="row">
        <div class="span-2">
          <label class="float-label">
            <input v-model="form.name" placeholder=" " />
            <span>Nome do plano *</span>
          </label>
        </div>

        <div class="span-2">
          <label class="float-label">
            <input v-model="form.model" placeholder=" " />
            <span>Modelo *</span>
          </label>
        </div>

        <div class="span-2">
          <label class="float-label">
            <input v-model="form.supplier" placeholder=" " />
            <span>Fornecedor *</span>
          </label>
        </div>

        <div class="span-2">
          <label class="float-label">
            <input v-model="form.client" placeholder=" " />
            <span>Cliente *</span>
          </label>
        </div>

        <div class="span-2">
          <label class="float-label">
            <input v-model="form.pn" placeholder=" " />
            <span>PN *</span>
          </label>
        </div>

        <div class="span-2">
          <label class="float-label">
            <input v-model="form.resp" placeholder=" " />
            <span>Responsável *</span>
          </label>
        </div>

        <div class="span-2">
          <label class="float-label">
            <select v-model="form.type">
              <option value="OQC">OQC</option>
              <option value="IQC">IQC</option>
            </select>
            <span>Tipo</span>
          </label>
        </div>
      </div>

      <div class="hr"></div>

      <!-- ✅ NOVO: AMOSTRAGEM / NORMA -->
      <h4 style="margin: 0 0 6px 0">Amostragem / Norma</h4>

      <div class="row">
        <div class="span-2">
          <label class="float-label">
            <select v-model="form.sampling.mode">
              <option value="fixed">Fixo (usar n do plano)</option>
              <option value="nbr5426">NBR 5426 (AQL / nível)</option>
              <option value="client">Norma do cliente</option>
            </select>
            <span>Modo de amostragem</span>
          </label>
        </div>

        <template v-if="form.sampling.mode === 'fixed'">
          <div class="span-1">
            <label class="float-label">
              <input
                v-model.number="form.sampling.fixedNormalN"
                type="number"
                min="1"
                placeholder=" "
              />
              <span>Amostra Normal</span>
            </label>
          </div>

          <div class="span-1">
            <label class="float-label">
              <input
                v-model.number="form.sampling.fixedReducedN"
                type="number"
                min="1"
                placeholder=" "
              />
              <span>Amostra Atenuada</span>
            </label>
          </div>

          <div class="span-1">
            <label class="float-label">
              <input
                v-model.number="form.sampling.fixedTightenedN"
                type="number"
                min="1"
                placeholder=" "
              />
              <span>Amostra Severa</span>
            </label>
          </div>
        </template>

        <div class="span-1" v-else-if="form.sampling.mode === 'nbr5426'">
          <div class="field">
            <label class="float-label">
              <input value="Calculado na inspeção" disabled placeholder=" " />
              <span>Amostras (n)</span>
            </label>
          </div>
        </div>

        <template v-if="form.sampling.mode === 'nbr5426'">
          <div class="span-1">
            <label class="float-label">
              <select v-model="form.sampling.level">
                <option value="S1">S1</option>
                <option value="S2">S2</option>
                <option value="S3">S3</option>
                <option value="S4">S4</option>
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
              </select>
              <span>Nível</span>
            </label>
          </div>

          <div class="span-1">
            <label class="float-label">
              <select v-model.number="form.sampling.aql">
                <option :value="0.1">0,1</option>
                <option :value="0.15">0,15</option>
                <option :value="0.25">0,25</option>
                <option :value="0.4">0,4</option>
                <option :value="0.65">0,65</option>
                <option :value="1.0">1</option>
              </select>
              <span>AQL (NQA)</span>
            </label>
          </div>

          <div class="span-3">
            <label class="float-label">
              <input v-model="form.sampling.note" placeholder=" " />
              <span>Observação (opcional)</span>
            </label>
          </div>
        </template>

        <template v-else-if="form.sampling.mode === 'client'">
          <div class="span-2">
            <label class="float-label">
              <input v-model="form.sampling.clientName" placeholder=" " />
              <span>Nome/ID da norma do cliente *</span>
            </label>
          </div>

          <div class="span-3">
            <label class="float-label">
              <input v-model="form.sampling.note" placeholder=" " />
              <span>Observação (opcional)</span>
            </label>
          </div>
        </template>

        <div class="span-6" style="margin-top: -4px">
          <div style="font-size: 12.5px; color: var(--muted)">
            <template v-if="form.sampling.mode === 'fixed'">
              <b>Dica:</b>
              Na amostragem fixa, a comutação altera automaticamente o n do plano:
              <b>Normal</b>, <b>Atenuada</b> ou <b>Severa</b>.
            </template>

            <template v-else-if="form.sampling.mode === 'nbr5426'">
              <b>Dica:</b>
              Se selecionar <b>NBR 5426</b>, o sistema vai calcular <b>n / Ac / Re</b> na
              inspeção usando o <b>Tamanho do lote</b> informado pelo inspetor.
            </template>

            <template v-else>
              <b>Dica:</b>
              Para norma do cliente, informe a identificação da regra e mantenha a
              observação preenchida quando necessário.
            </template>
          </div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="hstack between" style="align-items: center">
        <h4 style="margin: 0">Características e testes</h4>

        <div class="hstack" style="gap: 8px; flex-wrap: wrap">
          <button @click="addChar('variavel')">+ Variável (CPK)</button>
          <button @click="addChar('visual_produto')">+ Visual Produto</button>
          <button @click="addChar('visual_caixa')">+ Visual Caixa</button>
          <button @click="addChar('teste_especial')">+ Teste Especial</button>
        </div>
      </div>

      <div v-if="form.chars.length === 0" style="color: var(--muted); font-size: 13px">
        Nenhuma característica ou teste adicionada ainda. Use os botões acima para
        adicionar.
      </div>

      <div
        v-for="c in form.chars"
        :key="c.id"
        class="card"
        style="box-shadow: var(--shadow-min)"
      >
        <div class="hstack between" style="align-items: center; gap: 12px">
          <div class="badge dot warn">
            {{ charBadgeLabel(c) }}
          </div>
          <button class="btn ghost danger" type="button" @click="removeChar(c.id)">
            Remover
          </button>
        </div>

        <div class="row" style="margin-top: 10px">
          <div class="span-4">
            <label class="float-label">
              <input v-model="c.name" placeholder=" " />
              <span>
                {{ c.kind === "teste_especial" ? "Nome do teste *" : "Característica *" }}
              </span>
            </label>
          </div>

          <template v-if="c.kind === 'visual_caixa'">
            <div class="span-1">
              <label class="float-label">
                <input v-model.number="c.sampleN" type="number" min="1" placeholder=" " />
                <span>Qtd. Caixas</span>
              </label>
            </div>
          </template>

          <template v-if="c.kind === 'teste_especial'">
            <div class="span-1">
              <label class="float-label">
                <input v-model.number="c.sampleN" type="number" min="1" placeholder=" " />
                <span>Amostras</span>
              </label>
            </div>

            <div class="span-2">
              <label class="float-label">
                <select v-model="c.resultMode" @change="onResultModeChange(c)">
                  <option value="visual">OK/NG</option>
                  <option value="numerico">Numérico</option>
                </select>
                <span>Resultado</span>
              </label>
            </div>
          </template>

          <template
            v-if="
              c.kind === 'variavel' ||
              (c.kind === 'teste_especial' && c.resultMode === 'numerico')
            "
          >
            <div class="span-1">
              <label class="float-label">
                <input v-model="c.lsl" placeholder=" " />
                <span>Mín</span>
              </label>
            </div>

            <div class="span-1">
              <label class="float-label">
                <input v-model="c.usl" placeholder=" " />
                <span>Máx</span>
              </label>
            </div>

            <div class="span-1">
              <label class="float-label">
                <input v-model="c.unit" placeholder=" " />
                <span>Unidade</span>
              </label>
            </div>
          </template>

          <div class="span-2">
            <label class="float-label">
              <input v-model="c.method" placeholder=" " />
              <span>Método / Equipamento</span>
            </label>
          </div>

          <div class="span-2">
            <label class="float-label">
              <select v-model="c.category">
                <option value="Dimensional">Dimensional</option>
                <option value="Visual">Visual</option>
                <option value="Funcional">Funcional</option>
                <option value="Aparência">Aparência</option>
                <option value="Outros">Outros</option>
              </select>
              <span>Categoria</span>
            </label>
          </div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="hstack" style="justify-content: flex-end; gap: 8px">
        <button class="btn ghost" type="button" @click="emit('close')">Cancelar</button>
        <button class="btn" type="button" @click="save">
          {{ isEdit ? "Salvar alterações" : "Salvar plano" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-section-title {
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.clone-plan-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 1px solid #fed7aa;
  border-radius: 16px;
  background: #fff7ed;
}

.clone-plan-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.clone-plan-text strong {
  color: #7c2d12;
  font-size: 14px;
}

.clone-plan-text span {
  color: #9a3412;
  font-size: 12.5px;
}

.clone-plan-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 520px;
}

.clone-select {
  flex: 1;
}

.clone-btn {
  border-color: #f59e0b;
  color: #c2410c;
  background: #ffffff;
  white-space: nowrap;
}

.clone-btn:hover {
  background: #ffedd5;
  border-color: #f97316;
}

@media (max-width: 900px) {
  .clone-plan-box {
    flex-direction: column;
    align-items: stretch;
  }

  .clone-plan-actions {
    min-width: 0;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
