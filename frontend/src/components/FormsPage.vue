<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useAuthStore } from "../stores/auth";
import { usePlansStore } from "../stores/plans";
import { useSwitchingStore } from "../stores/switching";
import { useUiStore } from "../stores/ui";
import PlanModal from "./PlanModal.vue";
import SwitchingModals from "./SwitchingModals.vue";
import { requestConfirmation } from "../services/systemFeedback";

const auth = useAuthStore();
const plans = usePlansStore();
const switching = useSwitchingStore();
const ui = useUiStore();
const showPlan = ref(false);
const editPlanId = ref(null);
const switchingModals = ref(null);
const currentPage = ref(1);
const pageSize = 15;
const canEditSystem = computed(() => auth.canEditSystem);

const sourcePlans = computed(() => {
  const query = String(ui.q || "").trim().toLowerCase();
  if (!query) return plans.items || [];
  return (plans.items || []).filter((plan) => `${plan.type || ""} ${plan.pn || ""} ${plan.model || ""} ${plan.name || ""} ${plan.client || ""} ${plan.supplier || ""} ${plan.resp || ""} ${plan.sampling?.mode || ""} ${plan.sampling?.standard || ""} ${plan.sampling?.clientName || ""}`.toLowerCase().includes(query));
});
const totalPages = computed(() => Math.max(1, Math.ceil(sourcePlans.value.length / pageSize)));
const paginatedPlans = computed(() => sourcePlans.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize));

onMounted(() => plans.load());
watch(() => ui.q, () => { currentPage.value = 1; });

function samplingLabel(plan) {
  const sampling = plan?.sampling || {};
  if (sampling.mode === "nbr5426") return `NBR 5426: ${sampling.level || "-"} / AQL ${String(sampling.aql ?? "-").replace(".", ",")}`;
  if (sampling.mode === "client") return `Cliente: ${sampling.clientName || "-"}`;
  return `Fixo: n=${plan.n ?? "-"}`;
}
function samplingClass(plan) {
  const mode = plan?.sampling?.mode || "fixed";
  return mode === "nbr5426" ? "nbr" : mode === "client" ? "client" : "fixed";
}
function regimeLabel(value) {
  const regime = String(value || "normal").toLowerCase();
  return regime === "atenuada" ? "Atenuada" : regime === "severa" ? "Severa" : "Normal";
}
function switchingStatusLabel(value) {
  const status = String(value || "sem_pendencia").toLowerCase();
  if (status === "pendente") return "Pendente de aprovação";
  if (status === "aprovado") return "Aprovado";
  if (status === "recusado") return "Recusado";
  return "Sem pendência";
}
function closeOperationMenus() {
  document.querySelectorAll(".operations-menu[open]").forEach((menu) => menu.removeAttribute("open"));
}
function analyzePlanSwitching(plan) {
  closeOperationMenus();
  switchingModals.value?.analyze(plan);
}
function openApproveSwitching(plan) {
  closeOperationMenus();
  switchingModals.value?.openApproval(plan);
}
async function confirmRemovePlan(plan) {
  if (!plan?.id) return;
  closeOperationMenus();
  const confirmed = await requestConfirmation("Deseja realmente remover este Plano de Inspeção?\n\n" + `Plano: ${plan.name || "-"}\nPN: ${plan.pn || "-"}\nModelo: ${plan.model || "-"}\nCliente: ${plan.client || "-"}\n\nEsta ação não poderá ser desfeita.`, { title: "Remover plano", confirmLabel: "Remover", danger: true });
  if (!confirmed) return;
  try {
    await plans.remove(plan.id);
    await plans.load();
    alert("Plano de Inspeção removido com sucesso.");
  } catch (error) {
    alert(error?.message || "Não foi possível remover o Plano de Inspeção.");
  }
}
</script>

<template>
<section class="vstack">
  <div class="title">Planos de Inspeção</div>
  <div class="tabline"></div>

  <div class="card tablecard" style="margin-top: 12px">
    <div class="tablewrap">
      <table class="plans-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Tipo</th>
            <th>PN</th>
            <th>Modelo</th>
            <th>Plano</th>
            <th>Cliente</th>
            <th>Revisão Vigente</th>
            <th>Critério de Amostragem</th>
            <th>Regime</th>
            <th>Status de Comutação</th>
            <th>Responsável Técnico</th>
            <th>Operações</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="plans.loading">
            <td colspan="12">Carregando...</td>
          </tr>

          <tr v-else-if="!sourcePlans.length">
            <td colspan="12">Nenhum plano criado ainda.</td>
          </tr>

          <tr v-else v-for="(p, idx) in paginatedPlans" :key="p.id">
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

            <td>
              <span class="sampling-pill" :class="samplingClass(p)">
                {{ samplingLabel(p) }}
              </span>
            </td>

            <td>
              <span
                class="regime-pill"
                :class="`regime-${p.inspectionRegime || 'normal'}`"
              >
                {{ regimeLabel(p.inspectionRegime) }}
              </span>
            </td>

            <td>
              <span
                class="switching-pill"
                :class="p.switchingStatus === 'pendente' ? 'pending' : 'ok'"
              >
                {{ switchingStatusLabel(p.switchingStatus) }}
              </span>
            </td>
            <td>{{ p.resp }}</td>

            <td>
              <div v-if="canEditSystem" class="operations-cell">
                <button
                  class="table-primary-action"
                  type="button"
                  @click="
                    editPlanId = p.id;
                    showPlan = true;
                  "
                >
                  Editar
                </button>

                <details
                  class="operations-menu"
                  :class="
                    idx === paginatedPlans.length - 1
                      ? 'operations-menu-up'
                      : 'operations-menu-down'
                  "
                >
                  <summary title="Mais ações" aria-label="Mais ações">•••</summary>

                  <div class="operations-list">
                    <button
                      type="button"
                      :disabled="switching.loading"
                      @click="analyzePlanSwitching(p)"
                    >
                      Analisar comutação
                    </button>

                    <button
                      v-if="canEditSystem && p.switchingStatus === 'pendente'"
                      type="button"
                      class="operation-primary"
                      :disabled="switching.loading"
                      @click="openApproveSwitching(p)"
                    >
                      Aprovar comutação
                    </button>

                    <button
                      type="button"
                      class="operation-danger"
                      @click="confirmRemovePlan(p)"
                    >
                      Remover plano
                    </button>
                  </div>
                </details>
              </div>

              <span v-else class="muted-text">Visualização</span>
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

  <div class="plans-mobile-list" aria-label="Planos de inspeção">
    <div v-if="plans.loading" class="card plans-mobile-empty">Carregando planos...</div>
    <div v-else-if="!sourcePlans.length" class="card plans-mobile-empty">Nenhum plano criado ainda.</div>
    <article v-for="p in paginatedPlans" v-else :key="`mobile-${p.id}`" class="card plan-mobile-card">
      <header>
        <div><span class="plan-mobile-type">{{ p.type }}</span><span v-if="p.process" class="plan-mobile-process">{{ p.process }}</span></div>
        <span class="status-pill" :class="p.active ? 'on' : 'off'">{{ p.active ? "Ativo" : "Suspenso" }}</span>
      </header>
      <div class="plan-mobile-title"><strong>{{ p.name || "Plano não informado" }}</strong><span>{{ p.pn || "PN não informado" }} · {{ p.model || "Modelo não informado" }}</span></div>
      <dl class="plan-mobile-details">
        <div><dt>Cliente</dt><dd>{{ p.client || "—" }}</dd></div>
        <div><dt>Responsável</dt><dd>{{ p.resp || "—" }}</dd></div>
        <div><dt>Revisão</dt><dd>Rev. {{ Number(p.revisionNumber || p.revision_number || 1).toString().padStart(2, "0") }}</dd></div>
        <div><dt>Regime</dt><dd>{{ regimeLabel(p.inspectionRegime) }}</dd></div>
      </dl>
      <div class="plan-mobile-sampling"><span>Critério de amostragem</span><b>{{ samplingLabel(p) }}</b></div>
      <footer v-if="canEditSystem">
        <button class="table-primary-action" type="button" @click="editPlanId = p.id; showPlan = true">Editar plano</button>
        <button class="btn ghost" type="button" :disabled="switching.loading" @click="analyzePlanSwitching(p)">Comutação</button>
      </footer>
    </article>
    <div v-if="sourcePlans.length" class="plans-mobile-pagination">
      <button class="btn ghost" type="button" :disabled="currentPage === 1" @click="currentPage--">Anterior</button>
      <span>{{ currentPage }} / {{ totalPages }}</span>
      <button class="btn ghost" type="button" :disabled="currentPage === totalPages" @click="currentPage++">Próxima</button>
    </div>
  </div>

  <div class="card">
    <button
      v-if="canEditSystem"
      class="btn"
      type="button"
      @click="
        editPlanId = null;
        showPlan = true;
      "
    >
      + Novo Plano de Inspeção
    </button>
  </div>
</section>
  <PlanModal :show="showPlan" :id="editPlanId" @close="showPlan = false; editPlanId = null" />
  <SwitchingModals ref="switchingModals" />
</template>
