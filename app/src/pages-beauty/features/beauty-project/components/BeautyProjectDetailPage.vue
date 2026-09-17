<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted } from "vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type { BeautyProjectManagementService } from "@/services/beauty-project-management-service";
import { notifyBeautyProjectChanged } from "../beauty-project-navigation";
import { createBeautyProjectFormCompletionGuard } from "../composables/useBeautyProjectFormLifecycle";
import { useBeautyProjectManagement } from "../composables/useBeautyProjectManagement";
import BeautyProjectDetail from "./BeautyProjectDetail.vue";

/** 独立服务项目详情页的业务输入。 */
interface BeautyProjectDetailPageProps {
  /** 路由参数提供的稳定项目标识。 */
  projectId: string;
  /** 页面可调用的服务项目管理窄用例。 */
  service: BeautyProjectManagementService;
}

/** 独立服务项目详情页向路由组合层暴露的结果。 */
interface BeautyProjectDetailPageEmits {
  /** 请求进入统一项目编辑表单。 */
  edit: [];
  /** 缺失项目时请求返回服务项目列表。 */
  back: [];
  /** 项目已被彻底删除，路由应返回列表。 */
  deleted: [];
}

/** 详情路由重新显示时可调用的最小刷新契约。 */
interface BeautyProjectDetailPageExpose {
  /** 重新读取当前项目与默认用量引用。 */
  refresh(): Promise<boolean>;
}

const props = defineProps<BeautyProjectDetailPageProps>();
const emit = defineEmits<BeautyProjectDetailPageEmits>();
const {
  projects,
  inventoryItems,
  loading,
  hasLoaded,
  submitting,
  errorMessage,
  errorKind,
  refresh,
  setProjectStatus,
  deleteProject,
} = useBeautyProjectManagement(props.service);
const project = computed(() =>
  projects.value.find((candidate) => candidate.id === props.projectId),
);
const completionGuard = createBeautyProjectFormCompletionGuard();

/** 业务操作失败时将视口带到页面级错误说明。 */
async function scrollToErrorNotice(): Promise<void> {
  await nextTick();
  uni.pageScrollTo({
    selector: ".project-detail-page__notice",
    duration: 180,
  });
}

/** 按引用规则确认停用，或直接尝试重新启用当前项目。 */
async function toggleStatus(): Promise<void> {
  const current = project.value;
  if (!current || submitting.value) {
    return;
  }
  if (current.status === "inactive") {
    if (await setProjectStatus(current.id, "active")) {
      notifyBeautyProjectChanged({ projectId: current.id, kind: "status" });
      if (!completionGuard.isActive()) {
        return;
      }
      uni.showToast({ title: "项目已重新启用", icon: "success" });
    } else if (completionGuard.isActive()) {
      await scrollToErrorNotice();
    }
    return;
  }
  uni.showModal({
    title: `停用“${current.name}”？`,
    content: "停用后历史预约仍会保留，但创建新预约时不再提供该项目。",
    confirmText: "确认停用",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void setProjectStatus(current.id, "inactive").then((saved) => {
          if (saved) {
            notifyBeautyProjectChanged({
              projectId: current.id,
              kind: "status",
            });
          }
          if (!completionGuard.isActive()) {
            return;
          }
          if (saved) {
            uni.showToast({ title: "项目已停用", icon: "none" });
          } else {
            void scrollToErrorNotice();
          }
        });
      }
    },
    fail() {
      uni.showToast({ title: "确认框打开失败", icon: "none" });
    },
  });
}

/** 二次确认后按预约引用规则尝试彻底删除当前项目。 */
function confirmDeleteProject(): void {
  const current = project.value;
  if (!current || submitting.value) {
    return;
  }
  uni.showModal({
    title: `彻底删除“${current.name}”？`,
    content: "仅从未进入预约的项目可以删除，删除后无法恢复。",
    confirmText: "彻底删除",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void deleteProject(current.id).then((deleted) => {
          if (deleted) {
            notifyBeautyProjectChanged({
              projectId: current.id,
              kind: "deleted",
            });
          }
          if (!completionGuard.isActive()) {
            return;
          }
          if (deleted) {
            emit("deleted");
          } else {
            void scrollToErrorNotice();
          }
        });
      }
    },
    fail() {
      uni.showToast({ title: "确认框打开失败", icon: "none" });
    },
  });
}

onMounted(refresh);
onBeforeUnmount(completionGuard.deactivate);

const exposed: BeautyProjectDetailPageExpose = { refresh };
defineExpose(exposed);
</script>

<template>
  <main class="project-detail-page">
    <view
      class="project-detail-page__glow project-detail-page__glow--rose"
      aria-hidden="true"
    />
    <view
      class="project-detail-page__glow project-detail-page__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage"
      class="project-detail-page__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />
    <view
      v-if="!hasLoaded && (loading || !errorMessage)"
      class="project-detail-page__state"
      role="status"
    >
      正在读取项目详情
    </view>
    <view
      v-else-if="hasLoaded && !project"
      class="project-detail-page__state project-detail-page__state--error"
      role="alert"
    >
      <text>服务项目不存在，可能已被删除。</text>
      <button @click="emit('back')">返回服务项目列表</button>
    </view>
    <BeautyProjectDetail
      v-else-if="project"
      :project="project"
      :inventory-items="inventoryItems"
      :disabled="submitting"
      @edit="emit('edit')"
      @toggle-status="toggleStatus"
      @delete-project="confirmDeleteProject"
    />
  </main>
</template>

<style scoped>
.project-detail-page { position: relative; min-height: 100vh; box-sizing: border-box; overflow: hidden; padding: 30rpx 30rpx calc(52rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 54%, #f8f4f7 100%); }
.project-detail-page__glow { position: absolute; z-index: 0; border-radius: 999rpx; pointer-events: none; }
.project-detail-page__glow--rose { top: -130rpx; right: -180rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, rgba(244, 205, 220, 0.48) 0%, rgba(244, 205, 220, 0) 70%); }
.project-detail-page__glow--lavender { top: 20rpx; right: -140rpx; width: 420rpx; height: 330rpx; background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%); }
.project-detail-page__notice, .project-detail-page__state { position: relative; z-index: 2; }
.project-detail-page__notice { margin-bottom: 20rpx; }
.project-detail-page__state { padding: 30rpx 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 20rpx; background: rgba(255, 255, 255, 0.92); color: #766e74; font-size: 23rpx; line-height: 1.55; text-align: center; }
.project-detail-page__state--error { display: flex; flex-direction: column; align-items: center; gap: 22rpx; border-color: #ead6d8; background: rgba(255, 248, 248, 0.94); color: #934c54; }
.project-detail-page__state button { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 24rpx; line-height: 1.3; }

@media (max-width: 360px) {
  .project-detail-page { padding-right: 24rpx; padding-left: 24rpx; }
}
</style>
