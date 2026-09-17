<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { BeautyProjectV1 } from "@/domain/data-schema";

/** 项目详情顶部概览的只读输入。 */
interface BeautyProjectSummaryProps {
  /** 当前服务项目。 */
  project: DeepReadonly<BeautyProjectV1>;
  /** 业务提交期间禁止重复进入编辑页。 */
  disabled: boolean;
}

/** 项目概览向详情组合层暴露的操作。 */
interface BeautyProjectSummaryEmits {
  /** 请求进入当前项目的统一编辑表单。 */
  edit: [];
}

defineProps<BeautyProjectSummaryProps>();
const emit = defineEmits<BeautyProjectSummaryEmits>();

/** 将整数分转换为固定两位小数的人民币金额。 */
function formatPrice(cents: number): string {
  return `¥${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
</script>

<template>
  <section
    class="project-summary"
    :class="{ 'project-summary--inactive': project.status === 'inactive' }"
    aria-label="项目概览"
  >
    <view class="project-summary__heading">
      <view class="project-summary__identity">
        <text class="project-summary__name">{{ project.name }}</text>
        <text
          class="project-summary__status"
          :class="{
            'project-summary__status--inactive': project.status === 'inactive',
          }"
        >
          {{ project.status === "active" ? "启用" : "停用" }}
        </text>
      </view>
      <button
        class="project-summary__edit"
        :disabled="disabled"
        hover-class="project-summary__edit--pressed"
        @click="emit('edit')"
      >
        编辑资料
      </button>
    </view>
    <view class="project-summary__metrics">
      <view class="project-summary__metric">
        <text class="project-summary__metric-label">标准价格</text>
        <text class="project-summary__metric-value">
          {{ formatPrice(project.standardPriceCents) }}
        </text>
      </view>
      <view class="project-summary__divider" aria-hidden="true" />
      <view class="project-summary__metric">
        <text class="project-summary__metric-label">预计服务时长</text>
        <text class="project-summary__metric-value">
          {{ project.durationMinutes }} 分钟
        </text>
      </view>
    </view>
  </section>
</template>

<style scoped>
.project-summary { position: relative; z-index: 1; overflow: hidden; border: 2rpx solid rgba(136, 103, 126, 0.08); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 16rpx 40rpx rgba(111, 76, 99, 0.07); }
.project-summary--inactive { background: rgba(246, 243, 245, 0.96); box-shadow: none; }
.project-summary__heading, .project-summary__identity, .project-summary__metrics, .project-summary__metric, .project-summary__edit { display: flex; align-items: center; }
.project-summary__heading { justify-content: space-between; gap: 20rpx; padding: 32rpx; border-bottom: 2rpx solid rgba(137, 123, 132, 0.16); }
.project-summary__identity { min-width: 0; flex: 1; gap: 14rpx; flex-wrap: wrap; }
.project-summary__name { min-width: 0; color: #252124; font-size: 32rpx; font-weight: 700; overflow-wrap: anywhere; }
.project-summary__status { flex: none; padding: 5rpx 12rpx; border-radius: 9rpx; background: #e6f4e9; color: #2e8b4d; font-size: 19rpx; }
.project-summary__status--inactive { background: #ebe8ea; color: #746d72; }
.project-summary__edit { height: 68rpx; flex: none; justify-content: center; margin: 0; padding: 0 20rpx; border: 2rpx solid #6940c3; border-radius: 13rpx; background: #ffffff; color: #5e35b4; font-size: 22rpx; line-height: 1; }
.project-summary__edit--pressed { background: #f4effb; }
.project-summary__metrics { padding: 34rpx 20rpx 36rpx; }
.project-summary__metric { min-width: 0; flex: 1; flex-direction: column; }
.project-summary__metric-label { color: #766f74; font-size: 21rpx; }
.project-summary__metric-value { max-width: 100%; margin-top: 14rpx; color: #5f31ba; font-size: 34rpx; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; text-align: center; }
.project-summary__divider { width: 2rpx; height: 88rpx; flex: none; background: rgba(137, 123, 132, 0.18); }
.project-summary--inactive .project-summary__name, .project-summary--inactive .project-summary__metric-value { color: #777075; }

@media (max-width: 360px) {
  .project-summary__heading { align-items: flex-start; padding-right: 24rpx; padding-left: 24rpx; }
  .project-summary__metric-value { font-size: 29rpx; }
}
</style>
