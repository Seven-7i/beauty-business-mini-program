<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted } from "vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type {
  CreateCustomerInput,
  CustomerEditorService,
} from "@/services/customer-management-service";
import {
  completeCustomerEditorNavigation,
  createCustomerEditorCompletionGuard,
  notifyCustomerSaved,
} from "../customer-create-navigation";
import { getCustomerFormErrorField } from "../customer-form-state";
import { useCustomerDraftProtection } from "../composables/useCustomerDraftProtection";
import { useCustomerEditor } from "../composables/useCustomerManagement";
import CustomerForm from "./CustomerForm.vue";

/** 统一顾客表单页的业务用例依赖与页面模式。 */
interface CustomerEditorProps {
  /** 页面可调用的顾客读取、创建和更新窄用例。 */
  service: CustomerEditorService;
  /** 存在时进入编辑模式，缺失时进入新增模式。 */
  customerId?: string;
}

/** 统一顾客表单页无法定位顾客时的恢复动作。 */
interface CustomerEditorEmits {
  /** 编辑目标不存在，请求路由重建到顾客列表。 */
  missing: [];
}

const props = defineProps<CustomerEditorProps>();
const emit = defineEmits<CustomerEditorEmits>();
const {
  customer,
  isEditing,
  loading,
  submitting,
  errorMessage,
  errorKind,
  errorCode,
  clearError,
  loadCustomer,
  saveCustomer,
} = useCustomerEditor(props.service, props.customerId);
const { updateDirty, resetDirty, updateSaving } = useCustomerDraftProtection();
const completionGuard = createCustomerEditorCompletionGuard();
const formErrorField = computed(() => getCustomerFormErrorField(errorCode.value));

/** 非字段错误出现时把视口带到页面级说明。 */
async function scrollToErrorNotice(): Promise<void> {
  await nextTick();
  uni.pageScrollTo({
    selector: ".customer-editor__notice",
    duration: 180,
  });
}

/** 按当前页面模式保存顾客，成功后返回原列表或详情。 */
async function handleSubmit(input: CreateCustomerInput): Promise<void> {
  if (submitting.value) {
    return;
  }
  updateSaving(true);
  const saved = await saveCustomer(input);
  if (saved) {
    notifyCustomerSaved(props.customerId);
  }
  if (!completionGuard.isActive()) {
    return;
  }
  if (!saved) {
    updateSaving(false);
    if (!formErrorField.value) {
      await scrollToErrorNotice();
    }
    return;
  }
  resetDirty();
  completeCustomerEditorNavigation(props.customerId);
}

onMounted(loadCustomer);
onBeforeUnmount(completionGuard.deactivate);
</script>

<template>
  <main class="customer-editor">
    <view
      class="customer-editor__glow customer-editor__glow--rose"
      aria-hidden="true"
    />
    <view
      class="customer-editor__glow customer-editor__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage && !formErrorField && errorKind !== 'missing'"
      class="customer-editor__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="loadCustomer"
    />

    <view v-if="loading" class="customer-editor__loading" role="status">
      正在读取顾客资料
    </view>
    <view
      v-else-if="errorKind === 'missing'"
      class="customer-editor__missing"
      role="alert"
    >
      <text class="customer-editor__missing-copy">{{ errorMessage }}</text>
      <button class="customer-editor__back" @click="emit('missing')">
        返回顾客列表
      </button>
    </view>
    <CustomerForm
      v-else-if="!isEditing || customer"
      :submitting="submitting"
      :editing-customer="customer"
      :error-code="errorCode"
      :error-message="errorMessage"
      @submit="handleSubmit"
      @dirty-change="updateDirty"
      @draft-change="clearError"
    />
  </main>
</template>

<style scoped>
.customer-editor {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  padding: 30rpx 30rpx calc(48rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 54%, #f8f4f7 100%);
}

.customer-editor__glow {
  position: absolute;
  z-index: 0;
  border-radius: 999rpx;
  pointer-events: none;
}

.customer-editor__glow--rose {
  top: -130rpx;
  right: -180rpx;
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba(244, 205, 220, 0.48) 0%, rgba(244, 205, 220, 0) 70%);
}

.customer-editor__glow--lavender {
  top: 30rpx;
  right: -140rpx;
  width: 420rpx;
  height: 330rpx;
  background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%);
}

.customer-editor__notice,
.customer-editor__loading,
.customer-editor__missing {
  position: relative;
  z-index: 2;
}

.customer-editor__notice {
  margin: 0 0 20rpx;
}

.customer-editor__loading {
  padding: 30rpx 24rpx;
  border: 2rpx solid rgba(137, 106, 128, 0.08);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.92);
  color: #766e74;
  font-size: 23rpx;
  text-align: center;
}

.customer-editor__missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22rpx;
  padding: 36rpx 28rpx;
  border: 2rpx solid #ead6d8;
  border-radius: 24rpx;
  background: rgba(255, 248, 248, 0.94);
  text-align: center;
}

.customer-editor__missing-copy {
  color: #934c54;
  font-size: 24rpx;
  line-height: 1.55;
}

.customer-editor__back {
  min-width: 240rpx;
  min-height: 76rpx;
  margin: 0;
  padding: 16rpx 28rpx;
  border-radius: 999rpx;
  background: #6a3cb3;
  color: #fff;
  font-size: 25rpx;
  font-weight: 650;
  line-height: 1.35;
}

@media (max-width: 360px) {
  .customer-editor {
    padding-right: 24rpx;
    padding-left: 24rpx;
  }
}
</style>
