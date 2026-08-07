<script setup>
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();

const username = ref("");
const password = ref("");
const error = ref("");

async function submitLogin() {
  error.value = "";

  try {
    await auth.login(username.value, password.value);
  } catch (err) {
    error.value = err.message || "Erro ao fazer login.";
  }
}

function clearMessage() {
  error.value = "";
  auth.sessionMessage = "";
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <img src="/logo.png" alt="Inventus Power" />
      </div>

      <h2>Sistema de Gestão da Qualidade</h2>
      <p class="login-subtitle">Autenticação de acesso ao sistema</p>

      <label class="float-label">
        <input v-model="username" placeholder=" " @input="clearMessage" @keyup.enter="submitLogin" />
        <span>Identificação do usuário</span>
      </label>

      <label class="float-label">
        <input
          v-model="password"
          type="password"
          placeholder=" "
          @input="clearMessage"
          @keyup.enter="submitLogin"
        />
        <span>Senha</span>
      </label>

      <div v-if="error || auth.sessionMessage" class="login-error">
        {{ error || auth.sessionMessage }}
      </div>

      <button class="btn login-btn" type="button" @click="submitLogin">Entrar</button>
    </div>
  </div>
</template>
