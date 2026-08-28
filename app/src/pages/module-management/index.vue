<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import ModuleManagement from "@/features/my-center/components/ModuleManagement.vue";
import { useModuleManagement } from "@/features/my-center/composables/useModuleManagement";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createModuleAuthorizationRepository } from "@/repositories/module-authorization-repository";

const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const moduleAuthorization = createModuleAuthorizationRepository(storage);
const {
  unlockedModules,
  loading,
  hasLoaded,
  readError,
  moduleCode,
  moduleError,
  submitting,
  refresh,
  unlockAdditionalModule,
} = useModuleManagement({ moduleAuthorization });

async function submitModuleCode(): Promise<void> {
  const unlocked = await unlockAdditionalModule();
  if (unlocked) {
    uni.showToast({ title: "模块已开启", icon: "success" });
  }
}

onShow(refresh);
</script>

<template>
  <view class="module-management-page">
    <ModuleManagement
      v-model="moduleCode"
      :unlocked-modules="unlockedModules"
      :loading="loading"
      :has-loaded="hasLoaded"
      :read-error="readError"
      :submitting="submitting"
      :error-message="moduleError"
      @retry="refresh"
      @submit="submitModuleCode"
    />
  </view>
</template>

<style scoped>
.module-management-page {
  min-height: 100vh;
  background: #f3f1ec;
}
</style>
