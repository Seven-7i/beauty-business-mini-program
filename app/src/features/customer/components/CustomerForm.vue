<script setup lang="ts">
import {
  computed,
  nextTick,
  reactive,
  shallowRef,
  watch,
  type DeepReadonly,
} from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import type { CreateCustomerInput } from "@/services/customer-management-service";
import type { CustomerRuleErrorCode } from "@/services/customer-service";
import { getCustomerFormErrorField } from "../customer-form-state";

/** 顾客表单的只读状态输入。 */
interface CustomerFormProps {
  /** 保存进行中时禁止重复提交和更改地址结构。 */
  submitting: boolean;
  /** 存在时表单进入编辑模式，否则创建新顾客。 */
  editingCustomer?: DeepReadonly<CustomerV1>;
  /** 最近一次保存失败的稳定业务错误码。 */
  errorCode: CustomerRuleErrorCode | "";
  /** 与错误码对应、供字段就近展示的可读说明。 */
  errorMessage: string;
}

/** 顾客表单向管理容器提交的用户意图。 */
interface CustomerFormEmits {
  /** 提交已保留原始输入的顾客草稿。 */
  submit: [input: CreateCustomerInput];
  /** 放弃当前新增或编辑草稿。 */
  cancel: [];
  /** 草稿是否偏离进入表单时的初始值。 */
  "dirty-change": [dirty: boolean];
  /** 用户再次修改草稿，旧的业务校验错误应当撤销。 */
  "draft-change": [];
}

const props = defineProps<CustomerFormProps>();
const emit = defineEmits<CustomerFormEmits>();

/** 单个服务地址的可编辑草稿。 */
interface AddressDraft {
  id: string;
  addressText: string;
  note: string;
}

const form = reactive({
  nickname: "",
  phone: "",
  addresses: [] as AddressDraft[],
});
const loadingDraft = shallowRef(false);

/** 把草稿压缩成稳定快照，用于判断是否存在未保存改动。 */
function createDraftSignature(): string {
  return JSON.stringify({
    nickname: form.nickname,
    phone: form.phone,
    addresses: form.addresses.map((address) => ({
      id: address.id,
      addressText: address.addressText,
      note: address.note,
    })),
  });
}

const draftSignature = computed(createDraftSignature);
const initialSignature = shallowRef(draftSignature.value);
const errorField = computed(() => getCustomerFormErrorField(props.errorCode));
const nicknameError = computed(() =>
  errorField.value === "nickname" ? props.errorMessage : "",
);
const phoneError = computed(() =>
  errorField.value === "phone" ? props.errorMessage : "",
);
const emptyAddressErrorId = computed(() =>
  props.errorCode === "empty-address"
    ? form.addresses.find((address) => !address.addressText.trim())?.id
    : undefined,
);
const addressEditorError = computed(() =>
  props.errorCode === "duplicate-address-id" ? props.errorMessage : "",
);

/** 地址标识只用于顾客内部稳定引用，不承载展示或排序语义。 */
function createAddressId(): string {
  return `customer-address-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 向当前顾客草稿追加一个空白服务地址。 */
function addAddress(): void {
  form.addresses.push({ id: createAddressId(), addressText: "", note: "" });
}

/** 将当前表单草稿交给管理容器完成业务校验与保存。 */
function submit(): void {
  emit("submit", {
    nickname: form.nickname,
    phone: form.phone,
    addresses: form.addresses.map((address) => ({
      id: address.id,
      addressText: address.addressText,
      note: address.note,
    })),
  });
}

/** 清空表单，以便新增完成或取消后安全复用组件实例。 */
function reset(): void {
  loadingDraft.value = true;
  form.nickname = "";
  form.phone = "";
  form.addresses.splice(0);
  initialSignature.value = createDraftSignature();
  loadingDraft.value = false;
  emit("dirty-change", false);
}

/** 将选中的顾客资料复制为可编辑草稿，避免直接修改只读实体。 */
function loadCustomer(customer?: DeepReadonly<CustomerV1>): void {
  loadingDraft.value = true;
  form.nickname = customer?.nickname ?? "";
  form.phone = customer?.phone ?? "";
  form.addresses.splice(
    0,
    form.addresses.length,
    ...(customer?.addresses.map((address) => ({
      id: address.id,
      addressText: address.addressText,
      note: address.note ?? "",
    })) ?? []),
  );
  initialSignature.value = createDraftSignature();
  loadingDraft.value = false;
  emit("dirty-change", false);
}

watch(() => props.editingCustomer, loadCustomer, { immediate: true });
watch(
  draftSignature,
  (signature) => {
    if (loadingDraft.value) {
      return;
    }
    emit("dirty-change", signature !== initialSignature.value);
    emit("draft-change");
  },
  { flush: "sync" },
);
watch(
  () => props.errorCode,
  async (code) => {
    const field = getCustomerFormErrorField(code);
    if (!field) {
      return;
    }
    await nextTick();
    const selector =
      field === "nickname"
        ? ".customer-form__field--nickname"
        : field === "phone"
          ? ".customer-form__field--phone"
          : code === "empty-address"
            ? ".address-card--invalid"
            : ".address-editor";
    uni.pageScrollTo({ selector, duration: 180 });
  },
);

defineExpose({ reset });
</script>

<template>
  <view class="customer-form">
    <view class="customer-form__heading">
      <text class="customer-form__title">{{ editingCustomer ? "编辑顾客" : "新增顾客" }}</text>
      <button :disabled="submitting" @click="emit('cancel')">
        {{ editingCustomer ? "取消编辑" : "返回列表" }}
      </button>
    </view>
    <view class="customer-form__row">
      <label
        class="customer-form__field customer-form__field--nickname"
        :class="{ 'customer-form__field--invalid': nicknameError }"
      >
        <text>昵称</text>
        <input
          v-model="form.nickname"
          maxlength="30"
          placeholder="例如：小雨"
          :aria-invalid="Boolean(nicknameError)"
        />
        <text v-if="nicknameError" class="customer-form__field-error" role="alert">
          {{ nicknameError }}
        </text>
      </label>
      <label
        class="customer-form__field customer-form__field--phone"
        :class="{ 'customer-form__field--invalid': phoneError }"
      >
        <text>手机号</text>
        <input
          v-model="form.phone"
          type="number"
          maxlength="11"
          placeholder="中国大陆 11 位手机号"
          :aria-invalid="Boolean(phoneError)"
        />
        <text v-if="phoneError" class="customer-form__field-error" role="alert">
          {{ phoneError }}
        </text>
      </label>
    </view>

    <view class="address-editor">
      <view class="address-editor__heading">
        <view class="address-editor__copy">
          <text class="address-editor__title">服务地址（选填）</text>
          <text class="address-editor__hint">可保存多个地点，创建预约时手动选择。</text>
        </view>
        <button :disabled="submitting" @click="addAddress">+ 添加地址</button>
      </view>
      <text v-if="addressEditorError" class="customer-form__field-error" role="alert">
        {{ addressEditorError }}
      </text>
      <view
        v-for="(address, index) in form.addresses"
        :key="address.id"
        class="address-card"
        :class="{ 'address-card--invalid': emptyAddressErrorId === address.id }"
      >
        <view class="address-card__heading">
          <text>地址 {{ index + 1 }}</text>
          <button :disabled="submitting" @click="form.addresses.splice(index, 1)">移除</button>
        </view>
        <input
          v-model="address.addressText"
          maxlength="100"
          placeholder="地址正文，例如：建设路 8 号"
          :aria-invalid="emptyAddressErrorId === address.id"
        />
        <text
          v-if="emptyAddressErrorId === address.id"
          class="customer-form__field-error"
          role="alert"
        >
          {{ errorMessage }}
        </text>
        <input v-model="address.note" maxlength="50" placeholder="地址备注（选填），例如：到东门联系" />
      </view>
      <text v-if="!form.addresses.length" class="address-editor__empty">暂未添加服务地址</text>
    </view>

    <button class="customer-form__submit" :disabled="submitting" @click="submit">
      {{ submitting ? "正在保存" : editingCustomer ? "保存修改" : "保存顾客" }}
    </button>
  </view>
</template>

<style scoped>
.customer-form { position: relative; z-index: 1; padding: 30rpx; border: 2rpx solid rgba(136, 103, 126, 0.1); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 14rpx 36rpx rgba(111, 76, 99, 0.07); }
.customer-form__heading, .address-editor__heading, .address-card__heading { display: flex; align-items: center; justify-content: space-between; }
.customer-form__title { color: #1e293b; font-size: 31rpx; font-weight: 700; }
.customer-form__heading button, .address-editor__heading button, .address-card__heading button { min-height: 68rpx; margin: 0; padding: 12rpx 16rpx; background: transparent; color: #7048ac; font-size: 21rpx; line-height: 1.35; }
.customer-form__row { display: flex; gap: 16rpx; }
.customer-form__field { display: flex; min-width: 0; flex: 1; margin-top: 24rpx; flex-direction: column; color: #465168; font-size: 23rpx; font-weight: 600; }
.customer-form__field input, .address-card input { height: 74rpx; box-sizing: border-box; margin-top: 10rpx; padding: 0 18rpx; border: 2rpx solid #e2d8e0; border-radius: 11rpx; background: #fcf9fb; color: #332f33; font-size: 24rpx; }
.customer-form__field--invalid input, .address-card--invalid input { border-color: #c66e68; background: #fff9f8; }
.customer-form__field-error { display: block; margin-top: 8rpx; color: #a34d48; font-size: 20rpx; font-weight: 500; line-height: 1.45; }
.address-editor { margin-top: 28rpx; padding-top: 24rpx; border-top: 2rpx solid #edf0f4; }
.address-editor__copy { display: flex; flex-direction: column; }
.address-editor__title { color: #354158; font-size: 24rpx; font-weight: 700; }
.address-editor__hint, .address-editor__empty { margin-top: 6rpx; color: #828b9a; font-size: 20rpx; }
.address-card { margin-top: 16rpx; padding: 18rpx; border-radius: 13rpx; background: #f8f2f7; }
.address-card--invalid { box-shadow: inset 0 0 0 2rpx rgba(198, 110, 104, 0.24); }
.address-card__heading { color: #536077; font-size: 22rpx; font-weight: 600; }
.address-card__heading button { color: #9a4a47; }
.address-editor__empty { display: block; }
.customer-form__submit { height: 82rpx; margin-top: 28rpx; border-radius: 14rpx; background: linear-gradient(135deg, #7853b9 0%, #6437aa 100%); color: #fff; font-size: 27rpx; font-weight: 600; line-height: 82rpx; }
@media (max-width: 360px) {
  .customer-form__row { flex-direction: column; gap: 0; }
}
</style>
