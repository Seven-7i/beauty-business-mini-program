<script setup lang="ts">
import { computed, nextTick } from "vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type {
  CreateCustomerInput,
  CustomerCreateService,
} from "@/services/customer-management-service";
import { completeCustomerCreateNavigation } from "../customer-create-navigation";
import { getCustomerFormErrorField } from "../customer-form-state";
import { useCustomerCreate } from "../composables/useCustomerCreate";
import { useCustomerDraftProtection } from "../composables/useCustomerDraftProtection";
import CustomerForm from "./CustomerForm.vue";

/** 独立新增顾客页的业务用例依赖。 */
interface CustomerCreateProps {
  /** 页面可调用且只包含创建能力的顾客服务。 */
  service: CustomerCreateService;
}

const props = defineProps<CustomerCreateProps>();
const {
  submitting,
  errorMessage,
  errorCode,
  clearError,
  createCustomer,
} = useCustomerCreate(props.service);
const { updateDirty, resetDirty } = useCustomerDraftProtection();
const formErrorField = computed(() =>
  getCustomerFormErrorField(errorCode.value),
);

/** 非字段错误出现时把视口带到页面级说明。 */
async function scrollToErrorNotice(): Promise<void> {
  await nextTick();
  uni.pageScrollTo({
    selector: ".customer-create__notice",
    duration: 180,
  });
}

/** 保存新增顾客，成功后解除草稿保护并返回顾客列表。 */
async function handleSubmit(input: CreateCustomerInput): Promise<void> {
  const saved = await createCustomer(input);
  if (!saved) {
    if (!formErrorField.value) {
      await scrollToErrorNotice();
    }
    return;
  }
  resetDirty();
  completeCustomerCreateNavigation();
}
</script>

<template>
  <main class="customer-create">
    <view
      class="customer-create__glow customer-create__glow--rose"
      aria-hidden="true"
    />
    <view
      class="customer-create__glow customer-create__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage && !formErrorField"
      class="customer-create__notice"
      :message="errorMessage"
    />

    <CustomerForm
      standalone
      :submitting="submitting"
      :error-code="errorCode"
      :error-message="errorMessage"
      @submit="handleSubmit"
      @dirty-change="updateDirty"
      @draft-change="clearError"
    />
  </main>
</template>

<style scoped>
.customer-create {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  padding: 30rpx 30rpx calc(48rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 54%, #f8f4f7 100%);
}

.customer-create__glow {
  position: absolute;
  z-index: 0;
  border-radius: 999rpx;
  pointer-events: none;
}

.customer-create__glow--rose {
  top: -130rpx;
  right: -180rpx;
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba(244, 205, 220, 0.48) 0%, rgba(244, 205, 220, 0) 70%);
}

.customer-create__glow--lavender {
  top: 30rpx;
  right: -140rpx;
  width: 420rpx;
  height: 330rpx;
  background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%);
}

.customer-create__notice {
  position: relative;
  z-index: 2;
  margin: 0 0 20rpx;
}

@media (max-width: 360px) {
  .customer-create {
    padding-right: 24rpx;
    padding-left: 24rpx;
  }
}
</style>
