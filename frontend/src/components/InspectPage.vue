<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useInspectionsStore } from "../stores/inspections";
import InspModal from "../components/InspModal.vue";
import { useAuthStore } from "../stores/auth";
import { useUiStore } from "../stores/ui";
import { exportInspectionPdf } from "../utils/pdf";
import { getLogoDataUrl } from "../utils/logo";
import { requestConfirmation } from "../services/systemFeedback";

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
const currentPage = ref(1);
const pageSize = 15;

const activeFilterCount = computed(() => {
  let count = 0;
  if (fStatus.value) count += 1;
  if (fResult.value) count += 1;
  if (fRecordType.value) count += 1;
  if (fFrom.value) count += 1;
  if (fTo.value) count += 1;
  if (canSelectInspectionArea.value && fType.value) count += 1;
  return count;
});

function clearFilters() {
  fStatus.value = "";
  fResult.value = "";
  fRecordType.value = "";
  fFrom.value = "";
  fTo.value = "";
  fType.value = canSelectInspectionArea.value ? "" : loggedInspectionArea.value || "";
}

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

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize))
);

const paginatedInspections = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filtered.value.slice(start, start + pageSize);
});

watch(
  [fStatus, fResult, fType, fRecordType, fFrom, fTo, () => ui.q],
  () => {
    currentPage.value = 1;
  }
);

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages;
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

  const ok = await requestConfirmation(message, {
    title: "Excluir inspeção",
    confirmLabel: "Excluir",
    danger: true,
  });

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
      <div class="inspect-filter-header">
        <div>
          <strong>Filtros</strong>
          <span>Refine os registros exibidos na tabela</span>
        </div>

        <div class="inspect-filter-summary">
          <span>{{ filtered.length }} resultado(s)</span>
          <button
            class="inspect-clear-filters"
            type="button"
            :disabled="activeFilterCount === 0"
            @click="clearFilters"
          >
            Limpar filtros
            <b v-if="activeFilterCount">{{ activeFilterCount }}</b>
          </button>
        </div>
      </div>

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
          Exportar CSV
        </button>

        <button class="btn" type="button" @click="openNew()">
          + Nova inspeção
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

            <tr v-else v-for="(x, idx) in paginatedInspections" :key="x.id">
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
                <div class="operations-cell">
                  <button
                    class="table-primary-action"
                    :class="{ 'table-primary-action-active': x.status !== 'done' }"
                    type="button"
                    @click="openEdit(x)"
                  >
                    {{ x.status === "done" ? "Visualizar" : "Continuar inspeção" }}
                  </button>

                  <details
                    class="operations-menu"
                    :class="idx >= paginatedInspections.length - 2 ? 'operations-menu-up' : 'operations-menu-down'"
                  >
                    <summary title="Mais ações" aria-label="Mais ações">•••</summary>

                    <div class="operations-list inspection-operations-list">
                      <button
                        type="button"
                        :disabled="x.status !== 'done'"
                        @click="exportPdf(x)"
                      >
                        Relatório PDF
                      </button>

                      <button
                        v-if="isAdmin"
                        class="operation-danger"
                        type="button"
                        @click="confirmRemove(x.id)"
                      >
                        Excluir
                      </button>
                    </div>
                  </details>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filtered.length" class="inspection-pagination">
        <span>
          Exibindo {{ paginatedInspections.length }} de {{ filtered.length }} inspeções
        </span>

        <div class="inspection-pagination-controls">
          <button
            class="btn ghost"
            type="button"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            Anterior
          </button>

          <b>Página {{ currentPage }} de {{ totalPages }}</b>

          <button
            class="btn ghost"
            type="button"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>

    <div class="inspection-mobile-list" aria-label="Registros de inspeção">
      <div v-if="insps.loading" class="card inspection-mobile-empty">Carregando inspeções...</div>
      <div v-else-if="!filtered.length" class="card inspection-mobile-empty">Nenhuma inspeção encontrada com os filtros atuais.</div>
      <article v-for="x in paginatedInspections" v-else :key="`mobile-${x.id}`" class="card inspection-mobile-card" :class="{ 'inspection-mobile-card-open': x.status !== 'done' }">
        <header>
          <div>
            <span class="inspection-mobile-area">{{ x.type || "—" }}</span>
            <span v-if="x.process" class="inspection-mobile-process">{{ x.process }}</span>
          </div>
          <span class="status-pill" :class="x.status === 'done' ? 'on' : 'off'">{{ x.status === "done" ? "Finalizada" : "Em andamento" }}</span>
        </header>

        <div class="inspection-mobile-title">
          <strong>{{ x.planName || "Plano não informado" }}</strong>
          <span>{{ x.pn || "PN não informado" }} · {{ x.model || "Modelo não informado" }}</span>
        </div>

        <dl class="inspection-mobile-details">
          <div><dt>Lote</dt><dd>{{ x.lot || "—" }}</dd></div>
          <div><dt>Turno</dt><dd>{{ x.shift || "—" }}</dd></div>
          <div><dt>Responsável</dt><dd>{{ x.resp || "—" }}</dd></div>
          <div><dt>Registro</dt><dd>{{ (x.createdAt || "").slice(0, 10) || "—" }}</dd></div>
        </dl>

        <div v-if="x.status === 'done'" class="inspection-mobile-result">
          <span>Resultado técnico</span>
          <b :class="x.result === 'PASS' ? 'text-ok' : x.result === 'FAIL' ? 'text-bad' : ''">{{ x.result || "—" }}</b>
        </div>

        <footer>
          <button class="table-primary-action" :class="{ 'table-primary-action-active': x.status !== 'done' }" type="button" @click="openEdit(x)">{{ x.status === "done" ? "Visualizar inspeção" : "Continuar inspeção" }}</button>
          <button v-if="x.status === 'done'" class="btn ghost" type="button" @click="exportPdf(x)">PDF</button>
        </footer>
      </article>

      <div v-if="filtered.length" class="inspection-mobile-pagination">
        <button class="btn ghost" type="button" :disabled="currentPage === 1" @click="currentPage--">Anterior</button>
        <span>{{ currentPage }} / {{ totalPages }}</span>
        <button class="btn ghost" type="button" :disabled="currentPage === totalPages" @click="currentPage++">Próxima</button>
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
