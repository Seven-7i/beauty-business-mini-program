<script setup lang="ts">
import type { InventoryItemV1 } from "@/domain/data-schema";

/** 物品资料只读区的业务输入。 */
interface InventoryItemProfileDetailsProps {
  /** 当前物品完整资料。 */
  item: InventoryItemV1;
  /** 业务提交期间禁止重复进入资料操作。 */
  disabled: boolean;
}

/** 物品资料只读区向详情容器暴露的低频操作。 */
interface InventoryItemProfileDetailsEmits {
  /** 请求打开资料编辑表单。 */
  edit: [];
  /** 请求切换当前物品启用状态。 */
  toggleStatus: [];
  /** 请求按引用规则彻底删除当前物品。 */
  delete: [];
}

defineProps<InventoryItemProfileDetailsProps>();
const emit = defineEmits<InventoryItemProfileDetailsEmits>();
</script>

<template>
  <view id="inventory-profile-panel" class="profile-details" role="tabpanel">
    <view class="profile-details__panel">
      <view class="profile-details__heading">
        <text class="profile-details__title">资料信息</text>
        <button :disabled="disabled" @click="emit('edit')">
          <u-icon name="edit-pen" color="#6A43B0" size="18" />
          <text>编辑资料</text>
        </button>
      </view>
      <view class="profile-details__row">
        <text>物品名称</text>
        <text>{{ item.name }}</text>
      </view>
      <view class="profile-details__row">
        <text>计量单位</text>
        <text>{{ item.unit }}</text>
      </view>
      <view class="profile-details__row profile-details__row--note">
        <text>备注</text>
        <text>{{ item.note || "未填写" }}</text>
      </view>
    </view>

    <view class="profile-details__operations">
      <text class="profile-details__operations-title">资料操作</text>
      <button
        :disabled="disabled"
        hover-class="profile-details__operation--pressed"
        @click="emit('toggleStatus')"
      >
        <u-icon
          :name="item.status === 'active' ? 'pause-circle' : 'play-circle'"
          color="#6236B5"
          size="20"
        />
        <text>{{ item.status === "active" ? "停用物品" : "重新启用" }}</text>
        <u-icon name="arrow-right" color="#817A80" size="16" />
      </button>
      <button
        class="profile-details__delete"
        :disabled="disabled"
        hover-class="profile-details__operation--pressed"
        @click="emit('delete')"
      >
        <u-icon name="trash" color="#D92E56" size="20" />
        <text>彻底删除</text>
        <u-icon name="arrow-right" color="#817A80" size="16" />
      </button>
    </view>
  </view>
</template>

<style scoped>
.profile-details { position: relative; z-index: 1; padding-top: 22rpx; }
.profile-details__panel, .profile-details__operations { border: 2rpx solid rgba(136, 103, 126, 0.08); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 14rpx 36rpx rgba(111, 76, 99, 0.06); }
.profile-details__heading, .profile-details__heading button, .profile-details__row, .profile-details__operations button { display: flex; align-items: center; }
.profile-details__heading { min-height: 78rpx; justify-content: space-between; gap: 18rpx; padding: 0 28rpx; border-bottom: 2rpx solid rgba(137, 123, 132, 0.14); }
.profile-details__title, .profile-details__operations-title { color: #292428; font-size: 26rpx; font-weight: 700; }
.profile-details__heading button { min-height: 62rpx; gap: 8rpx; margin: 0; padding: 8rpx 0 8rpx 16rpx; border: 0; background: transparent; color: #6a43b0; font-size: 21rpx; }
.profile-details__row { min-height: 82rpx; justify-content: space-between; gap: 24rpx; margin: 0 28rpx; border-bottom: 2rpx solid rgba(137, 123, 132, 0.12); color: #7b7379; font-size: 22rpx; }
.profile-details__row:last-child { border-bottom: 0; }
.profile-details__row text:last-child { min-width: 0; color: #342f33; text-align: right; overflow-wrap: anywhere; }
.profile-details__row--note { align-items: flex-start; padding: 22rpx 0; line-height: 1.5; }
.profile-details__operations { margin-top: 20rpx; overflow: hidden; }
.profile-details__operations-title { display: block; padding: 26rpx 28rpx 12rpx; }
.profile-details__operations button { width: auto; min-height: 80rpx; justify-content: flex-start; gap: 14rpx; margin: 0 28rpx; padding: 12rpx 0; border: 0; border-bottom: 2rpx solid rgba(137, 123, 132, 0.12); border-radius: 0; background: transparent; color: #6a43b0; font-size: 23rpx; text-align: left; }
.profile-details__operations button > text { min-width: 0; flex: 1; }
.profile-details__operations button:last-child { border-bottom: 0; }
.profile-details__operations .profile-details__delete { color: #a94442; }
.profile-details__operation--pressed { background: rgba(106, 67, 176, 0.05); }
</style>
