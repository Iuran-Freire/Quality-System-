<script setup>
import { ref, computed, onMounted } from "vue";
import { useInspectionsStore } from "../stores/inspections";
import InspModal from "../components/InspModal.vue";
import { useAuthStore } from "../stores/auth";
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

const auth = useAuthStore();
const isAdmin = computed(() => auth.role === "admin");

const q = ref("");
const showInsp = ref(false);
const editingId = ref(null);

// ✅ filtros
const fStatus = ref(""); // "" | "draft" | "done"
const fResult = ref(""); // "" | "PASS" | "FAIL"
const fType = ref(""); // "" | "OQC" | "IQC"
const fRecordType = ref("");
const fFrom = ref(""); // yyyy-mm-dd
const fTo = ref(""); // yyyy-mm-dd

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
  const s = q.value.trim().toLowerCase();

  // garante ordenação por data decrescente
  const base = [...(insps.items || [])].sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );

  return base.filter((x) => {
    // filtros de combo
    if (fStatus.value && x.status !== fStatus.value) return false;
    if (fResult.value && x.result !== fResult.value) return false;

    // type pode não existir em inspeções antigas (fallback: do planoName não dá)
    if (fType.value && String(x.type || "") !== fType.value) return false;

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
    <div class="title">Inspeção</div>
    <div class="tabline"></div>

    <div class="filterbar inspect-filter-card">
      <div class="inspect-search-row">
        <div class="field grow">
          <label class="float-label">
            <input v-model="q" placeholder=" " />
            <span>Buscar por plano, PN, lote ou responsável</span>
          </label>
        </div>
      </div>

      <div class="inspect-filter-row">
        <div class="field">
          <label class="float-label">
            <select v-model="fStatus">
              <option value="">Status (todos)</option>
              <option value="draft">Em edição</option>
              <option value="done">Finalizada</option>
            </select>
            <span>Status</span>
          </label>
        </div>

        <div class="field">
          <label class="float-label">
            <select v-model="fResult">
              <option value="">Resultado (todos)</option>
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
            </select>
            <span>Resultado</span>
          </label>
        </div>

        <div class="field">
          <label class="float-label">
            <select v-model="fType">
              <option value="">Tipo (todos)</option>
              <option value="OQC">OQC</option>
              <option value="IQC">IQC</option>
            </select>
            <span>Tipo</span>
          </label>
        </div>

        <div class="field">
          <label class="float-label">
            <select v-model="fRecordType">
              <option value="">Registro (todos)</option>
              <option value="normal">Inspeções normais</option>
              <option value="reinspection">Reinspeções</option>
            </select>
            <span>Registro</span>
          </label>
        </div>

        <div class="field">
          <label class="float-label">
            <input v-model="fFrom" type="date" placeholder=" " />
            <span>De</span>
          </label>
        </div>

        <div class="field">
          <label class="float-label">
            <input v-model="fTo" type="date" placeholder=" " />
            <span>Até</span>
          </label>
        </div>
      </div>

      <div class="inspect-actions-row">
        <button class="btn ghost" type="button" @click="exportCsv()">Exportar CSV</button>

        <button class="btn" type="button" @click="openNew()">+ Nova Inspeção</button>
      </div>
    </div>

    <div class="card tablecard">
      <div class="tablewrap">
        <table class="inspect-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Plano</th>
              <th>PN</th>
              <th>Modelo</th>
              <th>Lote</th>
              <th>Turno</th>
              <th>Responsável</th>
              <th>Status</th>
              <th>Resultado</th>
              <th class="actions-col">Ações</th>
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
                    Reinspeção {{ x.inspectionCycle || 2 }}
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
                  {{ x.status === "done" ? "Finalizada" : "Em edição" }}
                </span>
              </td>
              <td>
                <span
                  class="badge"
                  :class="x.result === 'PASS' ? 'ok' : x.result === 'FAIL' ? 'warn' : ''"
                >
                  {{ x.result || "—" }}
                </span>
              </td>
              <td class="actions-col">
                <div class="actions-cell">
                  <button class="btn ghost action-btn" type="button" @click="openEdit(x)">
                    Abrir
                  </button>

                  <button
                    class="btn ghost action-btn"
                    :disabled="x.status !== 'done'"
                    type="button"
                    @click="exportPdf(x)"
                  >
                    PDF
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

<style scoped>
.actions-col {
  width: 220px;
  min-width: 220px;
}

.actions-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.actions-cell .action-btn {
  min-width: 64px;
  height: 36px;
  padding: 0 12px;
}

.table th {
  text-align: center;
  vertical-align: middle;
}

.table td {
  vertical-align: middle;
}

.table td:nth-child(1),
.table td:nth-child(2),
.table td:nth-child(4),
.table td:nth-child(5),
.table td:nth-child(6),
.table td:nth-child(7),
.table td:nth-child(8),
.table td:nth-child(9),
.table td:nth-child(10),
.table td:nth-child(11) {
  text-align: center;
}

.table td:nth-child(3) {
  text-align: left;
}

.inspect-table th {
  text-align: center !important;
  vertical-align: middle !important;
}

.inspect-table td {
  vertical-align: middle !important;
  text-align: center;
}

.inspect-filter-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.inspect-search-row {
  display: flex;
  justify-content: center;
  width: 100%;
}

.inspect-search-row .field {
  width: 100%;
  max-width: 760px;
}

.inspect-filter-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.inspect-filter-row .field {
  min-width: 170px;
}

.inspect-actions-row {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding-top: 5px;
  width: 100%;
}

.inspect-actions-row .btn {
  min-width: 150px;
  white-space: nowrap;
}
.inspection-type-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.inspection-type-text {
  font-weight: 500;
}

.reinspection-table-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  border: 1px solid #f59e0b;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 10px;
  font-weight: 645;
  white-space: nowrap;
}
</style>
