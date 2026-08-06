<script setup>
import { computed, onMounted, ref } from "vue";
import { useInspectionsStore } from "../stores/inspections";

const inspections = useInspectionsStore();
const period = ref("90");
const area = ref("ALL");
const result = ref("ALL");

onMounted(async () => {
  if (!inspections.items.length) await inspections.load();
});

const finished = computed(() => (inspections.items || []).filter((item) => {
  if (String(item.status || "").toLowerCase() !== "done") return false;
  if (area.value !== "ALL" && String(item.type || "").toUpperCase() !== area.value) return false;
  if (result.value !== "ALL" && String(item.result || "").toUpperCase() !== result.value) return false;
  if (period.value === "ALL") return true;
  const date = new Date(item.finishedAt || item.updatedAt || item.createdAt || 0);
  const limit = new Date();
  limit.setDate(limit.getDate() - Number(period.value));
  return !Number.isNaN(date.getTime()) && date >= limit;
}));

const approved = computed(() => finished.value.filter((item) => String(item.result).toUpperCase() === "PASS").length);
const rejected = computed(() => finished.value.filter((item) => String(item.result).toUpperCase() === "FAIL").length);
const approvalRate = computed(() => finished.value.length ? Math.round((approved.value / finished.value.length) * 1000) / 10 : 0);
const openCount = computed(() => (inspections.items || []).filter((item) => String(item.status || "").toLowerCase() !== "done").length);

const byArea = computed(() => ["IQC", "OQC"].map((name) => {
  const rows = finished.value.filter((item) => String(item.type || "").toUpperCase() === name);
  const pass = rows.filter((item) => String(item.result).toUpperCase() === "PASS").length;
  return { name, total: rows.length, pass, fail: rows.length - pass, rate: rows.length ? Math.round((pass / rows.length) * 100) : 0 };
}));

const trend = computed(() => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const rows = finished.value.filter((item) => {
      const d = new Date(item.finishedAt || item.updatedAt || item.createdAt || 0);
      return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
    });
    const pass = rows.filter((item) => String(item.result).toUpperCase() === "PASS").length;
    return { label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), total: rows.length, rate: rows.length ? Math.round((pass / rows.length) * 100) : 0 };
  });
});
const maxMonthlyTotal = computed(() => Math.max(1, ...trend.value.map((item) => item.total)));

const failureRanking = computed(() => {
  const counts = new Map();
  finished.value.filter((item) => String(item.result).toUpperCase() === "FAIL").forEach((item) => {
    (item.chars || []).forEach((char) => {
      const values = item.samples?.[char.id] || [];
      const lsl = Number(char.lsl);
      const usl = Number(char.usl);
      const failed = values.some((value) => String(value).trim().toUpperCase() === "NG") ||
        (Number.isFinite(lsl) && Number.isFinite(usl) && values.some((value) => {
          const n = Number(String(value).replace(",", "."));
          return Number.isFinite(n) && (n < lsl || n > usl);
        }));
      if (failed) {
        const name = char.name || char.description || "Característica não identificada";
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    });
  });
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
});

const originRanking = computed(() => {
  const groups = new Map();
  finished.value.forEach((item) => {
    const name = item.supplier || item.client || "Não informado";
    const row = groups.get(name) || { name, total: 0, fail: 0 };
    row.total += 1;
    if (String(item.result).toUpperCase() === "FAIL") row.fail += 1;
    groups.set(name, row);
  });
  return [...groups.values()].map((row) => ({ ...row, rate: Math.round(((row.total - row.fail) / row.total) * 100) })).sort((a, b) => b.fail - a.fail).slice(0, 5);
});
</script>

<template>
  <section class="analytics-page vstack">
    <div class="analytics-heading">
      <div><div class="title">Análises da Qualidade</div><p>Visão consolidada do desempenho das inspeções IQC e OQC.</p></div>
      <div class="analytics-filters">
        <label>Período<select v-model="period"><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="180">Últimos 6 meses</option><option value="ALL">Todo o período</option></select></label>
        <label>Área<select v-model="area"><option value="ALL">IQC + OQC</option><option value="IQC">IQC</option><option value="OQC">OQC</option></select></label>
        <label>Resultado<select v-model="result"><option value="ALL">Todos</option><option value="PASS">Aprovados</option><option value="FAIL">Reprovados</option></select></label>
      </div>
    </div>
    <div class="tabline"></div>
    <div v-if="inspections.loading" class="card analytics-empty">Carregando indicadores...</div>
    <template v-else>
      <div class="analytics-kpis">
        <article class="analytics-kpi"><span>Inspeções finalizadas</span><strong>{{ finished.length }}</strong><small>No período selecionado</small></article>
        <article class="analytics-kpi kpi-ok"><span>Aprovadas</span><strong>{{ approved }}</strong><small>{{ approvalRate }}% de aprovação</small></article>
        <article class="analytics-kpi kpi-bad"><span>Reprovadas</span><strong>{{ rejected }}</strong><small>{{ finished.length ? Math.round((rejected / finished.length) * 1000) / 10 : 0 }}% do total</small></article>
        <article class="analytics-kpi kpi-warn"><span>Em andamento</span><strong>{{ openCount }}</strong><small>Aguardando finalização</small></article>
      </div>
      <div class="analytics-grid-main">
        <article class="card analytics-card">
          <header><div><h3>Índice de aprovação</h3><p>Resultado consolidado das inspeções</p></div><span class="analytics-status" :class="approvalRate >= 95 ? 'good' : approvalRate >= 85 ? 'attention' : 'critical'">{{ approvalRate >= 95 ? 'Dentro da meta' : approvalRate >= 85 ? 'Atenção' : 'Crítico' }}</span></header>
          <div class="approval-overview"><div class="approval-ring" :style="{ '--rate': `${approvalRate * 3.6}deg` }"><div><strong>{{ approvalRate }}%</strong><span>Aprovação</span></div></div><div class="approval-legend"><div><i class="dot ok"></i><span>Aprovadas</span><b>{{ approved }}</b></div><div><i class="dot bad"></i><span>Reprovadas</span><b>{{ rejected }}</b></div><div><i class="dot neutral"></i><span>Total</span><b>{{ finished.length }}</b></div></div></div>
        </article>
        <article class="card analytics-card">
          <header><div><h3>Desempenho por área</h3><p>Comparativo IQC e OQC</p></div></header>
          <div class="area-comparison"><div v-for="item in byArea" :key="item.name" class="area-row"><div class="area-row-head"><b>{{ item.name }}</b><span>{{ item.total }} inspeções · {{ item.rate }}%</span></div><div class="progress"><i :style="{ width: `${item.rate}%` }"></i></div><small>{{ item.pass }} aprovadas · {{ item.fail }} reprovadas</small></div></div>
        </article>
      </div>
      <article class="card analytics-card analytics-trend">
        <header><div><h3>Evolução das inspeções</h3><p>Volume finalizado e taxa de aprovação nos últimos seis meses</p></div></header>
        <div class="trend-chart"><div v-for="item in trend" :key="item.label" class="trend-column"><span>{{ item.rate }}%</span><div class="trend-track"><i :style="{ height: `${Math.max(4, (item.total / maxMonthlyTotal) * 100)}%` }"></i></div><b>{{ item.label }}</b><small>{{ item.total }}</small></div></div>
      </article>
      <div class="analytics-grid-lists">
        <article class="card analytics-card"><header><div><h3>Principais não conformidades</h3><p>Características com maior recorrência</p></div></header><div v-if="!failureRanking.length" class="analytics-empty">Nenhuma não conformidade identificada.</div><ol v-else class="ranking-list"><li v-for="(item, index) in failureRanking" :key="item.name"><span class="rank">{{ index + 1 }}</span><b>{{ item.name }}</b><span>{{ item.count }} ocorrência(s)</span></li></ol></article>
        <article class="card analytics-card"><header><div><h3>Desempenho por origem</h3><p>Fornecedores ou clientes com reprovações</p></div></header><div v-if="!originRanking.length" class="analytics-empty">Nenhuma inspeção no período.</div><div v-else class="supplier-list"><div v-for="item in originRanking" :key="item.name"><div><b>{{ item.name }}</b><span>{{ item.fail }} reprovação(ões) em {{ item.total }}</span></div><strong :class="item.rate >= 95 ? 'text-ok' : 'text-bad'">{{ item.rate }}%</strong></div></div></article>
      </div>
    </template>
  </section>
</template>
