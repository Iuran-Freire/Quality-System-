<script setup>
import { ref, watch } from "vue";
import { useUsersStore } from "../stores/users";

const props = defineProps({
  show: Boolean,
  userId: { type: [String, Number], default: null },
});
const emit = defineEmits(["close", "saved"]);
const users = useUsersStore();

const emptyForm = () => ({
  name: "", username: "", password: "", matricula: "", cargo: "",
  role: "inspetor", accessLevel: 3, inspectionArea: "IQC", active: true,
});
const form = ref(emptyForm());

watch(
  () => [props.show, props.userId],
  ([show, userId]) => {
    if (!show) return;
    const user = users.items.find((item) => String(item.id) === String(userId));
    form.value = user ? {
      name: user.name || "", username: user.username || "", password: "",
      matricula: user.matricula || "", cargo: user.cargo || "",
      role: user.role || "inspetor", accessLevel: Number(user.accessLevel || 3),
      inspectionArea: user.inspectionArea || "IQC", active: Boolean(user.active),
    } : emptyForm();
  },
  { immediate: true }
);

function syncRole() {
  const level = Number(form.value.accessLevel || 3);
  form.value.role = level === 1 ? "admin" : level === 2 ? "lider" : "inspetor";
}

async function save() {
  if (!String(form.value.name || "").trim()) return alert("Preencha o nome.");
  if (!String(form.value.username || "").trim()) return alert("Preencha o usuário/login.");
  if (!props.userId && !String(form.value.password || "").trim()) return alert("Preencha a senha.");
  if (!String(form.value.matricula || "").trim()) return alert("Preencha a matrícula.");
  if (!String(form.value.cargo || "").trim()) return alert("Preencha o cargo.");

  const inspectionArea = String(form.value.inspectionArea || "").trim().toUpperCase();
  if (!["IQC", "OQC", "ALL"].includes(inspectionArea)) {
    return alert("Selecione a área do usuário: IQC, OQC ou Ambos.");
  }

  syncRole();
  const payload = {
    ...form.value,
    username: String(form.value.username).trim().toLowerCase(),
    accessLevel: Number(form.value.accessLevel || 3),
    inspectionArea,
  };

  try {
    if (props.userId) {
      await users.update(props.userId, payload);
      alert("Usuário atualizado com sucesso.");
    } else {
      await users.create(payload);
      alert("Usuário criado com sucesso.");
    }
    await users.load();
    emit("saved");
  } catch (error) {
    console.error("Erro ao salvar usuário:", error);
    alert(error?.message || "Não foi possível salvar o usuário.");
  }
}
</script>

<template>
  <Teleport to="body">
  <div class="modal" :class="{ show }" @click.self="emit('close')">
    <div class="sheet vstack user-sheet">
      <div class="hstack" style="justify-content:space-between;align-items:center">
        <h3>{{ userId ? "Editar Cadastro de Usuário" : "Cadastrar Novo Usuário" }}</h3>
        <button class="btn ghost" type="button" @click="emit('close')">Fechar</button>
      </div>
      <div class="hr"></div>
      <h4 class="modal-section-title">Identificação e Permissões de Acesso</h4>
      <div class="row">
        <div class="span-3"><label class="float-label"><input v-model="form.name" placeholder=" " /><span>Nome completo *</span></label></div>
        <div class="span-3"><label class="float-label"><input v-model="form.username" placeholder=" " /><span>Identificação de acesso *</span></label></div>
        <div class="span-3"><label class="float-label"><input v-model="form.password" type="password" placeholder=" " /><span>{{ userId ? "Nova senha (opcional)" : "Senha *" }}</span></label></div>
        <div class="span-3"><label class="float-label"><input v-model="form.matricula" placeholder=" " /><span>Matrícula *</span></label></div>
        <div class="span-3"><label class="float-label"><input v-model="form.cargo" placeholder=" " /><span>Função / Cargo *</span></label></div>
        <div class="span-2"><label class="float-label"><select v-model.number="form.accessLevel" @change="syncRole"><option :value="1">Nível 1 — Administração total</option><option :value="2">Nível 2 — Gestão e aprovação</option><option :value="3">Nível 3 — Operação de inspeção</option></select><span>Nível de acesso *</span></label></div>
        <div class="span-2"><label class="float-label"><select v-model="form.inspectionArea"><option value="IQC">IQC</option><option value="OQC">OQC</option><option value="ALL">Ambos (IQC + OQC)</option></select><span>Área de inspeção *</span></label></div>
        <div class="span-2"><label class="float-label"><select v-model="form.active"><option :value="true">Ativo</option><option :value="false">Inativo</option></select><span>Situação do acesso</span></label></div>
      </div>
      <div class="hr"></div>
      <div class="hstack" style="justify-content:flex-end;gap:8px">
        <button class="btn ghost" type="button" @click="emit('close')">Cancelar</button>
        <button class="btn" type="button" @click="save">{{ userId ? "Salvar alterações" : "Cadastrar usuário" }}</button>
      </div>
    </div>
  </div>
  </Teleport>
</template>
