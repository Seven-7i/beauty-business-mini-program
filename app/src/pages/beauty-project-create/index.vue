<script setup lang="ts">
import { shallowRef } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import {
  completeBeautyProjectEditorNavigation,
  readBeautyProjectId,
  returnToBeautyProjectList,
} from "@/features/beauty-project/beauty-project-navigation";
import BeautyProjectEditor from "@/features/beauty-project/components/BeautyProjectEditor.vue";
import {
  acknowledgeQuickAddedInventoryItem,
  beginQuickAddInventoryRequest,
  cancelQuickAddInventoryRequest,
  peekQuickAddedInventoryItem,
} from "@/features/beauty-project/quick-add-inventory-handoff";
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
const activeQuickAddRequestId = shallowRef("");
const editor = shallowRef<InstanceType<typeof BeautyProjectEditor> | null>(null);

/** 页面参数只决定新增或编辑模式，不进入项目业务资料。 */
onLoad((query) => {
  projectId.value = readBeautyProjectId(query);
  uni.setNavigationBarTitle({
    title: projectId.value ? "编辑服务项目" : "新增服务项目",
  });
});

/** 打开独立库存新增页；页面栈保留当前项目表单实例与草稿。 */
function openInventory(): void {
  const requestId = beginQuickAddInventoryRequest();
  activeQuickAddRequestId.value = requestId;
  uni.navigateTo({
    url: `/pages/inventory-create/index?mode=project-quick-add&requestId=${encodeURIComponent(requestId)}`,
    fail: () => {
      cancelQuickAddInventoryRequest(requestId);
      if (activeQuickAddRequestId.value === requestId) {
        activeQuickAddRequestId.value = "";
      }
    },
  });
}

/** 保存成功后交由稳定导航规则返回列表或当前详情。 */
function completeSave(savedProjectId: string, editing: boolean): void {
  completeBeautyProjectEditorNavigation(savedProjectId, editing);
}

/** 页面重新显示时优先消费快速新增物品，否则刷新项目编辑资料。 */
function refreshEditor(): void {
  const requestId = activeQuickAddRequestId.value;
  const createdInventoryItemId = peekQuickAddedInventoryItem(requestId);
  if (createdInventoryItemId) {
    void editor.value
      ?.refreshAndSelectInventoryItem(createdInventoryItemId)
      .then((selected) => {
        if (selected) {
          acknowledgeQuickAddedInventoryItem(createdInventoryItemId, requestId);
          activeQuickAddRequestId.value = "";
        }
      });
    return;
  }
  void editor.value?.refresh();
}

onShow(refreshEditor);
onUnload(() => {
  if (activeQuickAddRequestId.value) {
    cancelQuickAddInventoryRequest(activeQuickAddRequestId.value);
  }
});
</script>

<template>
  <view class="project-editor-route">
    <BeautyProjectEditor
      ref="editor"
      :service="service"
      :project-id="projectId"
      @missing="returnToBeautyProjectList()"
      @quick-add-inventory="openInventory"
      @saved="completeSave"
    />
  </view>
</template>

<style scoped>
.project-editor-route { min-height: 100vh; background: #fff8fa; }
</style>
