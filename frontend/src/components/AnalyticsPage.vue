<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useInspectionsStore } from "../stores/inspections";
import { usePlansStore } from "../stores/plans";

const inspections = useInspectionsStore();
const plans = usePlansStore();
const period = ref("90");
const area = ref("ALL");
const result = ref("ALL");
const process = ref("ALL");
const variableSelection = ref("");
const variableMetric = ref("cpk");
const variationProcess = ref("ALL");
const variationPeriod = ref("MONTHLY");
const variationFrom = ref("");
const variationTo = ref("");

onMounted(async () => {
  if (!inspections.items.length) await inspections.load();
  if (!plans.items.length) await plans.load();
});

function inspectionProcess(item) {
  if (item.process) return String(item.process).toUpperCase();
  const plan = plans.items.find((entry) => String(entry.id) === String(item.planId));
  return String(plan?.process || "NÃO INFORMADO").toUpperCase();
}

const finished = computed(() => (inspections.items || []).filter((item) => {
  if (String(item.status || "").toLowerCase() !== "done") return false;
  if (area.value !== "ALL" && String(item.type || "").toUpperCase() !== area.value) return false;
  if (result.value !== "ALL" && String(item.result || "").toUpperCase() !== result.value) return false;
  if (process.value !== "ALL" && inspectionProcess(item) !== process.value) return false;
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

const byProcess = computed(() => {
  const groups = new Map();
  finished.value.forEach((item) => {
    const name = inspectionProcess(item);
    const row = groups.get(name) || { name, total: 0, pass: 0 };
    row.total += 1;
    if (String(item.result).toUpperCase() === "PASS") row.pass += 1;
    groups.set(name, row);
  });
  return [...groups.values()]
    .map((row) => ({ ...row, rate: row.total ? Math.round((row.pass / row.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);
});

function numericSamples(item, char) {
  return (item.samples?.[char.id] || [])
    .map((value) => Number(String(value).replace(",", ".")))
    .filter(Number.isFinite);
}

function isVariableChar(char) {
  const kind = String(char?.kind || "").toLowerCase();
  return kind === "variavel" || (kind === "teste_especial" && char?.resultMode === "numerico");
}

const variationSource = computed(() => {
  const now = new Date();
  const limit = new Date(now);
  if (variationPeriod.value === "WEEKLY") limit.setDate(limit.getDate() - 7 * 12);
  if (variationPeriod.value === "MONTHLY") limit.setMonth(limit.getMonth() - 11, 1);

  return (inspections.items || []).filter((item) => {
    if (String(item.status || "").toLowerCase() !== "done") return false;
    if (area.value !== "ALL" && String(item.type || "").toUpperCase() !== area.value) return false;
    if (result.value !== "ALL" && String(item.result || "").toUpperCase() !== result.value) return false;
    if (variationProcess.value !== "ALL" && inspectionProcess(item) !== variationProcess.value) return false;
    const date = new Date(item.finishedAt || item.updatedAt || item.createdAt || 0);
    if (Number.isNaN(date.getTime())) return false;
    if (variationPeriod.value === "CUSTOM") {
      const iso = date.toISOString().slice(0, 10);
      if (variationFrom.value && iso < variationFrom.value) return false;
      if (variationTo.value && iso > variationTo.value) return false;
      return true;
    }
    return date >= limit;
  });
});

const variableOptions = computed(() => {
  const options = new Map();
  variationSource.value.forEach((item) => {
    (item.chars || []).filter(isVariableChar).forEach((char) => {
      if (!numericSamples(item, char).length) return;
      const planKey = item.planId || item.plan_id || item.planName || "plano";
      const key = `${planKey}::${char.id || char.name}`;
      if (!options.has(key)) {
        options.set(key, {
          key,
          planKey: String(planKey),
          charKey: String(char.id || char.name),
          label: `${item.planName || "Plano"} — ${char.name || "Característica"}`,
        });
      }
    });
  });
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
});

watch(variableOptions, (options) => {
  if (!options.some((option) => option.key === variableSelection.value)) {
    variableSelection.value = options[0]?.key || "";
  }
}, { immediate: true });

const variableTrend = computed(() => {
  if (!variableSelection.value) return [];
  const [planKey, charKey] = variableSelection.value.split("::");
  const rows = variationSource.value
    .map((item) => {
      const itemPlanKey = String(item.planId || item.plan_id || item.planName || "plano");
      if (itemPlanKey !== planKey) return null;
      const char = (item.chars || []).find((entry) => String(entry.id || entry.name) === charKey);
      if (!char) return null;
      const values = numericSamples(item, char);
      if (!values.length) return null;
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.length > 1
        ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
        : 0;
      const deviation = Math.sqrt(variance);
      const lsl = Number(String(char.lsl ?? "").replace(",", "."));
      const usl = Number(String(char.usl ?? "").replace(",", "."));
      const cpk = deviation > 0 && Number.isFinite(lsl) && Number.isFinite(usl)
        ? Math.min((usl - mean) / (3 * deviation), (mean - lsl) / (3 * deviation))
        : null;
      const date = new Date(item.finishedAt || item.updatedAt || item.createdAt || 0);
      return {
        id: item.id,
        date,
        label: Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR"),
        mean,
        min: Math.min(...values),
        max: Math.max(...values),
        cpk,
        lsl: Number.isFinite(lsl) ? lsl : null,
        usl: Number.isFinite(usl) ? usl : null,
        unit: char.unit || "",
        values,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);

  if (variationPeriod.value === "CUSTOM") return rows;

  const groups = new Map();
  rows.forEach((row) => {
    const date = new Date(row.date);
    let key;
    let label;
    if (variationPeriod.value === "MONTHLY") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      label = date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
    } else {
      const monday = new Date(date);
      const day = monday.getDay() || 7;
      monday.setDate(monday.getDate() - day + 1);
      key = monday.toISOString().slice(0, 10);
      label = `Sem. ${monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
    }
    const group = groups.get(key) || { key, label, date: new Date(date), values: [], lsl: row.lsl, usl: row.usl, unit: row.unit };
    group.values.push(...row.values);
    groups.set(key, group);
  });

  return [...groups.values()].map((group) => {
    const mean = group.values.reduce((sum, value) => sum + value, 0) / group.values.length;
    const variance = group.values.length > 1 ? group.values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (group.values.length - 1) : 0;
    const deviation = Math.sqrt(variance);
    const cpk = deviation > 0 && Number.isFinite(group.lsl) && Number.isFinite(group.usl)
      ? Math.min((group.usl - mean) / (3 * deviation), (mean - group.lsl) / (3 * deviation))
      : null;
    return { id: group.key, label: group.label, date: group.date, mean, min: Math.min(...group.values), max: Math.max(...group.values), cpk, lsl: group.lsl, usl: group.usl, unit: group.unit };
  });
});

const variableChart = computed(() => {
  const rows = variableTrend.value.filter((row) => variableMetric.value !== "cpk" || Number.isFinite(row.cpk));
  if (!rows.length) return null;
  const width = 900;
  const height = 290;
  const pad = { left: 62, right: 24, top: 24, bottom: 48 };
  const values = variableMetric.value === "cpk"
    ? rows.flatMap((row) => [row.cpk, 1.33])
    : rows.flatMap((row) => [row.min, row.max, row.lsl, row.usl]).filter(Number.isFinite);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  const margin = Math.max((yMax - yMin) * 0.14, Math.abs(yMax || 1) * 0.04, 0.1);
  yMin -= margin;
  yMax += margin;
  const x = (index) => pad.left + (rows.length === 1 ? (width - pad.left - pad.right) / 2 : index * (width - pad.left - pad.right) / (rows.length - 1));
  const y = (value) => pad.top + (yMax - value) * (height - pad.top - pad.bottom) / (yMax - yMin || 1);
  const points = rows.map((row, index) => ({ ...row, x: x(index), y: y(variableMetric.value === "cpk" ? row.cpk : row.mean) }));
  const ticks = Array.from({ length: 5 }, (_, index) => {
    const value = yMax - index * (yMax - yMin) / 4;
    return { value, y: y(value) };
  });
  return {
    width, height, pad, points, ticks,
    line: points.map((point) => `${point.x},${point.y}`).join(" "),
    band: variableMetric.value === "measurements" ? [
      ...rows.map((row, index) => `${x(index)},${y(row.max)}`),
      ...rows.map((row, index) => `${x(rows.length - 1 - index)},${y(rows[rows.length - 1 - index].min)}`),
    ].join(" ") : "",
    targetY: variableMetric.value === "cpk" ? y(1.33) : null,
    lslY: variableMetric.value === "measurements" && Number.isFinite(rows[0].lsl) ? y(rows[0].lsl) : null,
    uslY: variableMetric.value === "measurements" && Number.isFinite(rows[0].usl) ? y(rows[0].usl) : null,
  };
});
</script>

<template>
  <section class="analytics-page vstack">
    <div class="analytics-heading">
      <div><div class="title">Análises da Qualidade</div><p>Visão consolidada do desempenho das inspeções IQC e OQC.</p></div>
      <div class="analytics-filters">
        <label>Horizonte de análise<select v-model="period"><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="180">Últimos 6 meses</option><option value="ALL">Série histórica completa</option></select></label>
        <label>Área da qualidade<select v-model="area"><option value="ALL">IQC + OQC</option><option value="IQC">IQC — Incoming Quality Control</option><option value="OQC">OQC — Outgoing Quality Control</option></select></label>
        <label>Conformidade<select v-model="result"><option value="ALL">Todos os resultados</option><option value="PASS">Conforme — PASS</option><option value="FAIL">Não conforme — FAIL</option></select></label>
        <label>Família de processo<select v-model="process"><option value="ALL">Todas as famílias</option><option value="BATERIA">Bateria</option><option value="CARREGADOR">Carregador</option><option value="ADAPTADOR">Adaptador</option><option value="TRAFO">Trafo</option><option value="TP LINK">TP-Link</option><option value="MODEM">Modem</option></select></label>
      </div>
    </div>
    <div class="tabline"></div>
    <div v-if="inspections.loading" class="card analytics-empty">Carregando indicadores...</div>
    <div v-else :key="`${period}-${area}-${result}-${process}`" class="analytics-results">
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
      <article class="card analytics-card variable-analysis-card">
        <header class="variable-analysis-header">
          <div><h3>Análise de estabilidade e capacidade do processo</h3><p>Monitoramento da tendência central, dispersão e índice de capacidade das características críticas</p></div>
          <div class="variable-analysis-controls">
            <label>Família de processo<select v-model="variationProcess"><option value="ALL">Todas as famílias</option><option value="BATERIA">Bateria</option><option value="CARREGADOR">Carregador</option><option value="ADAPTADOR">Adaptador</option><option value="TRAFO">Trafo</option><option value="TP LINK">TP-Link</option><option value="MODEM">Modem</option></select></label>
            <label>Estratificação temporal<select v-model="variationPeriod"><option value="WEEKLY">Agrupamento semanal — 12 semanas</option><option value="MONTHLY">Agrupamento mensal — 12 meses</option><option value="CUSTOM">Intervalo de análise personalizado</option></select></label>
            <label v-if="variationPeriod === 'CUSTOM'">Início do intervalo<input v-model="variationFrom" type="date" /></label>
            <label v-if="variationPeriod === 'CUSTOM'">Término do intervalo<input v-model="variationTo" type="date" /></label>
            <label>Característica da qualidade<select v-model="variableSelection"><option v-if="!variableOptions.length" value="">Sem dados de variável contínua</option><option v-for="option in variableOptions" :key="option.key" :value="option.key">{{ option.label }}</option></select></label>
            <label>Parâmetro estatístico<select v-model="variableMetric"><option value="cpk">Índice de capacidade — Cpk</option><option value="measurements">Tendência central e amplitude</option></select></label>
          </div>
        </header>

        <div v-if="!variableOptions.length" class="analytics-empty">Finalize inspeções com características variáveis e amostras numéricas para gerar este gráfico.</div>
        <div v-else-if="!variableChart" class="analytics-empty">Não há dados suficientes para calcular o indicador selecionado.</div>
        <div v-else class="variable-chart-wrap">
          <div class="variable-chart-legend">
            <span><i class="legend-line mean"></i>{{ variableMetric === 'cpk' ? 'Cpk calculado' : 'Média do subgrupo' }}</span>
            <span v-if="variableMetric === 'measurements'"><i class="legend-band"></i>Amplitude observada (mín.–máx.)</span>
            <span><i class="legend-line limit"></i>{{ variableMetric === 'cpk' ? 'Critério mínimo Cpk = 1,33' : 'LIE / LSE — limites de especificação' }}</span>
          </div>
          <svg class="variable-chart" :viewBox="`0 0 ${variableChart.width} ${variableChart.height}`" role="img" aria-label="Gráfico de variação da característica selecionada">
            <g v-for="tick in variableChart.ticks" :key="tick.y"><line :x1="variableChart.pad.left" :x2="variableChart.width - variableChart.pad.right" :y1="tick.y" :y2="tick.y" class="variable-grid-line"/><text :x="variableChart.pad.left - 10" :y="tick.y + 4" text-anchor="end" class="variable-axis-label">{{ tick.value.toFixed(variableMetric === 'cpk' ? 2 : 3) }}</text></g>
            <line v-if="variableChart.targetY !== null" :x1="variableChart.pad.left" :x2="variableChart.width - variableChart.pad.right" :y1="variableChart.targetY" :y2="variableChart.targetY" class="variable-limit-line"/>
            <line v-if="variableChart.lslY !== null" :x1="variableChart.pad.left" :x2="variableChart.width - variableChart.pad.right" :y1="variableChart.lslY" :y2="variableChart.lslY" class="variable-limit-line"/>
            <line v-if="variableChart.uslY !== null" :x1="variableChart.pad.left" :x2="variableChart.width - variableChart.pad.right" :y1="variableChart.uslY" :y2="variableChart.uslY" class="variable-limit-line"/>
            <polygon v-if="variableChart.band" :points="variableChart.band" class="variable-range-band"/>
            <polyline :points="variableChart.line" class="variable-mean-line"/>
            <g v-for="point in variableChart.points" :key="point.id"><circle :cx="point.x" :cy="point.y" r="5" class="variable-point"><title>{{ point.label }} — {{ variableMetric === 'cpk' ? `CPK ${point.cpk.toFixed(2)}` : `Média ${point.mean.toFixed(3)} ${point.unit}` }}</title></circle><text :x="point.x" :y="variableChart.height - 18" text-anchor="middle" class="variable-axis-label">{{ point.label }}</text></g>
          </svg>
          <div class="variable-chart-summary"><div><span>{{ variableMetric === 'cpk' ? 'Último Cpk apurado' : 'Última média apurada' }}</span><b>{{ variableMetric === 'cpk' ? variableTrend.at(-1)?.cpk?.toFixed(2) ?? '—' : variableTrend.at(-1)?.mean?.toFixed(3) ?? '—' }}</b></div><div><span>Subgrupos avaliados</span><b>{{ variableChart.points.length }}</b></div><div v-if="variableMetric === 'cpk'"><span>Avaliação de capacidade</span><b :class="(variableTrend.at(-1)?.cpk || 0) >= 1.33 ? 'text-ok' : 'text-bad'">{{ (variableTrend.at(-1)?.cpk || 0) >= 1.33 ? 'Processo potencialmente capaz' : 'Capacidade insuficiente' }}</b></div></div>
        </div>
      </article>
      <article class="card analytics-card analytics-trend">
        <header><div><h3>Evolução das inspeções</h3><p>Volume finalizado e taxa de aprovação nos últimos seis meses</p></div></header>
        <div class="trend-chart"><div v-for="item in trend" :key="item.label" class="trend-column"><span>{{ item.rate }}%</span><div class="trend-track"><i :style="{ height: `${Math.max(4, (item.total / maxMonthlyTotal) * 100)}%` }"></i></div><b>{{ item.label }}</b><small>{{ item.total }}</small></div></div>
      </article>
      <div class="analytics-grid-lists">
        <article class="card analytics-card"><header><div><h3>Principais não conformidades</h3><p>Características com maior recorrência</p></div></header><div v-if="!failureRanking.length" class="analytics-empty">Nenhuma não conformidade identificada.</div><ol v-else class="ranking-list"><li v-for="(item, index) in failureRanking" :key="item.name"><span class="rank">{{ index + 1 }}</span><b>{{ item.name }}</b><span>{{ item.count }} ocorrência(s)</span></li></ol></article>
        <article class="card analytics-card"><header><div><h3>Desempenho por origem</h3><p>Fornecedores ou clientes com reprovações</p></div></header><div v-if="!originRanking.length" class="analytics-empty">Nenhuma inspeção no período.</div><div v-else class="supplier-list"><div v-for="item in originRanking" :key="item.name"><div><b>{{ item.name }}</b><span>{{ item.fail }} reprovação(ões) em {{ item.total }}</span></div><strong :class="item.rate >= 95 ? 'text-ok' : 'text-bad'">{{ item.rate }}%</strong></div></div></article>
      </div>
      <article class="card analytics-card">
        <header><div><h3>Desempenho por família de processo</h3><p>Volume inspecionado e índice de conformidade por família de produto</p></div></header>
        <div v-if="!byProcess.length" class="analytics-empty">Nenhum processo encontrado no período.</div>
        <div v-else class="process-performance-grid"><div v-for="item in byProcess" :key="item.name" class="process-performance-item"><div><b>{{ item.name }}</b><span>{{ item.total }} inspeção(ões)</span></div><strong :class="item.rate >= 95 ? 'text-ok' : 'text-bad'">{{ item.rate }}%</strong><div class="progress"><i :style="{ width: `${item.rate}%` }"></i></div></div></div>
      </article>
    </div>
  </section>
</template>
