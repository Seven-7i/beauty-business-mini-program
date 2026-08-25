<script setup lang="ts">
import { onMounted, ref, shallowRef, type DeepReadonly } from "vue";
import type { BeautyProjectV1 } from "@/domain/data-schema";
import type {
  BeautyProjectManagementService,
  CreateBeautyProjectInput,
} from "@/services/beauty-project-management-service";
import BeautyProjectForm from "./BeautyProjectForm.vue";
import BeautyProjectList from "./BeautyProjectList.vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import { useBeautyProjectManagement } from "../composables/useBeautyProjectManagement";

const props = defineProps<{
  service: BeautyProjectManagementService;
}>();

const emit = defineEmits<{
  (event: "open-inventory"): void;
}>();

const {
  projects,
  inventoryItems,
  activeInventoryItems,
  loading,
  submitting,
  errorMessage,
  errorKind,
  refresh,
  createProject,
  updateProject,
  setProjectStatus,
  deleteProject,
} = useBeautyProjectManagement(props.service);
const projectForm = ref<InstanceType<typeof BeautyProjectForm> | null>(null);
const selectedProject = shallowRef<DeepReadonly<BeautyProjectV1>>();

async function handleSubmit(input: CreateBeautyProjectInput): Promise<void> {
  const saved = selectedProject.value
    ? await updateProject({ projectId: selectedProject.value.id, ...input })
    : await createProject(input);
  if (saved) {
    selectedProject.value = undefined;
    projectForm.value?.reset();
    uni.showToast({ title: "服务项目已保存", icon: "success" });
  }
}

function cancelEdit(): void {
  selectedProject.value = undefined;
  projectForm.value?.reset();
}

function editProject(project: DeepReadonly<BeautyProjectV1>): void {
  selectedProject.value = project;
  uni.pageScrollTo({ scrollTop: 0, duration: 250 });
}

async function changeProjectStatus(
  project: DeepReadonly<BeautyProjectV1>,
): Promise<void> {
  if (project.status === "inactive") {
    if (await setProjectStatus(project.id, "active")) {
      uni.showToast({ title: "项目已重新启用", icon: "success" });
    }
    return;
  }
  uni.showModal({
    title: `停用“${project.name}”？`,
    content: "停用后历史预约仍会保留，但创建新预约时不再提供该项目。",
    confirmText: "确认停用",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void setProjectStatus(project.id, "inactive").then((saved) => {
          if (saved) {
            selectedProject.value = undefined;
            projectForm.value?.reset();
            uni.showToast({ title: "项目已停用", icon: "none" });
          }
        });
      }
    },
  });
}

function confirmDeleteProject(project: DeepReadonly<BeautyProjectV1>): void {
  uni.showModal({
    title: `彻底删除“${project.name}”？`,
    content: "仅从未进入预约的项目可以删除，删除后无法恢复。",
    confirmText: "彻底删除",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void deleteProject(project.id).then((deleted) => {
          if (deleted) {
            selectedProject.value = undefined;
            projectForm.value?.reset();
            uni.showToast({ title: "项目已删除", icon: "none" });
          }
        });
      }
    },
  });
}

onMounted(refresh);

/** 刷新物品后把快速新增结果交给仍然存活的项目草稿表单。 */
async function refreshAndSelectInventoryItem(
  inventoryItemId: string,
): Promise<boolean> {
  if (!(await refresh())) {
    return false;
  }
  return projectForm.value?.selectInventoryItemById(inventoryItemId) ?? false;
}

defineExpose({ refresh, refreshAndSelectInventoryItem });
</script>

<template>
  <view class="project-management">
    <view class="project-management__intro">
      <text class="project-management__eyebrow">美容 · 预约基础</text>
      <text class="project-management__title">服务项目</text>
      <text class="project-management__description">
        标准价格和默认用量用于创建预约，实际用量仍可在预约中调整。
      </text>
    </view>
    <BeautyProjectForm
      ref="projectForm"
      :inventory-items="activeInventoryItems"
      :submitting="submitting"
      :editing-project="selectedProject"
      @submit="handleSubmit"
      @cancel-edit="cancelEdit"
      @quick-add-inventory="emit('open-inventory')"
    />
    <RecoverableErrorNotice
      v-if="errorMessage"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />
    <view v-if="loading" class="project-management__loading">正在读取本机项目资料</view>
    <BeautyProjectList
      v-else
      :projects="projects"
      :inventory-items="inventoryItems"
      :disabled="submitting"
      @edit="editProject"
      @toggle-status="changeProjectStatus"
      @delete="confirmDeleteProject"
    />
  </view>
</template>

<style scoped>
.project-management {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 36rpx 28rpx calc(50rpx + env(safe-area-inset-bottom));
}

.project-management__intro {
  display: flex;
  padding: 0 6rpx 28rpx;
  flex-direction: column;
}

.project-management__eyebrow {
  color: #31549e;
  font-size: 22rpx;
  font-weight: 600;
}

.project-management__title {
  margin-top: 12rpx;
  color: #1a2538;
  font-size: 42rpx;
  font-weight: 700;
}

.project-management__description {
  margin-top: 12rpx;
  color: #707b8f;
  font-size: 23rpx;
  line-height: 1.6;
}

.project-management__loading {
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  font-size: 23rpx;
}

.project-management__loading {
  background: #eef2f8;
  color: #68748a;
  text-align: center;
}
</style>
