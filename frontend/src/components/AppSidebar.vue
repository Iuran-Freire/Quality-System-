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
  { page: "forms", label: "Formulários" },
  { page: "inspect", label: "Inspeção" },
  { page: "analytics", label: "Análises" },
  { page: "management", label: "Administração" },
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
      <img src="/quality-brand.svg" alt="Quality System" />
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
        <svg
          class="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <template v-if="item.page === 'forms'">
            <path d="M7 3h8l4 4v14H7z" />
            <path d="M15 3v5h4M10 12h6M10 16h6" />
          </template>
          <template v-else-if="item.page === 'inspect'">
            <path d="M9 5h6M9 3h6v4H9z" />
            <path d="M7 5H5v16h14V5h-2M8.5 14l2 2 5-5" />
          </template>
          <template v-else-if="item.page === 'analytics'">
            <path d="M4 20V5M4 20h16" />
            <path d="m7 16 4-5 3 3 5-7" />
          </template>
          <template v-else>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19c.6-3 2.4-4.5 5.5-4.5s4.9 1.5 5.5 4.5M16 8h5M18.5 5.5v5M16 15h5" />
          </template>
        </svg>
        <span class="mi-label">{{ item.label }}</span>
      </button>
    </nav>
  </aside>
</template>
