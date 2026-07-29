<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useInspectionsStore } from "../stores/inspections";
import InspModal from "../components/InspModal.vue";
import { useAuthStore } from "../stores/auth";
import { useUiStore } from "../stores/ui";
import { exportInspectionPdf } from "../utils/pdf";
import { getLogoDataUrl } from "../utils/logo";

async function exportPdf(row) {
  const logoDataUrl = await getLogoDataUrl();

  const originalInspection = row?.isReinspection
    ? insps.items.find((item) => String(item.id) === String(row.parentInspectionId)) ||
      null
    : null;

  exportInspectionPdf(row, {
    logoDataUrl,
    includeRawSamples: true,
    originalInspection,
  });
}

const insps = useInspectionsStore();
const ui = useUiStore();

const auth = useAuthStore();

const isAdmin = computed(() => auth.role === "admin");

/**
 * Área de inspeção vinculada ao usuário autenticado.
 *
 * IQC = visualiza somente registros IQC
 * OQC = visualiza somente registros OQC
 * ALL = visualiza registros IQC e OQC
 */
const loggedInspectionArea = computed(() => {
  const rawArea =
    auth.user?.inspectionArea ??
    auth.user?.inspection_area ??
    auth.inspectionArea ??
    auth.inspection_area ??
    "";

  const area = String(rawArea).trim().toUpperCase();

  return ["IQC", "OQC", "ALL"].includes(area) ? area : null;
});

console.log("Usuário autenticado:", auth.user);
console.log("Área autenticada:", loggedInspectionArea.value);

const canSelectInspectionArea = computed(() => loggedInspectionArea.value === "ALL");

const showInsp = ref(false);
const editingId = ref(null);

// ✅ filtros
const fStatus = ref(""); // "" | "draft" | "done"
const fResult = ref(""); // "" | "PASS" | "FAIL"
const fType = ref(""); // "" | "OQC" | "IQC"
const fRecordType = ref("");
const fFrom = ref(""); // yyyy-mm-dd
const fTo = ref(""); // yyyy-mm-dd

watch(
  loggedInspectionArea,
  (area) => {
    if (area === "IQC" || area === "OQC") {
      fType.value = area;
      return;
    }

    if (area === "ALL") {
      fType.value = "";
    }
  },
  { immediate: true }
);

function openNew() {
  editingId.value = null;
  showInsp.value = true;
}

function openEdit(row) {
  editingId.value = row.id;
  showInsp.value = true;
}

onMounted(async () => {
  await insps.load();
});

// -------- helpers de data --------
function isoDateOnly(iso) {
  return (iso || "").slice(0, 10);
}
function inDateRange(createdAtIso) {
  const d = isoDateOnly(createdAtIso);
  if (!d) return true;

  if (fFrom.value && d < fFrom.value) return false;
  if (fTo.value && d > fTo.value) return false;
  return true;
}

const filtered = computed(() => {
  const s = String(ui.q || "")
    .trim()
    .toLowerCase();

  const userArea = loggedInspectionArea.value;

  // Segurança: usuário sem área válida não visualiza registros.
  if (!userArea) {
    return [];
  }

  const base = [...(insps.items || [])].sort((a, b) => {
    const dateA = new Date(a.startedAt || a.createdAt || 0).getTime();

    const dateB = new Date(b.startedAt || b.createdAt || 0).getTime();

    return dateB - dateA;
  });

  return base.filter((x) => {
    const inspectionArea = String(x.type || x.inspectionArea || x.inspection_area || "")
      .trim()
      .toUpperCase();

    // Filtro obrigatório conforme a área do usuário autenticado.
    if (userArea !== "ALL" && inspectionArea !== userArea) {
      return false;
    }
    // filtros de combo
    if (fStatus.value && x.status !== fStatus.value) return false;
    if (fResult.value && x.result !== fResult.value) return false;

    // type pode não existir em inspeções antigas (fallback: do planoName não dá)
    if (fType.value && inspectionArea !== String(fType.value).trim().toUpperCase()) {
      return false;
    }

    // filtro: normal / reinspeção
    if (fRecordType.value === "normal" && x.isReinspection) return false;

    if (fRecordType.value === "reinspection" && !x.isReinspection) return false;

    // data
    if (!inDateRange(x.createdAt)) return false;

    // busca texto
    if (!s) return true;

    const blob = `${x.planName} ${x.pn} ${x.model} ${x.client} ${x.lot} ${
      x.invoice || ""
    } ${x.resp} ${x.supplier || ""}`.toLowerCase();
    return blob.includes(s);
  });
});

/**
 * Converte um valor para formato seguro de CSV
 */
function toCsvValue(v) {
  if (v == null) return '""';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

/**
 * Exporta as inspeções filtradas para CSV
 */
function exportCsv() {
  const rows = filtered.value;

  if (!rows.length) {
    alert("Não há inspeções para exportar (lista vazia).");
    return;
  }

  const header = [
    "Data",
    "Tipo",
    "Plano",
    "PN",
    "Modelo",
    "Cliente",
    "Fornecedor",
    "Lote",
    "Turno",
    "Responsável",
    "Status",
    "Resultado",
  ];

  const lines = [];
  lines.push(header.map(toCsvValue).join(";"));

  for (const x of rows) {
    const date = isoDateOnly(x.createdAt);
    const status = x.status === "done" ? "Finalizada" : "Em edição";
    const result = x.result || "";

    const line = [
      date,
      x.isReinspection
        ? `${x.type || "OQC"} - Reinspeção ${x.inspectionCycle || 2}`
        : x.type || "", // pode ficar vazio em inspeções antigas
      x.planName || "",
      x.pn || "",
      x.model || "",
      x.client || "",
      x.supplier || "",
      x.lot || "",
      x.shift || "",
      x.resp || "",
      status,
      result,
    ]
      .map(toCsvValue)
      .join(";");

    lines.push(line);
  }

  const csv = lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const today = new Date().toISOString().slice(0, 10);
  a.download = `inspecoes_${today}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function confirmRemove(id) {
  const inspection = insps.items.find((item) => String(item.id) === String(id));

  const linkedReinspection = insps.items.find((item) => {
    return (
      String(item.parentInspectionId || "") === String(id) && Boolean(item.isReinspection)
    );
  });

  let message =
    "Tem certeza que deseja excluir esta inspeção?\n\n" +
    "Esta ação não pode ser desfeita.";

  if (linkedReinspection) {
    message =
      "Atenção: esta inspeção possui uma reinspeção vinculada.\n\n" +
      `Tipo: ${inspection?.type || "—"}\n` +
      `Lote: ${inspection?.lot || "—"}\n` +
      `NF: ${inspection?.invoice || "—"}\n\n` +
      `Reinspeção vinculada: ciclo ${linkedReinspection.inspectionCycle || 2}\n` +
      `Status da reinspeção: ${
        linkedReinspection.status === "done" ? "Finalizada" : "Em andamento"
      }\n\n` +
      "Se você excluir esta inspeção, a rastreabilidade da origem poderá ser prejudicada.\n\n" +
      "Deseja continuar mesmo assim?";
  }

  const ok = confirm(message);

  if (!ok) return;

  await insps.remove(id);
}

function pdfDisabledTitle(x) {
  return x.status === "done" ? "" : "PDF disponível apenas para inspeções finalizadas.";
}
</script>

<template>
  <div class="vstack">
    <div class="title">Registros de Inspeção</div>
    <div class="tabline"></div>

    <div class="filterbar inspect-filter-card">
      <div class="inspect-filter-row">
        <div class="field">
          <label class="float-label">
            <select v-model="fStatus">
              <option value="">Todas as situações</option>
              <option value="draft">Inspeções em andamento</option>
              <option value="done">Inspeções finalizadas</option>
            </select>
            <span>Situação do registro</span>
          </label>
        </div>

        <div class="field">
          <label class="float-label">
            <select v-model="fResult">
              <option value="">Todos os resultados</option>
              <option value="PASS">Aprovado — PASS</option>
              <option value="FAIL">Reprovado — FAIL</option>
            </select>
            <span>Resultado técnico</span>
          </label>
        </div>

        <div class="field">
          <label class="float-label">
            <select v-model="fType" :disabled="!canSelectInspectionArea">
              <option v-if="canSelectInspectionArea" value="">Todas as áreas</option>

              <option
                v-if="canSelectInspectionArea || loggedInspectionArea === 'IQC'"
                value="IQC"
              >
                IQC — Qualidade de Entrada
              </option>

              <option
                v-if="canSelectInspectionArea || loggedInspectionArea === 'OQC'"
                value="OQC"
              >
                OQC — Qualidade de Saída
              </option>
            </select>

            <span>Área de inspeção</span>
          </label>
        </div>

        <div class="field">
          <label class="float-label">
            <select v-model="fRecordType">
              <option value="">Todos os registros</option>
              <option value="normal">Inspeções originais</option>
              <option value="reinspection">Registros de reinspeção</option>
            </select>
            <span>Tipo de registro</span>
          </label>
        </div>

        <div class="field">
          <label class="float-label">
            <input v-model="fFrom" type="date" placeholder=" " />
            <span>Período inicial</span>
          </label>
        </div>

        <div class="field">
          <label class="float-label">
            <input v-model="fTo" type="date" placeholder=" " />
            <span>Período final</span>
          </label>
        </div>
      </div>

      <div class="inspect-actions-row">
        <button class="btn ghost" type="button" @click="exportCsv()">
          Exportar registros
        </button>

        <button class="btn" type="button" @click="openNew()">
          + Iniciar nova inspeção
        </button>
      </div>
    </div>

    <div class="card tablecard">
      <div class="tablewrap">
        <table class="inspect-table">
          <thead>
            <tr>
              <th>Data do registro</th>
              <th>Área</th>
              <th>Plano de Inspeção</th>
              <th>PN</th>
              <th>Modelo</th>
              <th>Lote</th>
              <th>Turno</th>
              <th>Responsável Técnico</th>
              <th>Situação</th>
              <th>Resultado Técnico</th>
              <th class="actions-col">Operações</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="insps.loading">
              <td colspan="11">Carregando...</td>
            </tr>

            <tr v-else-if="filtered.length === 0">
              <td colspan="11">Nenhuma inspeção encontrada com os filtros atuais.</td>
            </tr>

            <tr v-else v-for="x in filtered" :key="x.id">
              <td>{{ (x.createdAt || "").slice(0, 10) }}</td>
              <td>
                <div class="inspection-type-cell">
                  <span class="inspection-type-text">
                    {{ x.type || "—" }}
                  </span>

                  <span v-if="x.isReinspection" class="reinspection-table-badge">
                    Reinspeção — Ciclo {{ x.inspectionCycle || 2 }}
                  </span>
                </div>
              </td>
              <td>{{ x.planName }}</td>
              <td>{{ x.pn }}</td>
              <td>{{ x.model }}</td>
              <td>{{ x.lot }}</td>
              <td>{{ x.shift }}</td>
              <td>{{ x.resp }}</td>
              <td>
                <span class="status-pill" :class="x.status === 'done' ? 'on' : 'off'">
                  {{ x.status === "done" ? "Finalizada" : "Em andamento" }}
                </span>
              </td>
              <td>
                <div class="inspection-result-cell">
                  <span
                    class="badge"
                    :class="
                      x.result === 'PASS' ? 'ok' : x.result === 'FAIL' ? 'warn' : ''
                    "
                  >
                    {{ x.result || "—" }}
                  </span>

                  <span
                    v-if="x.conditionalApprovalStatus === 'approved_conditional'"
                    class="conditional-approval-table-badge"
                  >
                    APROVADO CONDICIONALMENTE
                  </span>
                </div>
              </td>
              <td class="actions-col">
                <div class="actions-cell">
                  <button class="btn ghost action-btn" type="button" @click="openEdit(x)">
                    Visualizar
                  </button>

                  <button
                    class="btn ghost action-btn"
                    :disabled="x.status !== 'done'"
                    type="button"
                    @click="exportPdf(x)"
                  >
                    Relatório PDF
                  </button>

                  <button
                    v-if="isAdmin"
                    class="btn ghost danger action-btn"
                    type="button"
                    @click="confirmRemove(x.id)"
                  >
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <InspModal
    :show="showInsp"
    :id="editingId"
    @close="
      showInsp = false;
      editingId = null;
    "
  />
</template>
