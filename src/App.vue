<script setup>
import { ref, computed, onMounted } from "vue";
import { useUiStore } from "./stores/ui";
import { usePlansStore } from "./stores/plans";
import PlanModal from "./components/PlanModal.vue";
import InspectPage from "./components/InspectPage.vue";
import { useAuthStore } from "./stores/auth";
import LoginPage from "./components/LoginPage.vue";

const ui = useUiStore();
const plans = usePlansStore();
const auth = useAuthStore();

const isAdmin = computed(() => auth.role === "admin");

const showPlan = ref(false);
const editPlanId = ref(null);

const sideHover = ref(false);
const sidePinned = ref(false);

const sideOpen = computed(() => sideHover.value || sidePinned.value);

const isForms = computed(() => ui.page === "forms");
const isInspect = computed(() => ui.page === "inspect");
const isAnalytics = computed(() => ui.page === "analytics");

// ------- paginação -------
const PAGE_SIZE = 10;
const currentPage = ref(1);

const sourcePlans = computed(() => plans.filtered || []);

const totalPages = computed(() => {
  if (!sourcePlans.value.length) return 1;
  return Math.ceil(sourcePlans.value.length / PAGE_SIZE);
});

const paginatedPlans = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  return sourcePlans.value.slice(start, end);
});

onMounted(async () => {
  await plans.load();
  currentPage.value = 1;
});

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

function samplingClass(p) {
  const mode = p?.sampling?.mode || "fixed";

  if (mode === "nbr5426") return "nbr";
  if (mode === "client") return "client";

  return "fixed";
}
</script>

<template>
  <LoginPage v-if="!auth.isLogged" />

  <div v-else class="layout" :class="{ 'layout-side-open': sideOpen }">
    <!-- SIDEBAR -->
    <aside
      class="side"
      :class="{ 'side-hover-open': sideOpen }"
      @mouseenter="sideHover = true"
      @mouseleave="sideHover = false"
    >
      <div class="brand">
        <img src="/logo.png" alt="Inventus Power" />
      </div>

      <nav class="menu">
      
        <div class="mi" :class="{ active: isForms }" @click="ui.setPage('forms')">
          🧾<span class="mi-label">Formulários</span>
        </div>

        <div class="mi" :class="{ active: isInspect }" @click="ui.setPage('inspect')">
          🧪<span class="mi-label">Inspeção</span>
        </div>

        <div class="mi" :class="{ active: isAnalytics }" @click="ui.setPage('analytics')">
          📈<span class="mi-label">Análises</span>
        </div>
      </nav>
    </aside>

    <!-- CONTEÚDO -->
    <div>
      <!-- TOP BAR -->
      <div class="top">
        <div class="wrap top-wrap">
          <div class="search">
            <input v-model="ui.q" placeholder="Buscar por PN, modelo, plano ou cliente" />
          </div>

          <div class="qs-user-box">
            <div class="qs-user-info">
              <span>Logado como</span>
              <b>{{ auth.userName }}</b>
              <span class="qs-role-pill">{{ auth.role }}</span>
            </div>

            <button class="btn ghost" type="button" @click="auth.logout()">Sair</button>
          </div>
        </div>
      </div>

      <!-- MAIN -->
      <main>
        <!-- ================= FORMULÁRIOS ================= -->
        <div v-if="isForms" class="vstack">
          <div class="title">Formulários (Planos de Inspeção)</div>
          <div class="tabline"></div>

          <div class="card tablecard" style="margin-top: 12px">
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
                    <th>Amostragem</th>
                    <th>Responsável</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-if="plans.loading">
                    <td colspan="9">Carregando...</td>
                  </tr>

                  <tr v-else-if="!sourcePlans.length">
                    <td colspan="9">Nenhum plano criado ainda.</td>
                  </tr>

                  <tr v-else v-for="p in paginatedPlans" :key="p.id">
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
                      <span class="sampling-pill" :class="samplingClass(p)">
                        {{ samplingLabel(p) }}
                      </span>
                    </td>

                    <td>{{ p.resp }}</td>

                    <td>
                      <div v-if="isAdmin" class="actions-wrap">
                        <button
                          class="btn ghost"
                          type="button"
                          @click="
                            editPlanId = p.id;
                            showPlan = true;
                          "
                        >
                          Editar
                        </button>

                        <button
                          class="btn ghost danger"
                          type="button"
                          @click="plans.remove(p.id)"
                        >
                          Excluir
                        </button>
                      </div>

                      <span v-else class="muted-text">Somente leitura</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- PAGINAÇÃO -->
            <div
              class="hstack"
              style="justify-content: space-between; padding: 8px 12px; font-size: 13px"
              v-if="sourcePlans.length"
            >
              <div>
                Mostrando {{ paginatedPlans.length }} de {{ sourcePlans.length }} planos
              </div>

              <div class="hstack" style="gap: 8px">
                <button
                  class="btn ghost"
                  type="button"
                  :disabled="currentPage === 1"
                  @click="currentPage--"
                >
                  Anterior
                </button>

                <span>Página {{ currentPage }} / {{ totalPages }}</span>

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

          <div class="card">
            <button
              v-if="isAdmin"
              class="btn"
              type="button"
              @click="
                editPlanId = null;
                showPlan = true;
              "
            >
              + Novo Plano
            </button>
          </div>
        </div>

        <!-- ================= INSPEÇÃO ================= -->
        <div v-else-if="isInspect">
          <InspectPage />
        </div>

        <!-- ================= ANÁLISES ================= -->
        <div v-else class="vstack">
          <div class="title">Análises</div>
          <div class="tabline"></div>
          <div class="card">Em construção…</div>
        </div>
      </main>
    </div>
  </div>

  <PlanModal
    :show="showPlan"
    :id="editPlanId"
    @close="
      showPlan = false;
      editPlanId = null;
    "
  />
</template>

<style scoped>
.qs-user-box {
  display: flex;
  align-items: center;
  gap: 14px;
  white-space: nowrap;
  font-size: 13px;
  color: var(--muted, #64748b);
}

.qs-user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qs-user-info b {
  color: var(--text, #111827);
  font-weight: 800;
}

.qs-role-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  text-transform: uppercase;
}

.layout {
  transition: grid-template-columns 0.22s ease;
}

.layout-side-open {
  grid-template-columns: 290px 1fr !important;
}

.side {
  width: 100%;
  transition: width 0.22s ease;
}

.side-hover-open {
  width: 290px !important;
}

.side-hover-open .mi {
  justify-content: flex-start !important;
  gap: 12px !important;
  padding-left: 18px !important;
}

.side-hover-open .mi-label {
  display: inline-flex !important;
  opacity: 1 !important;
  visibility: visible !important;
  width: auto !important;
  max-width: 180px !important;
  overflow: visible !important;
  margin-left: 8px !important;
  white-space: nowrap !important;
}
</style>
