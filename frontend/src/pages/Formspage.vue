<template>
  <div class="vstack">
    <div class="title">Formulários (Planos de Inspeção)</div>
    <div class="tabline"></div>

    <!-- FILTROS -->
    <div class="filterbar">
      <div class="hstack gap-8 wrap">
        <div class="field">
          <input placeholder="Modelo" v-model="plans.filterModel" />
        </div>
        <div class="field">
          <input placeholder="Cliente" v-model="plans.filterClient" />
        </div>
        <div class="field grow">
          <input placeholder="PN / texto..." v-model="plans.filterText" />
        </div>

        <div class="field">
          <button class="btn" @click="seed">+ Criar Plano Teste</button>
        </div>
      </div>
    </div>

    <!-- TABELA -->
    <div class="card tablecard">
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Tipo</th>
              <th>PN</th>
              <th>Modelo</th>
              <th>Plano</th>
              <th>Cliente</th>
              <th>Revisão Vigente</th>
              <th>Amostragem</th>
              <th style="width: 220px">Ações</th>
            </tr>
          </thead>
          <tbody>
            <!-- 🔹 AGORA USA SOMENTE OS PLANOS DA PÁGINA ATUAL -->
            <tr v-for="p in paginatedPlans" :key="p.id">
              <td>
                <span class="status-pill" :class="p.active ? 'on' : 'off'">
                  {{ p.active ? "Ativo" : "Suspenso" }}
                </span>
              </td>
              <td>{{ p.type }}</td>
              <td>{{ p.pn }}</td>
              <td>{{ p.model }}</td>
              <td>{{ p.name }}</td>
              <td>{{ p.client }}</td>
              <td>
                <span class="plan-revision-table-badge">
                  Rev.
                  {{
                    Number(p.revisionNumber || p.revision_number || 1)
                      .toString()
                      .padStart(2, "0")
                  }}
                </span>
              </td>
              <td>{{ samplingLabel(p) }}</td>
              <td>
                <button class="btn ghost" @click="plans.toggle(p.id)">
                  {{ p.active ? "Suspender" : "Ativar" }}
                </button>
                <button class="btn ghost danger" @click="plans.remove(p.id)">
                  Excluir
                </button>
              </td>
            </tr>

            <!-- mensagem quando nenhum plano for encontrado -->
            <tr v-if="!paginatedPlans.length">
              <td colspan="9">Nenhum plano cadastrado.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- PAGINAÇÃO -->
      <div class="pager">
        <button class="btn ghost" :disabled="page === 1" @click="prevPage">
          ◀ Anterior
        </button>

        <span>Página {{ page }} de {{ totalPages }}</span>

        <button class="btn ghost" :disabled="page === totalPages" @click="nextPage">
          Próxima ▶
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed, ref, watch } from "vue";
import { usePlansStore } from "../stores/plansStore";

const plans = usePlansStore();

// carrega planos do IndexedDB
onMounted(() => {
  plans.load();
});

// ===== PAGINAÇÃO =====
const page = ref(1);
const pageSize = 10;

// total de páginas com base nos planos filtrados
const totalPages = computed(() => {
  const total = plans.filtered?.length || 0;
  return total > 0 ? Math.ceil(total / pageSize) : 1;
});

// planos que aparecem na tabela (apenas a página atual)
const paginatedPlans = computed(() => {
  const list = plans.filtered || [];
  const start = (page.value - 1) * pageSize;
  return list.slice(start, start + pageSize);
});

// navegação
function nextPage() {
  if (page.value < totalPages.value) page.value++;
}

function prevPage() {
  if (page.value > 1) page.value--;
}

// sempre que filtros mudarem, volta pra página 1
watch(
  () => [plans.filterModel, plans.filterClient, plans.filterText],
  () => {
    page.value = 1;
  }
);

function samplingLabel(p) {
  const s = p?.sampling || {};

  if (s.mode === "nbr5426") {
    const level = s.level || "-";
    const aql = String(s.aql ?? "-").replace(".", ",");
    return `NBR 5426: ${level} / AQL ${aql}`;
  }

  if (s.mode === "client") {
    return `Cliente: ${s.clientName || "-"}`;
  }

  return `Fixo: n=${p.n ?? "-"}`;
}

// botão de teste para criar plano rápido
async function seed() {
  await plans.save({
    name: "Plano 15W VE",
    model: "15W VE",
    client: "Samsung",
    pn: "EAY65888903",
    resp: "Iuran",
    type: "OQC",
    n: 5,
    active: true,
    chars: [
      {
        id: crypto.randomUUID(),
        name: "Comprimento",
        category: "Dimensional",
        lsl: 10,
        usl: 12,
        unit: "mm",
        method: "Paquímetro",
      },
    ],
  });
}
</script>

<style scoped>
.pager {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  font-size: 13px;
  color: var(--muted, #666);
}

.plan-revision-table-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 9px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 750;
  white-space: nowrap;
}
</style>
