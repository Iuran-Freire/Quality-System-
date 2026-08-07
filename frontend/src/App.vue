<script setup>
import { ref, computed } from "vue";
import { useUiStore } from "./stores/ui";
import InspectPage from "./components/InspectPage.vue";
import { useAuthStore } from "./stores/auth";
import LoginPage from "./components/LoginPage.vue";
import AnalyticsPage from "./components/AnalyticsPage.vue";
import AppSidebar from "./components/AppSidebar.vue";
import AppHeader from "./components/AppHeader.vue";
import FormsPage from "./components/FormsPage.vue";
import ManagementPage from "./components/ManagementPage.vue";
import SystemFeedback from "./components/SystemFeedback.vue";

const ui = useUiStore();
const auth = useAuthStore();
const sideOpen = ref(false);

const isForms = computed(() => ui.page === "forms");
const isInspect = computed(() => ui.page === "inspect");
const isAnalytics = computed(() => ui.page === "analytics");

const isManagement = computed(() => ui.page === "management");

</script>

<template>
  <SystemFeedback />
  <LoginPage v-if="!auth.isLogged" />

  <div v-else class="layout" :class="{ 'layout-side-open': sideOpen }">
    <AppSidebar
      :current-page="ui.page"
      @select="ui.setPage"
      @expanded="sideOpen = $event"
    />

    <!-- CONTEÚDO -->
    <div>
      <AppHeader />

      <!-- MAIN -->
      <main>
        <!-- ================= FORMULÁRIOS ================= -->
        <FormsPage v-if="isForms" />

        <!-- ================= INSPEÇÃO ================= -->

        <div v-else-if="isInspect">
          <InspectPage />
        </div>

        <!-- ================= ANÁLISES ================= -->

        <div v-else-if="isAnalytics">
          <AnalyticsPage />
        </div>

        <!-- ================= GERENCIAMENTO ================= -->

        <ManagementPage v-else-if="isManagement" />
      </main>
    </div>
  </div>

</template>
