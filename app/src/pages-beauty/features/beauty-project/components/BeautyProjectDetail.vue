<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { BeautyProjectV1, InventoryItemV1 } from "@/domain/data-schema";
import BeautyProjectActions from "./BeautyProjectActions.vue";
import BeautyProjectSummary from "./BeautyProjectSummary.vue";
import BeautyProjectUsageList from "./BeautyProjectUsageList.vue";

/** 服务项目详情组合组件的只读输入。 */
interface BeautyProjectDetailProps {
  /** 当前服务项目。 */
  project: DeepReadonly<BeautyProjectV1>;
  /** 用于解析默认物品用量的库存资料。 */
  inventoryItems: readonly DeepReadonly<InventoryItemV1>[];
  /** 业务提交期间禁止重复操作。 */
  disabled: boolean;
}

/** 服务项目详情向状态容器暴露的用户意图。 */
interface BeautyProjectDetailEmits {
  /** 请求进入编辑表单。 */
  edit: [];
  /** 请求切换启用状态。 */
  toggleStatus: [];
  /** 请求彻底删除项目。 */
  deleteProject: [];
}

defineProps<BeautyProjectDetailProps>();
const emit = defineEmits<BeautyProjectDetailEmits>();
</script>

<template>
  <view class="project-detail">
    <BeautyProjectSummary
      :project="project"
      :disabled="disabled"
      @edit="emit('edit')"
    />
    <BeautyProjectUsageList
      :project="project"
      :inventory-items="inventoryItems"
    />
    <BeautyProjectActions
      :status="project.status"
      :disabled="disabled"
      @toggle-status="emit('toggleStatus')"
      @delete-project="emit('deleteProject')"
    />
  </view>
</template>

<style scoped>
.project-detail { position: relative; z-index: 1; }
</style>
