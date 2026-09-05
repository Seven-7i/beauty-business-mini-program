<script setup lang="ts">
import type { BeautyProjectV1, InventoryItemV1 } from "@/domain/data-schema";

/** 单张服务项目卡片的只读展示输入。 */
interface BeautyProjectCardProps {
  /** 当前服务项目。 */
  project: BeautyProjectV1;
  /** 用于解析默认用量的库存资料。 */
  inventoryItems: readonly InventoryItemV1[];
  /** 页面读取或提交期间禁止重复进入。 */
  disabled: boolean;
}

/** 服务项目卡片向列表层暴露的操作。 */
interface BeautyProjectCardEmits {
  /** 请求进入当前服务项目详情。 */
  view: [project: BeautyProjectV1];
}

const props = defineProps<BeautyProjectCardProps>();
const emit = defineEmits<BeautyProjectCardEmits>();

/** 将整数分转换为固定两位小数的人民币金额。 */
function formatPrice(cents: number): string {
  return `¥${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** 将项目默认用量解析成列表卡片的一行只读摘要。 */
function formatUsageSummary(project: BeautyProjectV1): string {
  if (!project.defaultUsages.length) {
    return "未设置默认物品用量";
  }
  return project.defaultUsages
    .map((usage) => {
      const item = props.inventoryItems.find(
        (candidate) => candidate.id === usage.inventoryItemId,
      );
      return item
        ? `${item.name} ${usage.quantity} ${item.unit}`
        : `已停用物品 ${usage.quantity}`;
    })
    .join(" · ");
}
</script>

<template>
  <article
    class="project-card"
    :class="{ 'project-card--inactive': project.status === 'inactive' }"
  >
    <button
      class="project-card__main"
      :disabled="disabled"
      :aria-label="`查看${project.name}的项目详情`"
      hover-class="project-card__main--pressed"
      :hover-start-time="20"
      :hover-stay-time="80"
      @click="emit('view', project)"
    >
      <view class="project-card__heading">
        <text
          class="project-card__name"
          :class="{ 'project-card__name--inactive': project.status === 'inactive' }"
        >
          {{ project.name }}
        </text>
        <u-icon name="arrow-right" color="#837B82" size="16" />
      </view>
      <view class="project-card__facts">
        <text class="project-card__duration">预计 {{ project.durationMinutes }} 分钟</text>
        <text class="project-card__price">{{ formatPrice(project.standardPriceCents) }}</text>
      </view>
      <view class="project-card__usage">
        <text class="project-card__usage-label">默认用量</text>
        <text class="project-card__usage-summary">{{ formatUsageSummary(project) }}</text>
      </view>
    </button>
  </article>
</template>

<style scoped>
.project-card { margin-top: 20rpx; overflow: hidden; border: 2rpx solid rgba(136, 103, 126, 0.08); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 14rpx 36rpx rgba(111, 76, 99, 0.07); }
.project-card--inactive { border-color: rgba(126, 121, 124, 0.12); background: rgba(238, 235, 237, 0.94); box-shadow: none; }
.project-card__main { width: 100%; min-height: 68rpx; box-sizing: border-box; margin: 0; padding: 30rpx 32rpx 28rpx; border: 0; border-radius: 0; background: transparent; color: #332e32; line-height: 1.3; text-align: left; transition: background-color 120ms ease, transform 120ms ease; }
.project-card__main--pressed { background: rgba(111, 69, 181, 0.035); transform: scale(0.995); }
.project-card__heading, .project-card__facts { display: flex; align-items: center; }
.project-card__heading { justify-content: space-between; gap: 18rpx; }
.project-card__name { min-width: 0; color: #252124; font-size: 31rpx; font-weight: 700; overflow-wrap: anywhere; }
.project-card__name--inactive { color: #777075; text-decoration: line-through; text-decoration-thickness: 2rpx; }
.project-card__facts { justify-content: space-between; gap: 20rpx; margin-top: 28rpx; }
.project-card__duration { min-width: 0; color: #625d61; font-size: 24rpx; overflow-wrap: anywhere; }
.project-card__price { flex: none; color: #5f31ba; font-size: 31rpx; font-weight: 650; font-variant-numeric: tabular-nums; }
.project-card__usage { display: flex; margin-top: 26rpx; padding-top: 22rpx; border-top: 2rpx solid rgba(137, 123, 132, 0.16); flex-direction: column; }
.project-card__usage-label { color: #6f686d; font-size: 22rpx; }
.project-card__usage-summary { margin-top: 12rpx; color: #625b60; font-size: 23rpx; line-height: 1.5; overflow-wrap: anywhere; }
.project-card--inactive .project-card__duration, .project-card--inactive .project-card__price, .project-card--inactive .project-card__usage-label, .project-card--inactive .project-card__usage-summary { color: #777075; }

@media (max-width: 360px) {
  .project-card__main { padding-right: 24rpx; padding-left: 24rpx; }
  .project-card__facts { align-items: flex-start; flex-direction: column; gap: 10rpx; }
}
</style>
