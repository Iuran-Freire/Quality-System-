<script setup>
import { nextTick, ref, watch } from "vue";
import {
  dismissNotification,
  feedbackState,
  settleFeedbackDialog,
} from "../services/systemFeedback";

const promptValue = ref("");
const promptInput = ref(null);

watch(
  () => feedbackState.dialog,
  async (dialog) => {
    promptValue.value = dialog?.value || "";
    if (dialog?.kind === "prompt") {
      await nextTick();
      promptInput.value?.focus();
    }
  }
);

function confirmDialog() {
  const value = feedbackState.dialog?.kind === "prompt" ? promptValue.value : true;
  settleFeedbackDialog(value);
}
</script>

<template>
  <Teleport to="body">
    <div class="system-toast-stack" aria-live="polite">
      <div v-for="toast in feedbackState.toasts" :key="toast.id" class="system-toast" :class="`system-toast-${toast.type}`">
        <span class="system-toast-mark" aria-hidden="true"></span>
        <div><strong v-if="toast.title">{{ toast.title }}</strong><p>{{ toast.message }}</p></div>
        <button type="button" aria-label="Fechar notificação" @click="dismissNotification(toast.id)">×</button>
      </div>
    </div>

    <div v-if="feedbackState.dialog" class="system-dialog-backdrop" @click.self="settleFeedbackDialog(null)">
      <section class="system-dialog" role="dialog" aria-modal="true" :aria-label="feedbackState.dialog.title">
        <header><div class="system-dialog-symbol" :class="{ danger: feedbackState.dialog.danger }">!</div><div><h3>{{ feedbackState.dialog.title }}</h3><span>Quality System</span></div></header>
        <p class="system-dialog-message">{{ feedbackState.dialog.message }}</p>
        <textarea v-if="feedbackState.dialog.kind === 'prompt'" ref="promptInput" v-model="promptValue" rows="4" :placeholder="feedbackState.dialog.placeholder" @keydown.ctrl.enter="confirmDialog"></textarea>
        <footer>
          <button class="btn ghost" type="button" @click="settleFeedbackDialog(null)">Cancelar</button>
          <button class="btn" :class="{ 'system-dialog-danger': feedbackState.dialog.danger }" type="button" @click="confirmDialog">{{ feedbackState.dialog.confirmLabel }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
