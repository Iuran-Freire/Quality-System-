<script setup>
import { computed, onMounted, ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { useSwitchingStore } from "../stores/switching";
import { useUsersStore } from "../stores/users";
import UserModal from "./UserModal.vue";
import { requestConfirmation } from "../services/systemFeedback";

const auth = useAuthStore();
const switching = useSwitchingStore();
const users = useUsersStore();
const showUserModal = ref(false);
const editUserId = ref(null);
const switchingPasswordForm = ref({ password: "", confirmPassword: "" });
const canEditSystem = computed(() => auth.canEditSystem);
const canManageUsers = computed(() => auth.canManageUsers);

onMounted(async () => {
  await users.load();
  await switching.loadPasswordStatus();
  await switching.loadHistory();
});

function openNewUser() {
  editUserId.value = null;
  showUserModal.value = true;
}
function openEditUser(user) {
  if (!user) return;
  editUserId.value = user.id;
  showUserModal.value = true;
}
async function toggleUserActive(user) {
  if (!user) return;
  if (String(user.id) === String(auth.user?.id)) return alert("Você não pode inativar o seu próprio usuário.");
  const nextActive = !user.active;
  const confirmed = await requestConfirmation(`${nextActive ? "Ativar" : "Inativar"} este usuário?\n\nNome: ${user.name || "-"}\nUsuário: ${user.username || "-"}\nMatrícula: ${user.matricula || "-"}\nCargo: ${user.cargo || "-"}`, { title: `${nextActive ? "Ativar" : "Inativar"} usuário`, confirmLabel: nextActive ? "Ativar" : "Inativar", danger: !nextActive });
  if (!confirmed) return;
  try {
    await users.setActive(user.id, nextActive);
    await users.load();
    alert(nextActive ? "Usuário ativado com sucesso." : "Usuário inativado com sucesso.");
  } catch (error) {
    alert(error?.message || "Não foi possível alterar o status do usuário.");
  }
}
async function saveSwitchingPassword() {
  if (!auth.canEditSystem) return alert("Você não possui permissão para alterar a senha de comutação.");
  if (!String(switchingPasswordForm.value.password || "").trim()) return alert("Informe a senha de comutação.");
  if (switchingPasswordForm.value.password !== switchingPasswordForm.value.confirmPassword) return alert("A confirmação da senha não confere.");
  if (switchingPasswordForm.value.password.length < 4) return alert("A senha de comutação deve ter pelo menos 4 caracteres.");
  if (!(await requestConfirmation(switching.hasPassword ? "Deseja alterar a senha de comutação?" : "Deseja cadastrar a senha de comutação?", { title: "Senha de comutação", confirmLabel: "Salvar senha" }))) return;
  try {
    await switching.savePassword(switchingPasswordForm.value.password, switchingPasswordForm.value.confirmPassword);
    switchingPasswordForm.value = { password: "", confirmPassword: "" };
    await switching.loadPasswordStatus();
    alert("Senha de comutação salva com sucesso.");
  } catch (error) {
    alert(error?.message || "Não foi possível salvar a senha de comutação.");
  }
}
function regimeLabel(value) {
  const regime = String(value || "normal").toLowerCase();
  return regime === "atenuada" ? "Atenuada" : regime === "severa" ? "Severa" : "Normal";
}
function formatDateTimeBR(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function userLevelLabel(level) {
  const value = Number(level || 3);
  return value === 1 ? "Nível 1" : value === 2 ? "Nível 2" : "Nível 3";
}
</script>

<template>
<section class="vstack">
  <div class="title">Administração do Sistema</div>
  <div class="tabline"></div>

  <div class="management-summary">
    <div class="mg-card">
      <span>Total de usuários cadastrados</span>
      <b>{{ users.totalUsers }}</b>
    </div>

    <div class="mg-card">
      <span>Usuários com acesso ativo</span>
      <b>{{ users.totalActive }}</b>
    </div>

    <div class="mg-card">
      <span>Administradores — Nível 1</span>
      <b>{{ users.totalAdmins }}</b>
    </div>

    <div class="mg-card">
      <span>Liderança — Nível 2</span>
      <b>{{ users.totalLevel2 }}</b>
    </div>

    <div class="mg-card">
      <span>Inspetores — Nível 3</span>
      <b>{{ users.totalInspectors }}</b>
    </div>
  </div>

  <div class="switching-config-card">
    <div class="switching-config-head">
      <div>
        <h3>Autorização de Alteração do Regime</h3>

        <p>
          Defina a senha utilizada pela liderança para autorizar alterações do
          regime de inspeção.
        </p>
      </div>

      <span
        class="switching-password-status"
        :class="switching.hasPassword ? 'ok' : 'warn'"
      >
        {{
          switching.hasPassword
            ? "Senha de autorização cadastrada"
            : "Senha de autorização não cadastrada"
        }}
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
              ? "Nova senha de autorização"
              : "Senha de autorização"
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

        <span>Confirmar senha de autorização</span>
      </label>

      <button
        class="btn primary"
        type="button"
        :disabled="!canEditSystem"
        @click="saveSwitchingPassword"
      >
        {{ switching.hasPassword ? "Atualizar senha" : "Cadastrar senha" }}
      </button>
    </div>

    <p v-if="!canEditSystem" class="muted-text">
      Apenas usuários de Nível 1 ou Nível 2 podem configurar a senha de
      autorização.
    </p>
  </div>

  <div class="card tablecard management-card">
    <div class="management-card-header">
      <div>
        <h3>Histórico de Alterações do Regime</h3>

        <p>
          Registro das alterações de regime autorizadas e aplicadas aos planos de
          inspeção.
        </p>
      </div>

      <button
        class="btn ghost"
        type="button"
        :disabled="switching.loading"
        @click="switching.loadHistory()"
      >
        Atualizar registros
      </button>
    </div>

    <div class="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Data da alteração</th>
            <th>Plano de Inspeção</th>
            <th>PN</th>
            <th>Modelo</th>
            <th>Regime anterior</th>
            <th>Novo regime</th>
            <th>Critério da alteração</th>
            <th>Autorizado por</th>
            <th>Nível de acesso</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="switching.loading">
            <td colspan="9">Carregando histórico...</td>
          </tr>

          <tr v-else-if="!switching.history.length">
            <td colspan="9">
              Nenhuma alteração de regime foi registrada até o momento.
            </td>
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

  <div class="card tablecard management-card">
    <div class="management-card-header">
      <div>
        <h3>Gestão de Usuários</h3>

        <p>Administração dos acessos, níveis de permissão e áreas de inspeção.</p>
      </div>

      <button
        v-if="canManageUsers"
        class="btn"
        type="button"
        @click="openNewUser"
      >
        + Cadastrar usuário
      </button>
    </div>

    <div class="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Situação</th>
            <th>Nome completo</th>
            <th>Identificação de acesso</th>
            <th>Matrícula</th>
            <th>Função</th>
            <th>Área de atuação</th>
            <th>Nível de acesso</th>
            <th>Operações</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="users.loading">
            <td colspan="8">Carregando usuários...</td>
          </tr>

          <tr v-else-if="users.error">
            <td colspan="8">Erro ao carregar usuários: {{ users.error }}</td>
          </tr>

          <tr v-else-if="!users.items.length">
            <td colspan="8">Nenhum usuário cadastrado.</td>
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
            <td class="management-user-role">
              {{ u.cargo || "—" }}
            </td>

            <td>
              <span
                class="area-pill"
                :class="`area-${u.inspectionArea || 'none'}`"
              >
                {{
                  u.inspectionArea === "ALL"
                    ? "Ambos"
                    : u.inspectionArea || "Não definida"
                }}
              </span>
            </td>

            <td>Nível {{ u.accessLevel || 3 }}</td>

            <td>
              <div v-if="canManageUsers" class="management-user-actions">
                <button class="btn ghost" type="button" @click="openEditUser(u)">
                  Editar acesso
                </button>

                <button
                  class="btn ghost danger"
                  type="button"
                  :disabled="String(u.id) === String(auth.user?.id)"
                  @click="toggleUserActive(u)"
                >
                  {{ u.active ? "Desativar acesso" : "Ativar acesso" }}
                </button>
              </div>

              <span v-else class="muted-text">Visualização</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
  <UserModal :show="showUserModal" :user-id="editUserId" @close="showUserModal = false" @saved="showUserModal = false; editUserId = null" />
</template>
