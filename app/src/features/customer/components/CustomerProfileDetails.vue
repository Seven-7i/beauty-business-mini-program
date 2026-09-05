<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";

/** “顾客资料”Tab 的只读展示输入。 */
interface CustomerProfileDetailsProps {
  /** 当前顾客及其多个服务地址。 */
  customer: DeepReadonly<CustomerV1>;
  /** 状态或删除提交期间禁止重复操作。 */
  disabled: boolean;
}

/** “顾客资料”Tab 向详情组合层暴露的低频操作。 */
interface CustomerProfileDetailsEmits {
  /** 请求切换当前顾客启用状态。 */
  "toggle-status": [];
  /** 请求彻底删除当前顾客。 */
  delete: [];
}

defineProps<CustomerProfileDetailsProps>();
const emit = defineEmits<CustomerProfileDetailsEmits>();
</script>

<template>
  <view id="customer-profile-panel" class="customer-profile-details" role="tabpanel" aria-label="顾客资料">
    <section class="customer-profile-details__card" aria-labelledby="customer-addresses-title">
      <view class="customer-profile-details__heading">
        <text id="customer-addresses-title" class="customer-profile-details__title">服务地址</text>
        <text class="customer-profile-details__count">{{ customer.addresses.length }} 个</text>
      </view>
      <view v-if="!customer.addresses.length" class="customer-profile-details__empty" role="status">
        暂未保存服务地址，可通过“编辑资料”添加。
      </view>
      <view v-else class="customer-profile-details__addresses">
        <view v-for="address in customer.addresses" :key="address.id" class="customer-profile-details__address">
          <text class="customer-profile-details__address-text">{{ address.addressText }}</text>
          <text v-if="address.note" class="customer-profile-details__address-note">{{ address.note }}</text>
        </view>
      </view>
    </section>

    <section class="customer-profile-details__card" aria-labelledby="customer-actions-title">
      <text id="customer-actions-title" class="customer-profile-details__title">资料操作</text>
      <text class="customer-profile-details__hint">停用后不再参与新预约；有预约记录的顾客只能停用。</text>
      <view class="customer-profile-details__actions">
        <button
          class="customer-profile-details__action"
          :disabled="disabled"
          hover-class="customer-profile-details__action--pressed"
          @click="emit('toggle-status')"
        >
          <u-icon
            :name="customer.status === 'active' ? 'pause-circle' : 'play-circle'"
            color="#6236B5"
            size="20"
          />
          <text>{{ customer.status === "active" ? "停用顾客" : "重新启用" }}</text>
          <u-icon name="arrow-right" color="#817A80" size="16" />
        </button>
        <button
          class="customer-profile-details__action customer-profile-details__action--danger"
          :disabled="disabled"
          hover-class="customer-profile-details__action--pressed"
          @click="emit('delete')"
        >
          <u-icon name="trash" color="#D92E56" size="20" />
          <text>彻底删除</text>
          <u-icon name="arrow-right" color="#817A80" size="16" />
        </button>
      </view>
    </section>
  </view>
</template>

<style scoped>
.customer-profile-details { display: flex; padding-top: 24rpx; flex-direction: column; gap: 22rpx; }
.customer-profile-details__card { padding: 28rpx 30rpx; border: 2rpx solid rgba(136, 103, 126, 0.1); border-radius: 22rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 12rpx 32rpx rgba(111, 76, 99, 0.06); }
.customer-profile-details__heading, .customer-profile-details__action { display: flex; align-items: center; justify-content: space-between; }
.customer-profile-details__heading { gap: 18rpx; }
.customer-profile-details__title { color: #2f2930; font-size: 27rpx; font-weight: 700; }
.customer-profile-details__count { flex: none; color: #6f686d; font-size: 22rpx; }
.customer-profile-details__addresses { margin-top: 18rpx; }
.customer-profile-details__address { display: flex; padding: 20rpx 0; border-top: 2rpx solid rgba(137, 123, 132, 0.14); flex-direction: column; gap: 8rpx; }
.customer-profile-details__address:first-child { padding-top: 10rpx; border-top: 0; }
.customer-profile-details__address:last-child { padding-bottom: 0; }
.customer-profile-details__address-text { color: #302a2f; font-size: 25rpx; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }
.customer-profile-details__address-note { color: #746d72; font-size: 22rpx; line-height: 1.5; overflow-wrap: anywhere; }
.customer-profile-details__empty { margin-top: 18rpx; padding: 28rpx 20rpx; border: 2rpx dashed #ded3dc; border-radius: 16rpx; color: #837a81; font-size: 22rpx; line-height: 1.55; text-align: center; }
.customer-profile-details__hint { display: block; margin-top: 10rpx; color: #777078; font-size: 21rpx; line-height: 1.55; overflow-wrap: anywhere; }
.customer-profile-details__actions { margin-top: 18rpx; }
.customer-profile-details__action { width: 100%; min-height: 82rpx; box-sizing: border-box; justify-content: flex-start; gap: 14rpx; margin: 0; padding: 14rpx 0; border: 0; border-radius: 0; background: transparent; color: #6337ae; font-size: 24rpx; line-height: 1.35; text-align: left; }
.customer-profile-details__action > text { min-width: 0; flex: 1; }
.customer-profile-details__action + .customer-profile-details__action { border-top: 2rpx solid rgba(137, 123, 132, 0.14); }
.customer-profile-details__action--danger { color: #a34d59; }
.customer-profile-details__action--pressed { background: rgba(106, 67, 176, 0.05); }
.customer-profile-details__action[disabled] { opacity: 0.5; }
</style>
