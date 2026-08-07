<script setup>
import { ref } from "vue";

defineProps({
  currentPage: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["select", "expanded"]);
const expanded = ref(false);

function setExpanded(value) {
  expanded.value = value;
  emit("expanded", value);
}

const items = [
  { page: "forms", icon: "🧾", label: "Formulários" },
  { page: "inspect", icon: "🧪", label: "Inspeção" },
  { page: "analytics", icon: "📈", label: "Análises" },
  { page: "management", icon: "⚙️", label: "Administração" },
];
</script>

<template>
  <aside
    class="side"
    :class="{ 'side-hover-open': expanded }"
    @mouseenter="setExpanded(true)"
    @mouseleave="setExpanded(false)"
  >
    <div class="brand">
      <img src="/logo.png" alt="Inventus Power" />
    </div>

    <nav class="menu" aria-label="Navegação principal">
      <button
        v-for="item in items"
        :key="item.page"
        class="mi"
        :class="{ active: currentPage === item.page }"
        type="button"
        @click="emit('select', item.page)"
      >
        <span aria-hidden="true">{{ item.icon }}</span>
        <span class="mi-label">{{ item.label }}</span>
      </button>
    </nav>
  </aside>
</template>
