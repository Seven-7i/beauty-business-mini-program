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
import {
  getCustomerFormErrorField,
  prepareCustomerAddressesForSubmit,
  shouldConfirmCustomerAddressRemoval,
} from "../customer-form-state";

/**
 * 顾客表单的只读状态输入。
 * 当前由 `CustomerCreate` 用于独立新增，并由 `CustomerDetailPage` 用于详情内编辑。
 */
interface CustomerFormProps {
  /** 保存进行中时禁止重复提交和更改地址结构。 */
  submitting: boolean;
  /** 独立新增页隐藏内嵌标题，并使用纵向双卡片布局。 */
  standalone?: boolean;
  /** 存在时表单进入编辑模式，否则创建新顾客。 */
  editingCustomer?: DeepReadonly<CustomerV1>;
  /** 最近一次保存失败的稳定业务错误码。 */
  errorCode: CustomerRuleErrorCode | "";
  /** 与错误码对应、供字段就近展示的可读说明。 */
  errorMessage: string;
}

/**
 * 顾客表单向外层容器提交的用户意图。
 * `CustomerCreate` 处理新增，`CustomerDetailPage` 处理现有顾客编辑。
 */
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

/** 创建一项尚未填写的服务地址草稿。 */
function createEmptyAddressDraft(): AddressDraft {
  return { id: createAddressId(), addressText: "", note: "" };
}

/** 从列表顶部插入空白服务地址，使新增项紧邻顶部操作按钮。 */
function addAddress(): void {
  form.addresses.unshift(createEmptyAddressDraft());
}

/**
 * 移除服务地址；已填写正文或备注时先确认，空白占位直接移除。
 * 使用稳定地址标识重新定位，避免确认弹窗期间数组变化导致误删其他地址。
 */
function removeAddress(address: AddressDraft): void {
  const remove = (): void => {
    const index = form.addresses.findIndex((item) => item.id === address.id);
    if (index >= 0) {
      form.addresses.splice(index, 1);
    }
  };
  if (!shouldConfirmCustomerAddressRemoval(address)) {
    remove();
    return;
  }
  uni.showModal({
    title: "移除服务地址",
    content: "该地址已填写内容，确定移除吗？",
    cancelText: "保留",
    confirmText: "移除",
    confirmColor: "#A34D48",
    success(result) {
      if (result.confirm) {
        remove();
      }
    },
  });
}

/** 将当前表单草稿交给管理容器完成业务校验与保存。 */
function submit(): void {
  emit("submit", {
    nickname: form.nickname,
    phone: form.phone,
    addresses: prepareCustomerAddressesForSubmit(
      form.addresses,
      Boolean(props.standalone),
    ),
  });
}

/** 清空表单，以便新增完成或取消后安全复用组件实例。 */
function reset(): void {
  loadingDraft.value = true;
  form.nickname = "";
  form.phone = "";
  form.addresses.splice(
    0,
    form.addresses.length,
    ...(props.standalone ? [createEmptyAddressDraft()] : []),
  );
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
    ...(customer
      ? customer.addresses.map((address) => ({
          id: address.id,
          addressText: address.addressText,
          note: address.note ?? "",
        }))
      : props.standalone
        ? [createEmptyAddressDraft()]
        : []),
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
  <view
    class="customer-form"
    :class="{ 'customer-form--standalone': standalone }"
  >
    <view v-if="!standalone" class="customer-form__heading">
      <text class="customer-form__title">{{ editingCustomer ? "编辑顾客" : "新增顾客" }}</text>
      <button :disabled="submitting" @click="emit('cancel')">
        {{ editingCustomer ? "取消编辑" : "返回列表" }}
      </button>
    </view>
    <view class="customer-form__profile">
      <view class="customer-form__row">
        <label
          class="customer-form__field customer-form__field--nickname"
          :class="{ 'customer-form__field--invalid': nicknameError }"
        >
          <text class="customer-form__label">
            昵称
            <text v-if="standalone" class="customer-form__required" aria-hidden="true">*</text>
          </text>
          <input
            v-model="form.nickname"
            maxlength="30"
            :placeholder="standalone ? '请输入顾客昵称' : '例如：小雨'"
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
          <text class="customer-form__label">
            手机号
            <text v-if="standalone" class="customer-form__required" aria-hidden="true">*</text>
          </text>
          <input
            v-model="form.phone"
            type="number"
            maxlength="11"
            :placeholder="standalone ? '请输入中国大陆 11 位手机号' : '中国大陆 11 位手机号'"
            :aria-invalid="Boolean(phoneError)"
          />
          <text v-if="phoneError" class="customer-form__field-error" role="alert">
            {{ phoneError }}
          </text>
        </label>
      </view>
    </view>

    <view class="address-editor">
      <view class="address-editor__heading">
        <view class="address-editor__copy">
          <text class="address-editor__title">服务地址（选填）</text>
          <text class="address-editor__hint">可保存多个地点，创建预约时手动选择。</text>
        </view>
        <button :disabled="submitting" @click="addAddress">＋ 添加地址</button>
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
          <button :disabled="submitting" @click="removeAddress(address)">移除</button>
        </view>
        <label class="address-card__field">
          <text v-if="standalone">地址正文</text>
          <input
            v-model="address.addressText"
            maxlength="100"
            :placeholder="standalone ? '例如：建设路 8 号' : '地址正文，例如：建设路 8 号'"
            :aria-invalid="emptyAddressErrorId === address.id"
          />
        </label>
        <text
          v-if="emptyAddressErrorId === address.id"
          class="customer-form__field-error"
          role="alert"
        >
          {{ errorMessage }}
        </text>
        <label class="address-card__field">
          <text v-if="standalone">地址备注（选填）</text>
          <input
            v-model="address.note"
            maxlength="50"
            :placeholder="standalone ? '例如：到东门联系' : '地址备注（选填），例如：到东门联系'"
          />
        </label>
      </view>
      <text v-if="!form.addresses.length" class="address-editor__empty">暂未添加服务地址</text>
    </view>

    <button class="customer-form__submit" :disabled="submitting" @click="submit">
      {{ submitting ? "正在保存" : editingCustomer ? "保存修改" : "保存顾客" }}
    </button>
  </view>
</template>

<style scoped>
.customer-form {
  position: relative;
  z-index: 1;
  padding: 30rpx;
  border: 2rpx solid rgba(136, 103, 126, 0.1);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14rpx 36rpx rgba(111, 76, 99, 0.07);
}

.customer-form--standalone {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.customer-form__heading,
.address-editor__heading,
.address-card__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.customer-form__title {
  color: #1e293b;
  font-size: 31rpx;
  font-weight: 700;
}

.customer-form__heading button,
.address-editor__heading button,
.address-card__heading button {
  min-height: 68rpx;
  margin: 0;
  padding: 12rpx 16rpx;
  background: transparent;
  color: #7048ac;
  font-size: 21rpx;
  line-height: 1.35;
}

.customer-form__row {
  display: flex;
  gap: 16rpx;
}

.customer-form__field {
  display: flex;
  min-width: 0;
  flex: 1;
  margin-top: 24rpx;
  flex-direction: column;
  color: #465168;
  font-size: 23rpx;
  font-weight: 600;
}

.customer-form__label {
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
}

.customer-form__required {
  color: #c6534d;
}

.customer-form__field input,
.address-card input {
  height: 74rpx;
  box-sizing: border-box;
  margin-top: 10rpx;
  padding: 0 18rpx;
  border: 2rpx solid #e2d8e0;
  border-radius: 11rpx;
  background: #fcf9fb;
  color: #332f33;
  font-size: 24rpx;
}

.customer-form__field--invalid input,
.address-card--invalid input {
  border-color: #c66e68;
  background: #fff9f8;
}

.customer-form__field-error {
  display: block;
  margin-top: 8rpx;
  color: #a34d48;
  font-size: 20rpx;
  font-weight: 500;
  line-height: 1.45;
}

.address-editor {
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid #edf0f4;
}

.address-editor__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.address-editor__title {
  color: #354158;
  font-size: 24rpx;
  font-weight: 700;
}

.address-editor__hint,
.address-editor__empty {
  margin-top: 6rpx;
  color: #828b9a;
  font-size: 20rpx;
  line-height: 1.5;
}

.address-editor__heading {
  gap: 0;
  flex-wrap: nowrap;
}

.address-editor__heading button {
  flex: none;
  color: #7048ac;
}

.address-card {
  margin-top: 16rpx;
  padding: 18rpx;
  border-radius: 13rpx;
  background: #f8f2f7;
}

.address-card--invalid {
  box-shadow: inset 0 0 0 2rpx rgba(198, 110, 104, 0.24);
}

.address-card__heading {
  color: #536077;
  font-size: 22rpx;
  font-weight: 600;
}

.address-card__heading button {
  color: #9a4a47;
}

.address-card__field {
  display: flex;
  margin-top: 0;
  flex-direction: column;
  color: inherit;
  font-size: inherit;
}

.address-editor__empty {
  display: block;
}

.customer-form__submit {
  height: 82rpx;
  margin-top: 28rpx;
  border-radius: 14rpx;
  background: linear-gradient(135deg, #7853b9 0%, #6437aa 100%);
  color: #fff;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 82rpx;
}

.customer-form--standalone .customer-form__profile,
.customer-form--standalone .address-editor {
  padding: 30rpx;
  border: 2rpx solid rgba(136, 103, 126, 0.1);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14rpx 36rpx rgba(111, 76, 99, 0.07);
}

.customer-form--standalone .customer-form__row {
  flex-direction: column;
  gap: 0;
}

.customer-form--standalone .customer-form__field input,
.customer-form--standalone .address-card input {
  height: 76rpx;
  border: 0;
  border-bottom: 2rpx solid #e2d8e0;
  border-radius: 0;
  background: transparent;
}

.customer-form--standalone .customer-form__field--invalid input,
.customer-form--standalone .address-card--invalid input {
  border-bottom-color: #c66e68;
  background: #fff9f8;
}

.customer-form--standalone .address-editor__heading button {
  display: flex;
  height: 58rpx;
  min-height: 0;
  align-items: center;
  justify-content: center;
  padding: 0 18rpx;
  border: 2rpx solid #7650b5;
  border-radius: 12rpx;
  line-height: 1;
}

.customer-form--standalone .customer-form__field:first-child {
  margin-top: 0;
}

.customer-form--standalone .customer-form__label {
  color: #29252a;
  font-size: 25rpx;
  font-weight: 700;
}

.customer-form--standalone .address-editor {
  margin-top: 22rpx;
}

.customer-form--standalone .address-editor__title {
  color: #29252a;
  font-size: 27rpx;
}

.customer-form--standalone .address-editor__hint,
.customer-form--standalone .address-editor__empty {
  color: #777078;
}

.customer-form--standalone .address-editor__empty {
  display: block;
  margin: 16rpx 0 4rpx;
  padding: 22rpx 0;
  text-align: center;
}

.customer-form--standalone .address-editor__heading {
  align-items: center;
  gap: 16rpx;
  flex-direction: row;
  flex-wrap: nowrap;
}

.customer-form--standalone .address-card {
  margin-top: 20rpx;
  padding: 22rpx;
  border: 2rpx solid #e7dfe5;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.92);
}

.customer-form--standalone .address-card__heading {
  color: #29252a;
  font-size: 24rpx;
  font-weight: 700;
}

.customer-form--standalone .address-card__heading button {
  color: #7650b5;
}

.customer-form--standalone .address-card__field {
  margin-top: 18rpx;
  color: #3f3940;
  font-size: 22rpx;
}

.customer-form--standalone .customer-form__submit {
  height: 88rpx;
  border-radius: 16rpx;
  box-shadow: 0 14rpx 30rpx rgba(102, 59, 161, 0.2);
  line-height: 88rpx;
}

@media (max-width: 360px) {
  .customer-form__row {
    flex-direction: column;
    gap: 0;
  }

}
</style>
