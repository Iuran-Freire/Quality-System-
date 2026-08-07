import { reactive } from "vue";

let toastId = 0;
let pendingDialog = null;

export const feedbackState = reactive({
  toasts: [],
  dialog: null,
});

function inferType(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("sucesso") || text.includes("salv") || text.includes("criad")) return "success";
  if (text.includes("não foi possível") || text.includes("erro") || text.includes("inválid")) return "error";
  if (text.includes("atenção") || text.includes("informe") || text.includes("preencha")) return "warning";
  return "info";
}

export function notify(message, options = {}) {
  const text = String(message || "").trim();
  if (!text) return;
  const item = {
    id: ++toastId,
    message: text,
    type: options.type || inferType(text),
    title: options.title || "",
  };
  feedbackState.toasts.push(item);
  window.setTimeout(() => dismissNotification(item.id), options.duration || 4200);
}

export function dismissNotification(id) {
  const index = feedbackState.toasts.findIndex((item) => item.id === id);
  if (index >= 0) feedbackState.toasts.splice(index, 1);
}

function openDialog(config) {
  if (pendingDialog) pendingDialog(null);
  return new Promise((resolve) => {
    pendingDialog = resolve;
    feedbackState.dialog = config;
  });
}

export function requestConfirmation(message, options = {}) {
  return openDialog({
    kind: "confirm",
    title: options.title || "Confirmar ação",
    message: String(message || ""),
    confirmLabel: options.confirmLabel || "Confirmar",
    danger: Boolean(options.danger),
  });
}

export function requestPrompt(message, options = {}) {
  return openDialog({
    kind: "prompt",
    title: options.title || "Informação necessária",
    message: String(message || ""),
    value: options.value || "",
    placeholder: options.placeholder || "Digite aqui...",
    confirmLabel: options.confirmLabel || "Continuar",
  });
}

export function settleFeedbackDialog(value) {
  const resolve = pendingDialog;
  pendingDialog = null;
  feedbackState.dialog = null;
  if (resolve) resolve(value);
}

export function installSystemFeedback() {
  window.alert = (message) => notify(message);
}
