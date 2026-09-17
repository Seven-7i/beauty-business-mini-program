<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef } from "vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type {
  BeautyProjectManagementService,
  CreateBeautyProjectInput,
} from "@/services/beauty-project-management-service";
import { useBeautyProjectFormLifecycle } from "../composables/useBeautyProjectFormLifecycle";
import { useBeautyProjectManagement } from "../composables/useBeautyProjectManagement";
import { notifyBeautyProjectChanged } from "../beauty-project-navigation";
import BeautyProjectForm from "./BeautyProjectForm.vue";

/** 独立服务项目新增/编辑页的业务输入。 */
interface BeautyProjectEditorProps {
  /** 页面可调用的服务项目管理窄用例。 */
  service: BeautyProjectManagementService;
  /** 编辑模式的稳定项目标识；空字符串表示新增模式。 */
  projectId?: string;
}

/** 独立服务项目表单向路由组合层暴露的结果。 */
interface BeautyProjectEditorEmits {
  /** 保存成功后交由路由决定返回列表或详情。 */
  saved: [projectId: string, editing: boolean];
  /** 编辑目标已不存在时请求返回服务项目列表。 */
  missing: [];
  /** 打开独立库存新增页并保留当前项目草稿。 */
  quickAddInventory: [];
}

/** 路由在重新显示或快速新增库存返回时可调用的最小契约。 */
interface BeautyProjectEditorExpose {
  /** 重新读取项目和库存资料。 */
  refresh(): Promise<boolean>;
  /** 刷新库存后预选快速新增的物品。 */
  refreshAndSelectInventoryItem(inventoryItemId: string): Promise<boolean>;
}

const props = withDefaults(defineProps<BeautyProjectEditorProps>(), {
  projectId: "",
});
const emit = defineEmits<BeautyProjectEditorEmits>();
const {
  projects,
  inventoryItems,
  loading,
  hasLoaded,
  submitting,
  errorMessage,
  errorKind,
  refresh,
  createProject,
  updateProject,
} = useBeautyProjectManagement(props.service);
const {
  updateDirty,
  resetDirty,
  updateSaving,
  completionGuard,
} = useBeautyProjectFormLifecycle();
const projectForm =
  shallowRef<InstanceType<typeof BeautyProjectForm> | null>(null);
const project = computed(() =>
  projects.value.find((candidate) => candidate.id === props.projectId),
);
const missingProject = computed(
  () => Boolean(props.projectId) && hasLoaded.value && !project.value,
);

/** 保存失败时将页面级错误说明带入当前视口。 */
async function scrollToErrorNotice(): Promise<void> {
  await nextTick();
  uni.pageScrollTo({
    selector: ".project-editor-page__notice",
    duration: 180,
  });
}

/** 创建或更新项目，成功后把稳定标识与当前模式交给路由。 */
async function handleSubmit(input: CreateBeautyProjectInput): Promise<void> {
  if (submitting.value) {
    return;
  }
  updateSaving(true);
  const editing = Boolean(props.projectId);
  const savedProjectId = editing
    ? (await updateProject({ projectId: props.projectId, ...input }))
      ? props.projectId
      : ""
    : (await createProject(input))?.id ?? "";
  if (savedProjectId) {
    notifyBeautyProjectChanged({ projectId: savedProjectId, kind: "saved" });
  }
  if (!completionGuard.isActive()) {
    return;
  }
  if (savedProjectId) {
    resetDirty();
    emit("saved", savedProjectId, editing);
    return;
  }
  updateSaving(false);
  const positionedFieldError =
    (await projectForm.value?.scrollToFirstError()) ?? false;
  if (!positionedFieldError) {
    await scrollToErrorNotice();
  }
}

/**
 * 刷新物品后把快速新增结果交给仍然存活的项目草稿表单。
 * 只预选物品，不更改用户已经填写的数量与其他项目资料。
 */
async function refreshAndSelectInventoryItem(
  inventoryItemId: string,
): Promise<boolean> {
  if (!(await refresh()) || !completionGuard.isActive()) {
    return false;
  }
  return projectForm.value?.selectInventoryItemById(inventoryItemId) ?? false;
}

onMounted(refresh);

const exposed: BeautyProjectEditorExpose = {
  refresh,
  refreshAndSelectInventoryItem,
};
defineExpose(exposed);
</script>

<template>
  <main class="project-editor-page">
    <view
      class="project-editor-page__glow project-editor-page__glow--rose"
      aria-hidden="true"
    />
    <view
      class="project-editor-page__glow project-editor-page__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage"
      class="project-editor-page__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />
    <view
      v-if="!hasLoaded && (loading || !errorMessage)"
      class="project-editor-page__state"
      role="status"
    >
      正在读取服务项目资料
    </view>
    <view
      v-else-if="missingProject"
      class="project-editor-page__state project-editor-page__state--error"
      role="alert"
    >
      <text>服务项目不存在，可能已被删除。</text>
      <button @click="emit('missing')">返回服务项目列表</button>
    </view>
    <BeautyProjectForm
      v-else-if="hasLoaded"
      ref="projectForm"
      :inventory-items="inventoryItems"
      :submitting="submitting"
      :editing-project="project"
      :error-message="errorKind === 'operation' ? errorMessage : ''"
      @dirty-change="updateDirty"
      @quick-add-inventory="emit('quickAddInventory')"
      @submit="handleSubmit"
    />
  </main>
</template>

<style scoped>
.project-editor-page { position: relative; min-height: 100vh; box-sizing: border-box; overflow: hidden; padding: 30rpx 30rpx calc(52rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 54%, #f8f4f7 100%); }
.project-editor-page__glow { position: absolute; z-index: 0; border-radius: 999rpx; pointer-events: none; }
.project-editor-page__glow--rose { top: -130rpx; right: -180rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, rgba(244, 205, 220, 0.48) 0%, rgba(244, 205, 220, 0) 70%); }
.project-editor-page__glow--lavender { top: 20rpx; right: -140rpx; width: 420rpx; height: 330rpx; background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%); }
.project-editor-page__notice, .project-editor-page__state { position: relative; z-index: 2; }
.project-editor-page__notice { margin-bottom: 20rpx; }
.project-editor-page__state { padding: 30rpx 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 20rpx; background: rgba(255, 255, 255, 0.92); color: #766e74; font-size: 23rpx; line-height: 1.55; text-align: center; }
.project-editor-page__state--error { display: flex; flex-direction: column; align-items: center; gap: 22rpx; border-color: #ead6d8; background: rgba(255, 248, 248, 0.94); color: #934c54; }
.project-editor-page__state button { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 24rpx; line-height: 1.3; }

@media (max-width: 360px) {
  .project-editor-page { padding-right: 24rpx; padding-left: 24rpx; }
}
</style>
