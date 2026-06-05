<script setup>
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();

const username = ref("");
const password = ref("");
const error = ref("");

function submitLogin() {
  error.value = "";

  try {
    auth.login(username.value, password.value);
  } catch (err) {
    error.value = err.message || "Erro ao fazer login.";
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <img src="/logo.png" alt="Inventus Power" />
      </div>

      <h2>Quality System</h2>
      <p class="login-subtitle">Acesse para continuar</p>

      <label class="float-label">
        <input v-model="username" placeholder=" " @keyup.enter="submitLogin" />
        <span>Usuário</span>
      </label>

      <label class="float-label">
        <input
          v-model="password"
          type="password"
          placeholder=" "
          @keyup.enter="submitLogin"
        />
        <span>Senha</span>
      </label>

      <div v-if="error" class="login-error">
        {{ error }}
      </div>

      <button class="btn login-btn" type="button" @click="submitLogin">Entrar</button>

      <div class="login-hint">Teste: <b>iuran</b> / <b>1234</b></div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #f3f4f6;
}

.login-card {
  width: 100%;
  max-width: 390px;
  background: #fff;
  border-radius: 18px;
  padding: 28px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-logo {
  display: flex;
  justify-content: center;
  margin-bottom: 4px;
}

.login-logo img {
  max-width: 180px;
  max-height: 70px;
  object-fit: contain;
}

.login-card h2 {
  text-align: center;
  margin: 4px 0 0;
  font-size: 22px;
}

.login-subtitle {
  text-align: center;
  margin: 0 0 8px;
  color: var(--muted, #64748b);
  font-size: 14px;
}

.login-btn {
  width: 100%;
  height: 42px;
  margin-top: 4px;
}

.login-error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 9px 11px;
  font-size: 13px;
}

.login-hint {
  text-align: center;
  color: var(--muted, #64748b);
  font-size: 12.5px;
}
</style>
