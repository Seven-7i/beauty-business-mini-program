<script setup lang="ts">
import { onMounted } from "vue";
import type { BeautyProjectV1 } from "@/domain/data-schema";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type { BeautyProjectManagementService } from "@/services/beauty-project-management-service";
import { openBeautyProjectDetail, openBeautyProjectEditor } from "../beauty-project-navigation";
import { useBeautyProjectManagement } from "../composables/useBeautyProjectManagement";
import BeautyProjectList from "./BeautyProjectList.vue";

/** 服务项目列表容器的业务用例输入。 */
interface BeautyProjectManagementProps {
  /** 页面可调用的服务项目管理窄用例。 */
  service: BeautyProjectManagementService;
}

/** 服务项目列表路由在重新显示时可调用的最小刷新契约。 */
interface BeautyProjectManagementExpose {
  /** 重新读取服务项目与默认用量引用的库存资料。 */
  refresh(): Promise<boolean>;
}

const props = defineProps<BeautyProjectManagementProps>();
const {
  projectsByStatusAndName,
  inventoryItems,
  loading,
  hasLoaded,
  errorMessage,
  errorKind,
  refresh,
} = useBeautyProjectManagement(props.service);

/** 从列表进入独立新增服务项目页面。 */
function openCreateProject(): void {
  openBeautyProjectEditor();
}

/** 从项目卡片进入该项目的独立详情页。 */
function openProjectDetail(project: BeautyProjectV1): void {
  openBeautyProjectDetail(project.id);
}

onMounted(refresh);

const exposed: BeautyProjectManagementExpose = { refresh };
defineExpose(exposed);
</script>

<template>
  <main class="project-management">
    <view
      class="project-management__glow project-management__glow--rose"
      aria-hidden="true"
    />
    <view
      class="project-management__glow project-management__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage"
      class="project-management__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />

    <view
      v-if="loading || (!hasLoaded && !errorMessage)"
      class="project-management__loading"
      role="status"
    >
      正在读取本机项目资料
    </view>
    <view v-show="hasLoaded && !loading" class="project-management__list-view">
      <BeautyProjectList
        :projects="projectsByStatusAndName"
        :inventory-items="inventoryItems"
        :disabled="loading"
        @add="openCreateProject"
        @view="openProjectDetail"
      />
    </view>
  </main>
</template>

<style scoped>
.project-management { position: relative; min-height: 100vh; box-sizing: border-box; overflow: hidden; padding: 34rpx 30rpx calc(56rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 52%, #f8f4f7 100%); }
.project-management__glow { position: absolute; z-index: 0; border-radius: 999rpx; pointer-events: none; }
.project-management__glow--rose { top: -120rpx; right: -170rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, rgba(244, 205, 220, 0.5) 0%, rgba(244, 205, 220, 0) 70%); }
.project-management__glow--lavender { top: 30rpx; right: -130rpx; width: 420rpx; height: 320rpx; background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%); }
.project-management__notice, .project-management__loading, .project-management__list-view { position: relative; z-index: 2; }
.project-management__loading { padding: 28rpx 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 20rpx; background: rgba(255, 255, 255, 0.9); color: #766e74; font-size: 23rpx; text-align: center; }

@media (max-width: 360px) {
  .project-management { padding-right: 24rpx; padding-left: 24rpx; }
}
</style>
