<script setup>
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { usePlansStore } from "../stores/plans";
import { useSwitchingStore } from "../stores/switching";
import { requestConfirmation } from "../services/systemFeedback";

const auth = useAuthStore();
const plans = usePlansStore();
const switching = useSwitchingStore();
const analysis = ref(null);
const plan = ref(null);
const showApproval = ref(false);
const showAnalysis = ref(false);
const password = ref("");
const loading = ref(false);

function regimeLabel(value) {
  const regime = String(value || "normal").toLowerCase();
  if (regime === "atenuada") return "Atenuada";
  if (regime === "severa") return "Severa";
  return "Normal";
}

function resultLabel(value) {
  const result = String(value || "").toUpperCase();
  return ["PASS", "FAIL"].includes(result) ? result : result || "—";
}

function formatDateTimeBR(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function validLots() {
  const history = analysis.value?.history || [];
  const currentRegime = String(analysis.value?.currentRegime || "normal").trim().toLowerCase();
  const valid = [];
  for (const item of history) {
    if (String(item.inspectionRegimeSnapshot || "").trim().toLowerCase() !== currentRegime) break;
    valid.push(item);
  }
  return valid;
}

function switchingTarget() {
  const regime = String(analysis.value?.currentRegime || "normal").toLowerCase();
  return regime === "normal" ? 10 : regime === "severa" ? 5 : 1;
}

async function analyze(sourcePlan) {
  if (!sourcePlan?.id) return;
  loading.value = true;
  try {
    const data = await switching.analyzePlan(sourcePlan.id);
    const payload = data?.analysis || {};
    const source = data?.plan || sourcePlan;
    plan.value = {
      ...source,
      id: source.id || sourcePlan.id,
      name: source.name || sourcePlan.name || sourcePlan.planName || "-",
      pn: source.pn || sourcePlan.pn || "-",
      model: source.model || sourcePlan.model || "-",
      client: source.client || sourcePlan.client || "-",
      inspectionRegime: source.inspectionRegime || source.inspection_regime || sourcePlan.inspectionRegime || payload.currentRegime || "normal",
      suggestedRegime: source.suggestedRegime || source.suggested_regime || sourcePlan.suggestedRegime || payload.suggestedRegime || null,
      switchingReason: source.switchingReason || source.switching_reason || sourcePlan.switchingReason || payload.reason || "-",
    };
    analysis.value = {
      ...payload,
      currentRegime: payload.currentRegime || payload.current_regime || plan.value.inspectionRegime || "normal",
      suggestedRegime: payload.suggestedRegime || payload.suggested_regime || plan.value.suggestedRegime || null,
      reason: payload.reason || payload.switchingReason || payload.switching_reason || plan.value.switchingReason || "Histórico ainda não atende critério para comutação.",
      history: payload.history || payload.records || payload.lots || [],
    };
    showAnalysis.value = true;
  } catch (error) {
    alert(error?.message || "Não foi possível analisar a comutação.");
  } finally {
    loading.value = false;
  }
}

function openApproval(sourcePlan) {
  if (!sourcePlan?.id) return;
  plan.value = {
    ...sourcePlan,
    name: sourcePlan.name || sourcePlan.planName || "-",
    inspectionRegime: sourcePlan.inspectionRegime || sourcePlan.inspection_regime || sourcePlan.currentRegime || "normal",
    suggestedRegime: sourcePlan.suggestedRegime || sourcePlan.suggested_regime || null,
    switchingReason: sourcePlan.switchingReason || sourcePlan.switching_reason || sourcePlan.reason || "-",
  };
  password.value = "";
  showApproval.value = true;
}

async function approve() {
  if (!plan.value?.id) return;
  if (!String(password.value).trim()) return alert("Informe a senha de comutação.");
  loading.value = true;
  try {
    await switching.approvePlan(plan.value.id, password.value, {
      id: auth.user?.id, name: auth.user?.name, username: auth.user?.username,
      role: auth.user?.role, accessLevel: auth.accessLevel,
    });
    showApproval.value = false;
    password.value = "";
    await plans.load();
    await switching.loadHistory();
    alert("Comutação aprovada com sucesso.");
  } catch (error) {
    alert(error?.message || "Não foi possível aprovar a comutação.");
  } finally {
    loading.value = false;
  }
}

async function registerSuggestion() {
  if (!plan.value?.id || !analysis.value?.hasSuggestion) return;
  if (!(await requestConfirmation("Deseja registrar esta sugestão como pendente?", { title: "Sugestão de comutação", confirmLabel: "Registrar" }))) return;
  loading.value = true;
  try {
    await switching.suggestPlan(plan.value.id);
    showAnalysis.value = false;
    await plans.load();
    await switching.loadHistory();
    alert("Sugestão de comutação registrada como pendente.");
  } catch (error) {
    alert(error?.message || "Não foi possível registrar a sugestão de comutação.");
  } finally {
    loading.value = false;
  }
}

defineExpose({ analyze, openApproval });
</script>

<template>
  <Teleport to="body">
  <div class="modal" :class="{ show: showApproval }" @click.self="showApproval = false">
    <div class="sheet vstack switching-approval-modal">
      <div class="hstack" style="justify-content:space-between;align-items:center"><h3>Aprovar comutação</h3><button class="btn ghost" type="button" @click="showApproval = false">Fechar</button></div>
      <div class="hr"></div>
      <div class="switching-approval-body">
        <p>Confirme a alteração do regime de inspeção usando a senha de comutação.</p>
        <div class="switching-approval-summary">
          <div class="switching-summary-row"><span>Plano</span><b>{{ plan?.name || "-" }}</b></div>
          <div class="switching-summary-row"><span>Regime atual</span><b>{{ regimeLabel(plan?.inspectionRegime) }}</b></div>
          <div class="switching-summary-row"><span>Regime sugerido</span><b>{{ regimeLabel(plan?.suggestedRegime) }}</b></div>
          <div class="switching-summary-row switching-summary-row-full"><span>Motivo</span><b>{{ plan?.switchingReason || "-" }}</b></div>
        </div>
        <label class="float-label switching-password-field"><input v-model="password" type="password" placeholder=" " @keyup.enter="approve" /><span>Senha de comutação</span></label>
      </div>
      <div class="hr"></div>
      <div class="hstack" style="justify-content:flex-end;gap:8px"><button class="btn ghost" type="button" @click="showApproval = false">Cancelar</button><button class="btn" type="button" :disabled="loading" @click="approve">Confirmar comutação</button></div>
    </div>
  </div>

  <div class="modal" :class="{ show: showAnalysis }" @click.self="showAnalysis = false">
    <div class="sheet vstack switching-analysis-modal">
      <div class="hstack" style="justify-content:space-between;align-items:center"><div><h3>Análise de Comutação</h3><p class="muted-text" style="margin:4px 0 0">Verificação do histórico de lotes para sugestão de regime de inspeção.</p></div><button class="btn ghost" type="button" @click="showAnalysis = false">Fechar</button></div>
      <div class="hr"></div>
      <div class="switching-analysis-summary">
        <div class="switching-summary-row"><span>Plano</span><b>{{ plan?.name || "-" }}</b></div><div class="switching-summary-row"><span>PN</span><b>{{ plan?.pn || "-" }}</b></div><div class="switching-summary-row"><span>Modelo</span><b>{{ plan?.model || "-" }}</b></div><div class="switching-summary-row"><span>Cliente</span><b>{{ plan?.client || "-" }}</b></div><div class="switching-summary-row"><span>Regime atual</span><b>{{ regimeLabel(analysis?.currentRegime) }}</b></div><div class="switching-summary-row"><span>Regime sugerido</span><b>{{ regimeLabel(analysis?.suggestedRegime) }}</b></div>
      </div>
      <div class="switching-suggestion-box"><strong>{{ analysis?.suggestedRegime && analysis?.suggestedRegime !== analysis?.currentRegime ? "Sugestão encontrada" : "Sem critério de comutação" }}</strong><p>{{ analysis?.reason || analysis?.switchingReason || "Histórico ainda não atende critério para comutação." }}</p></div>
      <div class="switching-history-preview">
        <div class="switching-valid-lots"><div><span>Regime em análise</span><b>{{ regimeLabel(analysis?.currentRegime) }}</b></div><div><span>Lotes consecutivos válidos</span><b>{{ validLots().length }} de {{ switchingTarget() }}</b></div></div>
        <div class="hstack" style="justify-content:space-between;align-items:center"><h4 style="margin:0">Últimos registros do histórico</h4><span class="muted-text">{{ analysis?.history?.length || 0 }} registro(s)</span></div>
        <div class="tablewrap"><table><thead><tr><th>Lote</th><th>NF</th><th>Resultado</th><th>Regime executado</th><th>Finalizado em</th></tr></thead><tbody><tr v-if="!analysis?.history?.length"><td colspan="5">Nenhum histórico encontrado para este plano.</td></tr><tr v-else v-for="item in analysis.history" :key="item.id"><td>{{ item.lot || "—" }}</td><td>{{ item.invoice || "—" }}</td><td><span class="result-pill" :class="String(item.result).toUpperCase() === 'PASS' ? 'pass' : String(item.result).toUpperCase() === 'FAIL' ? 'fail' : 'neutral'">{{ resultLabel(item.result) }}</span></td><td><span class="regime-pill" :class="`regime-${item.inspectionRegimeSnapshot || 'normal'}`">{{ regimeLabel(item.inspectionRegimeSnapshot) }}</span></td><td>{{ formatDateTimeBR(item.finishedAt) }}</td></tr></tbody></table></div>
      </div>
      <div class="hr"></div>
      <div class="hstack" style="justify-content:flex-end;gap:8px"><button class="btn ghost" type="button" @click="showAnalysis = false">Cancelar</button><button v-if="analysis?.hasSuggestion" class="btn" type="button" :disabled="loading" @click="registerSuggestion">Registrar sugestão</button><button v-else class="btn ghost" type="button" disabled>Sem sugestão disponível</button></div>
    </div>
  </div>
  </Teleport>
</template>
