<script setup>
import { computed, onMounted, ref } from "vue";
import { useAlertsStore } from "../stores/alerts";
import { useAuthStore } from "../stores/auth";
import { useUiStore } from "../stores/ui";
import { requestPrompt } from "../services/systemFeedback";

const alerts = useAlertsStore();
const auth = useAuthStore();
const ui = useUiStore();
const showAlertsPanel = ref(false);
const notificationFilter = ref("unread");
const notificationMessage = ref("");

const openAlerts = computed(() =>
  (alerts.items || []).filter((item) => item.status !== "resolved")
);

const visibleNotifications = computed(() => {
  if (notificationFilter.value === "unread") {
    return openAlerts.value.filter((item) => item.status === "new");
  }
  return alerts.items || [];
});

onMounted(async () => {
  try {
    await alerts.refresh();
  } catch (error) {
    console.error("Erro ao carregar alertas:", error);
  }
});

function formatDateTimeBR(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

function alertTypeLabel(value) {
  const labels = {
    XRF_ONLY_FAIL: "XRF / RoHS",
    INSPECTION_FAIL: "Inspeção FAIL",
    SWITCHING_PENDING: "Comutação",
    DELTA_RETURN: "Condição Δ",
    DRAFT_OVERDUE: "Rascunho",
    REINSPECTION_REQUIRED: "Reinspeção",
  };
  return labels[String(value || "").toUpperCase()] || "Sistema";
}

function alertSeverityLabel(value) {
  const severity = String(value || "").toLowerCase();
  if (severity === "critical") return "Crítico";
  if (severity === "warning") return "Atenção";
  return "Informativo";
}

async function toggleAlertsPanel() {
  showAlertsPanel.value = !showAlertsPanel.value;
  if (!showAlertsPanel.value) return;
  try {
    await alerts.refresh();
  } catch (error) {
    console.error("Erro ao atualizar alertas:", error);
  }
}

async function viewAlert(item) {
  if (!item?.id || item.status !== "new") return;
  try {
    await alerts.markViewed(item.id);
  } catch (error) {
    console.error("Erro ao marcar alerta como visualizado:", error);
  }
}

async function resolveAlert(item) {
  if (!item?.id || !auth.canEditSystem) return;
  const note = await requestPrompt(
    "Informe a ação tomada para concluir esta notificação. Este campo é opcional.",
    { title: "Concluir notificação", confirmLabel: "Concluir" }
  );
  if (note === null) return;
  try {
    await alerts.resolve(item.id, note);
    notificationMessage.value = "Notificação concluída com sucesso.";
  } catch (error) {
    notificationMessage.value = error?.message || "Não foi possível concluir a notificação.";
  }
}

async function markAllNotificationsRead() {
  notificationMessage.value = "";
  try {
    await alerts.markAllViewed();
    notificationMessage.value = "Todas as notificações foram marcadas como lidas.";
  } catch (error) {
    notificationMessage.value = error?.message || "Não foi possível atualizar as notificações.";
  }
}
</script>

<template>
  <header class="top">
    <div class="wrap top-wrap">
      <div class="search">
        <input v-model="ui.q" placeholder="Pesquisar por PN, modelo, plano, cliente ou fornecedor" />
      </div>
      <div class="qs-user-box">
        <div class="alerts-wrap">
          <button class="alert-bell" type="button" title="Notificações do sistema" @click="toggleAlertsPanel">
            <span class="alert-bell-icon">🔔</span>
            <span v-if="alerts.newCount > 0" class="alert-bell-count">{{ alerts.newCount > 99 ? "99+" : alerts.newCount }}</span>
          </button>
          <div v-if="showAlertsPanel" class="alerts-panel">
            <div class="alerts-panel-head">
              <div><strong>Notificações</strong><span>{{ alerts.newCount }} não lida(s)</span></div>
              <button class="btn ghost alerts-refresh-btn" type="button" :disabled="alerts.loading" @click="alerts.refresh()">Atualizar</button>
            </div>

            <div class="notification-toolbar">
              <div class="notification-tabs">
                <button type="button" :class="{ active: notificationFilter === 'unread' }" @click="notificationFilter = 'unread'">Não lidas</button>
                <button type="button" :class="{ active: notificationFilter === 'all' }" @click="notificationFilter = 'all'">Todas</button>
              </div>
              <button class="notification-read-all" type="button" :disabled="alerts.newCount === 0" @click="markAllNotificationsRead">Marcar todas como lidas</button>
            </div>

            <div v-if="notificationMessage" class="notification-feedback">{{ notificationMessage }}</div>
            <div v-if="alerts.loading" class="alerts-empty">Carregando notificações...</div>
            <div v-else-if="alerts.error" class="alerts-empty alerts-error">{{ alerts.error }}</div>
            <div v-else-if="!visibleNotifications.length" class="alerts-empty">Nenhuma notificação nesta categoria.</div>
            <div v-else class="alerts-list">
              <div v-for="item in visibleNotifications" :key="item.id" class="alert-item" :class="{ 'alert-item-new': item.status === 'new', 'alert-item-viewed': item.status === 'viewed' }" role="button" tabindex="0" @click="viewAlert(item)" @keyup.enter="viewAlert(item)">
                <div class="alert-item-top">
                  <span class="alert-severity" :class="`alert-severity-${String(item.severity || 'info').toLowerCase()}`">{{ alertSeverityLabel(item.severity) }}</span>
                  <span class="alert-status" :class="`alert-status-${String(item.status || 'new').toLowerCase()}`">{{ item.status === "new" ? "Não lida" : item.status === "resolved" ? "Concluída" : "Lida" }}</span>
                </div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.message }}</p>
                <div class="alert-item-footer"><span>{{ alertTypeLabel(item.alertType) }}</span><span>{{ formatDateTimeBR(item.createdAt) }}</span></div>
                <button v-if="auth.canEditSystem && item.status !== 'resolved'" class="alert-resolve-btn" type="button" @click.stop="resolveAlert(item)">Concluir notificação</button>
              </div>
            </div>
          </div>
        </div>
        <div class="qs-user-info">
          <span>Logado como</span><b>{{ auth.userName }}</b>
          <span class="qs-role-pill">Nível {{ auth.accessLevel }} · {{ auth.cargo || auth.role }}</span>
        </div>
        <button class="btn ghost" type="button" @click="auth.logout()">Sair</button>
      </div>
    </div>
  </header>
</template>
