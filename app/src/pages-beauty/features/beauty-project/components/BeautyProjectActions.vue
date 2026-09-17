<script setup lang="ts">
import type { BeautyProjectV1 } from "@/domain/data-schema";

/** 项目详情低频操作区的状态输入。 */
interface BeautyProjectActionsProps {
  /** 当前状态决定展示停用还是重新启用。 */
  status: BeautyProjectV1["status"];
  /** 业务提交期间禁止重复状态变更和删除。 */
  disabled: boolean;
}

/** 项目低频操作区向详情容器暴露的操作。 */
interface BeautyProjectActionsEmits {
  /** 请求切换项目启用状态。 */
  toggleStatus: [];
  /** 请求彻底删除未被预约引用的项目。 */
  deleteProject: [];
}

defineProps<BeautyProjectActionsProps>();
const emit = defineEmits<BeautyProjectActionsEmits>();
</script>

<template>
  <section class="project-actions" aria-label="项目操作">
    <text class="project-actions__title">项目操作</text>
    <text class="project-actions__description">
      {{
        status === "active"
          ? "停用后不再用于新预约，历史预约仍会保留"
          : "重新启用前会复核项目名称和默认用量"
      }}
    </text>
    <view class="project-actions__list">
      <button
        class="project-actions__row"
        :disabled="disabled"
        hover-class="project-actions__row--pressed"
        @click="emit('toggleStatus')"
      >
        <u-icon
          :name="status === 'active' ? 'pause-circle' : 'play-circle'"
          color="#6236B5"
          size="20"
        />
        <text>{{ status === "active" ? "停用项目" : "重新启用" }}</text>
        <u-icon name="arrow-right" color="#817A80" size="16" />
      </button>
      <button
        class="project-actions__row project-actions__row--danger"
        :disabled="disabled"
        hover-class="project-actions__row--pressed"
        @click="emit('deleteProject')"
      >
        <u-icon name="trash" color="#D92E56" size="20" />
        <text>彻底删除</text>
        <u-icon name="arrow-right" color="#817A80" size="16" />
      </button>
    </view>
  </section>
</template>

<style scoped>
.project-actions { position: relative; z-index: 1; margin-top: 24rpx; padding: 32rpx 32rpx 0; overflow: hidden; border: 2rpx solid rgba(136, 103, 126, 0.08); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 16rpx 40rpx rgba(111, 76, 99, 0.07); }
.project-actions__title { color: #2c272b; font-size: 28rpx; font-weight: 700; }
.project-actions__description { display: block; margin-top: 12rpx; color: #776f75; font-size: 21rpx; line-height: 1.5; overflow-wrap: anywhere; }
.project-actions__list { margin-top: 22rpx; }
.project-actions__row { display: flex; width: 100%; min-height: 88rpx; box-sizing: border-box; align-items: center; gap: 14rpx; margin: 0; padding: 0; border: 0; border-top: 2rpx solid rgba(137, 123, 132, 0.14); border-radius: 0; background: transparent; color: #5f35b2; font-size: 24rpx; line-height: 1; text-align: left; }
.project-actions__row > text { min-width: 0; flex: 1; }
.project-actions__row--danger { color: #d92e56; }
.project-actions__row--pressed { background: rgba(106, 67, 176, 0.05); }
</style>
