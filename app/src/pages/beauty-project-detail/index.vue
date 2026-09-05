<script setup lang="ts">
import { shallowRef } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import {
  completeBeautyProjectDeletion,
  openBeautyProjectEditor,
  readBeautyProjectId,
  returnToBeautyProjectList,
  subscribeBeautyProjectChanged,
  type BeautyProjectChangedPayload,
} from "@/features/beauty-project/beauty-project-navigation";
import BeautyProjectDetailPage from "@/features/beauty-project/components/BeautyProjectDetailPage.vue";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createBeautyProjectManagementService } from "@/services/beauty-project-management-service";

const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createBeautyProjectManagementService({ repository });
const projectId = shallowRef("");
const detailPage =
  shallowRef<InstanceType<typeof BeautyProjectDetailPage> | null>(null);

/** 页面 query 只用于定位服务项目，不进入任何业务记录。 */
onLoad((query) => {
  projectId.value = readBeautyProjectId(query);
});

/** 从编辑页返回详情时读回可能改变的项目资料。 */
function refreshDetail(): void {
  void detailPage.value?.refresh();
}

/** 编辑写入异步完成时只刷新仍在页面栈中的当前项目详情。 */
function refreshChangedProject(payload: BeautyProjectChangedPayload): void {
  if (payload.projectId === projectId.value && payload.kind === "saved") {
    refreshDetail();
  }
}

/** 删除成功后给出结果反馈并返回服务项目列表。 */
function completeDeletion(): void {
  completeBeautyProjectDeletion();
}

const stopProjectChangedSubscription = subscribeBeautyProjectChanged(
  refreshChangedProject,
);
onShow(refreshDetail);
onUnload(stopProjectChangedSubscription);
</script>

<template>
  <view class="project-detail-route">
    <BeautyProjectDetailPage
      v-if="projectId"
      ref="detailPage"
      :project-id="projectId"
      :service="service"
      @back="returnToBeautyProjectList()"
      @deleted="completeDeletion"
      @edit="openBeautyProjectEditor(projectId)"
    />
    <view v-else class="project-detail-route__invalid" role="alert">
      <text>缺少项目标识，请返回服务项目列表后重试。</text>
      <button @click="returnToBeautyProjectList()">返回服务项目列表</button>
    </view>
  </view>
</template>

<style scoped>
.project-detail-route { min-height: 100vh; background: #fff8fa; }
.project-detail-route__invalid { display: flex; flex-direction: column; align-items: center; gap: 22rpx; margin: 30rpx; padding: 36rpx 24rpx; border: 2rpx solid #ead6d8; border-radius: 20rpx; background: #fff8f8; color: #934c54; font-size: 23rpx; line-height: 1.55; text-align: center; }
.project-detail-route__invalid button { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 25rpx; line-height: 1.35; }
</style>
