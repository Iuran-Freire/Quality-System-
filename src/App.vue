<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useUiStore } from "./stores/ui";
import { usePlansStore } from "./stores/plans";
import PlanModal from "./components/PlanModal.vue";
import InspectPage from "./components/InspectPage.vue";
import { useAuthStore } from "./stores/auth";
import LoginPage from "./components/LoginPage.vue";
import { useUsersStore } from "./stores/users";
import { useSwitchingStore } from "./stores/switching";

const ui = useUiStore();
const plans = usePlansStore();
const auth = useAuthStore();
const users = useUsersStore();
const switchingPasswordForm = ref({
  password: "",
  confirmPassword: "",
});
onMounted;
const switching = useSwitchingStore();
const switchingAnalysis = ref(null);
const switchingPlan = ref(null);
const showSwitchingModal = ref(false);
const showSwitchingAnalysisModal = ref(false);
const switchingPassword = ref("");
const switchingLoading = ref(false);

const canEditSystem = computed(() => auth.canEditSystem);
const canManageUsers = computed(() => auth.canManageUsers);

const showPlan = ref(false);
const editPlanId = ref(null);

const showUserModal = ref(false);
const editUserId = ref(null);

const userForm = ref({
  name: "",
  username: "",
  password: "",
  matricula: "",
  cargo: "",
  role: "inspetor",
  accessLevel: 3,
  active: true,
});

const sideHover = ref(false);
const sidePinned = ref(false);

const sideOpen = computed(() => sideHover.value || sidePinned.value);

const isForms = computed(() => ui.page === "forms");
const isInspect = computed(() => ui.page === "inspect");
const isAnalytics = computed(() => ui.page === "analytics");

const isManagement = computed(() => ui.page === "management");

// ------- paginação -------
const PAGE_SIZE = 10;
const currentPage = ref(1);

const sourcePlans = computed(() => {
  const s = String(ui.q || "")
    .trim()
    .toLowerCase();

  const list = plans.items || [];

  if (!s) return list;

  return list.filter((p) => {
    const blob = `
      ${p.type || ""}
      ${p.pn || ""}
      ${p.model || ""}
      ${p.name || ""}
      ${p.client || ""}
      ${p.supplier || ""}
      ${p.resp || ""}
      ${p.sampling?.mode || ""}
      ${p.sampling?.standard || ""}
      ${p.sampling?.clientName || ""}
    `.toLowerCase();

    return blob.includes(s);
  });
});

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
  await users.load();
  await switching.loadPasswordStatus();
  await switching.loadHistory();

  currentPage.value = 1;
});

watch(
  () => ui.page,
  async (page) => {
    if (page === "management") {
      await users.load();
      await switching.loadPasswordStatus();
      await switching.loadHistory();
    }
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

function samplingClass(p) {
  const mode = p?.sampling?.mode || "fixed";

  if (mode === "nbr5426") return "nbr";
  if (mode === "client") return "client";

  return "fixed";
}

function openNewUser() {
  editUserId.value = null;

  userForm.value = {
    name: "",
    username: "",
    password: "",
    matricula: "",
    cargo: "",
    role: "inspetor",
    accessLevel: 3,
    active: true,
  };

  showUserModal.value = true;
}

function openEditUser(user) {
  if (!user) return;

  editUserId.value = user.id;

  userForm.value = {
    name: user.name || "",
    username: user.username || "",
    password: "",
    matricula: user.matricula || "",
    cargo: user.cargo || "",
    role: user.role || "inspetor",
    accessLevel: Number(user.accessLevel || 3),
    active: Boolean(user.active),
  };

  showUserModal.value = true;
}

function syncUserRoleByAccessLevel() {
  const level = Number(userForm.value.accessLevel || 3);

  if (level === 1) {
    userForm.value.role = "admin";
    return;
  }

  if (level === 2) {
    userForm.value.role = "lider";
    return;
  }

  userForm.value.role = "inspetor";
}

async function saveUser() {
  if (!String(userForm.value.name || "").trim()) {
    alert("Preencha o nome.");
    return;
  }

  if (!String(userForm.value.username || "").trim()) {
    alert("Preencha o usuário/login.");
    return;
  }

  if (!editUserId.value && !String(userForm.value.password || "").trim()) {
    alert("Preencha a senha.");
    return;
  }

  if (!String(userForm.value.matricula || "").trim()) {
    alert("Preencha a matrícula.");
    return;
  }

  if (!String(userForm.value.cargo || "").trim()) {
    alert("Preencha o cargo.");
    return;
  }

  syncUserRoleByAccessLevel();

  try {
    const payload = {
      ...userForm.value,
      username: String(userForm.value.username || "")
        .trim()
        .toLowerCase(),
      accessLevel: Number(userForm.value.accessLevel || 3),
    };

    if (editUserId.value) {
      await users.update(editUserId.value, payload);
      alert("Usuário atualizado com sucesso.");
    } else {
      await users.create(payload);
      alert("Usuário criado com sucesso.");
    }

    showUserModal.value = false;
    editUserId.value = null;

    await users.load();
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    alert(error?.message || "Não foi possível criar o usuário.");
  }
}

async function toggleUserActive(user) {
  if (!user) return;

  if (String(user.id) === String(auth.user?.id)) {
    alert("Você não pode inativar o seu próprio usuário.");
    return;
  }

  const nextActive = !user.active;

  const ok = confirm(
    `${nextActive ? "Ativar" : "Inativar"} este usuário?\n\n` +
      `Nome: ${user.name || "-"}\n` +
      `Usuário: ${user.username || "-"}\n` +
      `Matrícula: ${user.matricula || "-"}\n` +
      `Cargo: ${user.cargo || "-"}`
  );

  if (!ok) return;

  try {
    await users.setActive(user.id, nextActive);
    await users.load();

    alert(nextActive ? "Usuário ativado com sucesso." : "Usuário inativado com sucesso.");
  } catch (error) {
    console.error("Erro ao alterar status do usuário:", error);
    alert(error?.message || "Não foi possível alterar o status do usuário.");
  }
}

async function saveSwitchingPassword() {
  if (!auth.canEditSystem) {
    alert("Você não possui permissão para alterar a senha de comutação.");
    return;
  }

  if (!String(switchingPasswordForm.value.password || "").trim()) {
    alert("Informe a senha de comutação.");
    return;
  }

  if (
    String(switchingPasswordForm.value.password) !==
    String(switchingPasswordForm.value.confirmPassword)
  ) {
    alert("A confirmação da senha não confere.");
    return;
  }

  if (String(switchingPasswordForm.value.password).length < 4) {
    alert("A senha de comutação deve ter pelo menos 4 caracteres.");
    return;
  }

  const ok = confirm(
    switching.hasPassword
      ? "Deseja alterar a senha de comutação?"
      : "Deseja cadastrar a senha de comutação?"
  );

  if (!ok) return;

  try {
    await switching.savePassword(
      switchingPasswordForm.value.password,
      switchingPasswordForm.value.confirmPassword
    );

    switchingPasswordForm.value = {
      password: "",
      confirmPassword: "",
    };

    await switching.loadPasswordStatus();

    alert("Senha de comutação salva com sucesso.");
  } catch (error) {
    console.error("Erro ao salvar senha de comutação:", error);
    alert(error?.message || "Não foi possível salvar a senha de comutação.");
  }
}

async function analyzePlanSwitching(plan) {
  if (!plan?.id) return;

  switchingLoading.value = true;

  try {
    const data = await switching.analyzePlan(plan.id);

    switchingAnalysis.value = data.analysis;
    switchingPlan.value = data.plan;

    showSwitchingAnalysisModal.value = true;
  } catch (error) {
    console.error("Erro ao analisar comutação:", error);
    alert(error?.message || "Não foi possível analisar a comutação.");
  } finally {
    switchingLoading.value = false;
  }
}

function openApproveSwitching(plan) {
  if (!plan?.id) return;

  switchingPlan.value = plan;
  switchingPassword.value = "";
  showSwitchingModal.value = true;
}

async function approvePlanSwitching() {
  if (!switchingPlan.value?.id) return;

  if (!String(switchingPassword.value || "").trim()) {
    alert("Informe a senha de comutação.");
    return;
  }

  const approvedBy = {
    id: auth.user?.id,
    name: auth.user?.name,
    username: auth.user?.username,
    role: auth.user?.role,
    accessLevel: auth.accessLevel,
  };

  switchingLoading.value = true;

  try {
    await switching.approvePlan(
      switchingPlan.value.id,
      switchingPassword.value,
      approvedBy
    );

    showSwitchingModal.value = false;
    switchingPassword.value = "";

    await plans.load();
    await switching.loadHistory();

    alert("Comutação aprovada com sucesso.");
  } catch (error) {
    console.error("Erro ao aprovar comutação:", error);
    alert(error?.message || "Não foi possível aprovar a comutação.");
  } finally {
    switchingLoading.value = false;
  }
}

function regimeLabel(value) {
  const regime = String(value || "normal").toLowerCase();

  if (regime === "atenuada") return "Atenuada";
  if (regime === "severa") return "Severa";

  return "Normal";
}

function switchingStatusLabel(value) {
  const status = String(value || "sem_pendencia").toLowerCase();

  if (status === "pendente") return "Pendente de aprovação";
  if (status === "aprovado") return "Aprovado";
  if (status === "recusado") return "Recusado";

  return "Sem pendência";
}

function formatDateTimeBR(value) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function userLevelLabel(level) {
  const n = Number(level || 3);

  if (n === 1) return "Nível 1";
  if (n === 2) return "Nível 2";

  return "Nível 3";
}

async function registerSwitchingSuggestion() {
  if (!switchingPlan.value?.id) return;

  if (!switchingAnalysis.value?.hasSuggestion) {
    alert("Não existe sugestão de comutação para registrar.");
    return;
  }

  const ok = confirm("Deseja registrar esta sugestão como pendente?");

  if (!ok) return;

  switchingLoading.value = true;

  try {
    await switching.suggestPlan(switchingPlan.value.id);

    showSwitchingAnalysisModal.value = false;

    await plans.load();
    await switching.loadHistory();

    alert("Sugestão de comutação registrada como pendente.");
  } catch (error) {
    console.error("Erro ao registrar sugestão de comutação:", error);
    alert(error?.message || "Não foi possível registrar a sugestão de comutação.");
  } finally {
    switchingLoading.value = false;
  }
}

function resultLabel(value) {
  const result = String(value || "").toUpperCase();

  if (result === "PASS") return "PASS";
  if (result === "FAIL") return "FAIL";

  return result || "—";
}

function resultClass(value) {
  const result = String(value || "").toUpperCase();

  if (result === "PASS") return "pass";
  if (result === "FAIL") return "fail";

  return "neutral";
}

function getConsecutiveValidLots() {
  const history = switchingAnalysis.value?.history || [];
  const currentRegime = String(switchingAnalysis.value?.currentRegime || "normal")
    .trim()
    .toLowerCase();

  const validLots = [];

  for (const item of history) {
    const inspectionRegime = String(item.inspectionRegimeSnapshot || "")
      .trim()
      .toLowerCase();

    if (inspectionRegime !== currentRegime) break;

    validLots.push(item);
  }

  return validLots;
}

function getSwitchingTarget() {
  const regime = String(switchingAnalysis.value?.currentRegime || "normal").toLowerCase();

  if (regime === "normal") return 10;
  if (regime === "severa") return 5;

  return 1;
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

        <div
          class="mi"
          :class="{ active: isManagement }"
          @click="ui.setPage('management')"
        >
          ⚙️<span class="mi-label">Gerenciamento</span>
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
              <span class="qs-role-pill">
                Nível {{ auth.accessLevel }} · {{ auth.cargo || auth.role }}
              </span>
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
                    <th>Regime</th>
                    <th>Comutação</th>
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
                      <div v-if="canEditSystem" class="actions-wrap">
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
                        <button
                          class="btn ghost"
                          type="button"
                          :disabled="switchingLoading"
                          @click="analyzePlanSwitching(p)"
                        >
                          Analisar comutação
                        </button>

                        <button
                          v-if="canEditSystem && p.switchingStatus === 'pendente'"
                          class="btn primary"
                          type="button"
                          :disabled="switchingLoading"
                          @click="openApproveSwitching(p)"
                        >
                          Aprovar comutação
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
              v-if="canEditSystem"
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
        <div v-else-if="isAnalytics" class="vstack">
          <div class="title">Análises</div>
          <div class="tabline"></div>
          <div class="card">Em construção…</div>
        </div>

        <!-- ================= GERENCIAMENTO ================= -->
        <div v-else-if="isManagement" class="vstack">
          <div class="title">Gerenciamento</div>
          <div class="tabline"></div>

          <div class="management-summary">
            <div class="mg-card">
              <span>Total de usuários</span>
              <b>{{ users.totalUsers }}</b>
            </div>

            <div class="mg-card">
              <span>Ativos</span>
              <b>{{ users.totalActive }}</b>
            </div>

            <div class="mg-card">
              <span>Nível 1</span>
              <b>{{ users.totalAdmins }}</b>
            </div>

            <div class="mg-card">
              <span>Nível 2</span>
              <b>{{ users.totalLevel2 }}</b>
            </div>

            <div class="mg-card">
              <span>Inspetores</span>
              <b>{{ users.totalInspectors }}</b>
            </div>
          </div>

          <div class="switching-config-card">
            <div class="switching-config-head">
              <div>
                <h3>Configuração de Comutação</h3>
                <p>
                  Cadastre a senha usada para confirmar alterações de regime de inspeção.
                </p>
              </div>

              <span
                class="switching-password-status"
                :class="switching.hasPassword ? 'ok' : 'warn'"
              >
                {{ switching.hasPassword ? "Senha cadastrada" : "Senha não cadastrada" }}
              </span>
            </div>

            <div class="switching-password-form">
              <label class="float-label">
                <input
                  v-model="switchingPasswordForm.password"
                  type="password"
                  placeholder=" "
                  :disabled="!canEditSystem"
                />
                <span>
                  {{
                    switching.hasPassword
                      ? "Nova senha de comutação"
                      : "Senha de comutação"
                  }}
                </span>
              </label>

              <label class="float-label">
                <input
                  v-model="switchingPasswordForm.confirmPassword"
                  type="password"
                  placeholder=" "
                  :disabled="!canEditSystem"
                />
                <span>Confirmar senha</span>
              </label>

              <button
                class="btn primary"
                type="button"
                :disabled="!canEditSystem"
                @click="saveSwitchingPassword"
              >
                {{ switching.hasPassword ? "Alterar senha" : "Cadastrar senha" }}
              </button>
            </div>

            <p v-if="!canEditSystem" class="muted-text">
              Apenas usuários Nível 1 ou Nível 2 podem configurar a senha de comutação.
            </p>
          </div>

          <div class="card tablecard">
            <div
              class="hstack"
              style="
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
              "
            >
              <div>
                <h3 style="margin: 0">Histórico de Comutação</h3>
                <p class="muted-text" style="margin: 4px 0 0 0">
                  Registro das alterações de regime aprovadas no sistema.
                </p>
              </div>

              <button
                class="btn ghost"
                type="button"
                :disabled="switching.loading"
                @click="switching.loadHistory()"
              >
                Atualizar
              </button>
            </div>

            <div class="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Plano</th>
                    <th>PN</th>
                    <th>Modelo</th>
                    <th>Anterior</th>
                    <th>Novo</th>
                    <th>Motivo</th>
                    <th>Aprovado por</th>
                    <th>Nível</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-if="switching.loading">
                    <td colspan="9">Carregando histórico...</td>
                  </tr>

                  <tr v-else-if="!switching.history.length">
                    <td colspan="9">Nenhuma comutação registrada ainda.</td>
                  </tr>

                  <tr v-else v-for="h in switching.history" :key="h.id">
                    <td>{{ formatDateTimeBR(h.approvedAt) }}</td>

                    <td>{{ h.planName || "—" }}</td>

                    <td>{{ h.pn || "—" }}</td>

                    <td>{{ h.model || "—" }}</td>

                    <td>
                      <span
                        class="regime-pill"
                        :class="`regime-${h.previousRegime || 'normal'}`"
                      >
                        {{ regimeLabel(h.previousRegime) }}
                      </span>
                    </td>

                    <td>
                      <span
                        class="regime-pill"
                        :class="`regime-${h.newRegime || 'normal'}`"
                      >
                        {{ regimeLabel(h.newRegime) }}
                      </span>
                    </td>

                    <td>{{ h.reason || "—" }}</td>

                    <td>{{ h.approvedByName || "—" }}</td>

                    <td>{{ userLevelLabel(h.approvedByLevel) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card tablecard">
            <div
              class="hstack"
              style="
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
              "
            >
              <h3 style="margin: 0">Usuários cadastrados</h3>

              <button
                v-if="canManageUsers"
                class="btn"
                type="button"
                @click="openNewUser"
              >
                + Novo usuário
              </button>
            </div>

            <div class="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Nome</th>
                    <th>Usuário</th>
                    <th>Matrícula</th>
                    <th>Cargo</th>
                    <th>Nível</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-if="users.loading">
                    <td colspan="7">Carregando usuários...</td>
                  </tr>

                  <tr v-else-if="users.error">
                    <td colspan="7">Erro ao carregar usuários: {{ users.error }}</td>
                  </tr>

                  <tr v-else-if="!users.items.length">
                    <td colspan="7">Nenhum usuário cadastrado.</td>
                  </tr>

                  <tr v-else v-for="u in users.items" :key="u.id">
                    <td>
                      <span class="status-pill" :class="u.active ? 'on' : 'off'">
                        {{ u.active ? "Ativo" : "Inativo" }}
                      </span>
                    </td>

                    <td>{{ u.name }}</td>
                    <td>{{ u.username }}</td>
                    <td>{{ u.matricula || "—" }}</td>
                    <td>{{ u.cargo || "—" }}</td>
                    <td>Nível {{ u.accessLevel || 3 }}</td>

                    <td>
                      <div v-if="canManageUsers" class="actions-wrap">
                        <button class="btn ghost" type="button" @click="openEditUser(u)">
                          Editar
                        </button>

                        <button
                          class="btn ghost danger"
                          type="button"
                          :disabled="String(u.id) === String(auth.user?.id)"
                          @click="toggleUserActive(u)"
                        >
                          {{ u.active ? "Inativar" : "Ativar" }}
                        </button>
                      </div>

                      <span v-else class="muted-text">Visualização</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
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

  <div class="modal" :class="{ show: showUserModal }" @click.self="showUserModal = false">
    <div class="sheet vstack user-sheet">
      <div class="hstack" style="justify-content: space-between; align-items: center">
        <h3>{{ editUserId ? "Editar usuário" : "Novo usuário" }}</h3>

        <button class="btn ghost" type="button" @click="showUserModal = false">
          Fechar
        </button>
      </div>

      <div class="hr"></div>

      <h4 class="modal-section-title">Dados do usuário</h4>

      <div class="row">
        <div class="span-3">
          <label class="float-label">
            <input v-model="userForm.name" placeholder=" " />
            <span>Nome *</span>
          </label>
        </div>

        <div class="span-3">
          <label class="float-label">
            <input v-model="userForm.username" placeholder=" " />
            <span>Usuário / Login *</span>
          </label>
        </div>

        <div class="span-3">
          <label class="float-label">
            <input v-model="userForm.password" type="password" placeholder=" " />
            <span>{{ editUserId ? "Nova senha (opcional)" : "Senha *" }}</span>
          </label>
        </div>

        <div class="span-3">
          <label class="float-label">
            <input v-model="userForm.matricula" placeholder=" " />
            <span>Matrícula *</span>
          </label>
        </div>

        <div class="span-3">
          <label class="float-label">
            <input v-model="userForm.cargo" placeholder=" " />
            <span>Cargo *</span>
          </label>
        </div>

        <div class="span-2">
          <label class="float-label">
            <select
              v-model.number="userForm.accessLevel"
              @change="syncUserRoleByAccessLevel"
            >
              <option :value="1">Nível 1 - Controle total</option>
              <option :value="2">Nível 2 - Controle total</option>
              <option :value="3">Nível 3 - Operacional</option>
            </select>
            <span>Nível *</span>
          </label>
        </div>

        <div class="span-2">
          <label class="float-label">
            <select v-model="userForm.active">
              <option :value="true">Ativo</option>
              <option :value="false">Inativo</option>
            </select>
            <span>Status</span>
          </label>
        </div>
      </div>

      <div class="hr"></div>

      <div class="hstack" style="justify-content: flex-end; gap: 8px">
        <button class="btn ghost" type="button" @click="showUserModal = false">
          Cancelar
        </button>

        <button class="btn" type="button" @click="saveUser">
          {{ editUserId ? "Salvar alterações" : "Salvar usuário" }}
        </button>
      </div>
    </div>
  </div>

  <div
    class="modal"
    :class="{ show: showSwitchingModal }"
    @click.self="showSwitchingModal = false"
  >
    <div class="sheet vstack switching-approval-modal">
      <div class="hstack" style="justify-content: space-between; align-items: center">
        <h3>Aprovar comutação</h3>

        <button class="btn ghost" type="button" @click="showSwitchingModal = false">
          Fechar
        </button>
      </div>

      <div class="hr"></div>

      <div class="switching-approval-body">
        <p>Confirme a alteração do regime de inspeção usando a senha de comutação.</p>

        <div class="switching-approval-summary">
          <div>
            <span>Plano</span>
            <b>{{ switchingPlan?.name || "-" }}</b>
          </div>

          <div>
            <span>Regime atual</span>
            <b>{{ switchingPlan?.inspectionRegime || "-" }}</b>
          </div>

          <div>
            <span>Regime sugerido</span>
            <b>{{ switchingPlan?.suggestedRegime || "-" }}</b>
          </div>

          <div>
            <span>Motivo</span>
            <b>{{ switchingPlan?.switchingReason || "-" }}</b>
          </div>
        </div>

        <label class="float-label">
          <input
            v-model="switchingPassword"
            type="password"
            placeholder=" "
            @keyup.enter="approvePlanSwitching"
          />
          <span>Senha de comutação</span>
        </label>
      </div>

      <div class="hr"></div>

      <div class="hstack" style="justify-content: flex-end; gap: 8px">
        <button class="btn ghost" type="button" @click="showSwitchingModal = false">
          Cancelar
        </button>

        <button
          class="btn"
          type="button"
          :disabled="switchingLoading"
          @click="approvePlanSwitching"
        >
          Confirmar comutação
        </button>
      </div>
    </div>
  </div>

  <div
    class="modal"
    :class="{ show: showSwitchingAnalysisModal }"
    @click.self="showSwitchingAnalysisModal = false"
  >
    <div class="sheet vstack switching-analysis-modal">
      <div class="hstack" style="justify-content: space-between; align-items: center">
        <div>
          <h3>Análise de Comutação</h3>
          <p class="muted-text" style="margin: 4px 0 0 0">
            Verificação do histórico de lotes para sugestão de regime de inspeção.
          </p>
        </div>

        <button
          class="btn ghost"
          type="button"
          @click="showSwitchingAnalysisModal = false"
        >
          Fechar
        </button>
      </div>

      <div class="hr"></div>

      <div class="switching-analysis-summary">
        <div>
          <span>Plano</span>
          <b>{{ switchingPlan?.name || "-" }}</b>
        </div>

        <div>
          <span>PN</span>
          <b>{{ switchingPlan?.pn || "-" }}</b>
        </div>

        <div>
          <span>Modelo</span>
          <b>{{ switchingPlan?.model || "-" }}</b>
        </div>

        <div>
          <span>Cliente</span>
          <b>{{ switchingPlan?.client || "-" }}</b>
        </div>

        <div>
          <span>Regime atual</span>
          <b>
            <span
              class="regime-pill"
              :class="`regime-${switchingAnalysis?.currentRegime || 'normal'}`"
            >
              {{ regimeLabel(switchingAnalysis?.currentRegime) }}
            </span>
          </b>
        </div>

        <div>
          <span>Regime sugerido</span>
          <b v-if="switchingAnalysis?.hasSuggestion">
            <span
              class="regime-pill"
              :class="`regime-${switchingAnalysis?.suggestedRegime || 'normal'}`"
            >
              {{ regimeLabel(switchingAnalysis?.suggestedRegime) }}
            </span>
          </b>

          <b v-else>Sem sugestão</b>
        </div>
      </div>

      <div
        class="switching-analysis-message"
        :class="switchingAnalysis?.hasSuggestion ? 'has-suggestion' : 'no-suggestion'"
      >
        <strong>
          {{
            switchingAnalysis?.hasSuggestion
              ? "Sugestão encontrada"
              : "Sem critério de comutação"
          }}
        </strong>

        <span>
          {{
            switchingAnalysis?.reason ||
            "Histórico ainda não atende critério para comutação."
          }}
        </span>
      </div>

      <div class="switching-history-preview">
        <div class="switching-valid-lots">
          <div>
            <span>Regime em análise</span>

            <b>
              {{ regimeLabel(switchingAnalysis?.currentRegime) }}
            </b>
          </div>

          <div>
            <span>Lotes consecutivos válidos</span>

            <b>
              {{ getConsecutiveValidLots().length }}
              de
              {{ getSwitchingTarget() }}
            </b>
          </div>
        </div>

        <div class="hstack" style="justify-content: space-between; align-items: center">
          <h4 style="margin: 0">Últimos registros do histórico</h4>

          <span class="muted-text">
            {{ switchingAnalysis?.history?.length || 0 }} registro(s)
          </span>
        </div>

        <div class="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Lote</th>
                <th>NF</th>
                <th>Resultado</th>
                <th>Regime executado</th>
                <th>Finalizado em</th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="!switchingAnalysis?.history?.length">
                <td colspan="4">Nenhum histórico encontrado para este plano.</td>
              </tr>

              <tr v-else v-for="h in switchingAnalysis.history" :key="h.id">
                <td>{{ h.lot || "—" }}</td>
                <td>{{ h.invoice || "—" }}</td>
                <td>
                  <span class="result-pill" :class="resultClass(h.result)">
                    {{ resultLabel(h.result) }}
                  </span>
                </td>

                <td>
                  <span
                    class="regime-pill"
                    :class="`regime-${h.inspectionRegimeSnapshot || 'normal'}`"
                  >
                    {{ regimeLabel(h.inspectionRegimeSnapshot) }}
                  </span>
                </td>

                <td>{{ formatDateTimeBR(h.finishedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="hr"></div>

      <div class="hstack" style="justify-content: flex-end; gap: 8px">
        <button
          class="btn ghost"
          type="button"
          @click="showSwitchingAnalysisModal = false"
        >
          Cancelar
        </button>

        <button
          v-if="switchingAnalysis?.hasSuggestion"
          class="btn"
          type="button"
          :disabled="switchingLoading"
          @click="registerSwitchingSuggestion"
        >
          Registrar sugestão
        </button>

        <button v-else class="btn ghost" type="button" disabled>
          Sem sugestão disponível
        </button>
      </div>
    </div>
  </div>
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

.management-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(140px, 1fr));
  gap: 12px;
}

.mg-card {
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: var(--shadow-min);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mg-card span {
  color: var(--muted, #64748b);
  font-size: 12px;
  font-weight: 700;
}

.mg-card b {
  color: var(--text, #111827);
  font-size: 24px;
  font-weight: 900;
}

@media (max-width: 1100px) {
  .management-summary {
    grid-template-columns: repeat(2, minmax(140px, 1fr));
  }
}

.user-sheet {
  max-width: 920px;
}

.modal-section-title {
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.switching-config-card {
  margin-top: 14px;
  margin-bottom: 14px;
  padding: 16px;
  border: 1px solid #fed7aa;
  border-radius: 18px;
  background: #fff7ed;
  box-shadow: var(--shadow-min);
}

.switching-config-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.switching-config-head h3 {
  margin: 0;
  font-size: 18px;
  color: #7c2d12;
}

.switching-config-head p {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: #9a3412;
}

.switching-password-status {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.switching-password-status.ok {
  color: #166534;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
}

.switching-password-status.warn {
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fde68a;
}

.switching-password-form {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 12px;
  align-items: center;
}

@media (max-width: 900px) {
  .switching-config-head {
    flex-direction: column;
  }

  .switching-password-form {
    grid-template-columns: 1fr;
  }
}

.switching-approval-modal {
  max-width: 640px;
}

.switching-approval-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.switching-approval-body p {
  margin: 0;
  color: var(--muted, #64748b);
  font-size: 14px;
}

.switching-approval-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.switching-approval-summary div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.switching-approval-summary span {
  font-size: 11px;
  font-weight: 800;
  color: var(--muted, #64748b);
}

.switching-approval-summary b {
  font-size: 13px;
  color: var(--text, #111827);
}

.regime-pill,
.switching-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 78px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.regime-normal {
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.regime-atenuada {
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.regime-severa {
  color: #991b1b;
  background: #fff1f2;
  border: 1px solid #fecdd3;
}

.switching-pill.ok {
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.switching-pill.pending {
  color: #c2410c;
  background: #fff7ed;
  border: 1px solid #fdba74;
}

.switching-analysis-modal {
  max-width: 980px;
}

.switching-analysis-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.switching-analysis-summary > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.switching-analysis-summary span {
  font-size: 11px;
  font-weight: 800;
  color: var(--muted, #64748b);
}

.switching-analysis-summary b {
  font-size: 13px;
  color: var(--text, #111827);
}

.switching-analysis-message {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
}

.switching-analysis-message strong {
  font-size: 14px;
  font-weight: 900;
}

.switching-analysis-message span {
  font-size: 13px;
}

.switching-analysis-message.has-suggestion {
  background: #fff7ed;
  border-color: #fdba74;
  color: #9a3412;
}

.switching-analysis-message.no-suggestion {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #475569;
}

.switching-valid-lots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.switching-valid-lots > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 14px;
  background: #eff6ff;
}

.switching-valid-lots span {
  font-size: 11px;
  font-weight: 800;
  color: #64748b;
}

.switching-valid-lots b {
  font-size: 15px;
  color: #1e3a8a;
}

@media (max-width: 900px) {
  .switching-valid-lots {
    grid-template-columns: 1fr;
  }
}

.switching-history-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
}

.result-pill.pass {
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.result-pill.fail {
  color: #991b1b;
  background: #fff1f2;
  border: 1px solid #fecdd3;
}

.result-pill.neutral {
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

@media (max-width: 900px) {
  .switching-analysis-summary {
    grid-template-columns: 1fr;
  }
}
</style>
