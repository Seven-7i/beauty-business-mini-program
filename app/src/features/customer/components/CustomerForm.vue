<script setup lang="ts">
import { reactive, watch, type DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import type { CreateCustomerInput } from "@/services/customer-management-service";

const props = defineProps<{
  submitting: boolean;
  editingCustomer?: DeepReadonly<CustomerV1>;
}>();

const emit = defineEmits<{
  (event: "submit", input: CreateCustomerInput): void;
  (event: "cancel-edit"): void;
}>();

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

/** 地址标识只用于顾客内部稳定引用，不承载展示或排序语义。 */
function createAddressId(): string {
  return `customer-address-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function addAddress(): void {
  form.addresses.push({ id: createAddressId(), addressText: "", note: "" });
}

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

function reset(): void {
  form.nickname = "";
  form.phone = "";
  form.addresses.splice(0);
}

function loadCustomer(customer?: DeepReadonly<CustomerV1>): void {
  reset();
  if (!customer) {
    return;
  }
  form.nickname = customer.nickname;
  form.phone = customer.phone;
  form.addresses.push(
    ...customer.addresses.map((address) => ({
      id: address.id,
      addressText: address.addressText,
      note: address.note ?? "",
    })),
  );
}

watch(() => props.editingCustomer, loadCustomer, { immediate: true });

defineExpose({ reset });
</script>

<template>
  <view class="customer-form">
    <view class="customer-form__heading">
      <text class="customer-form__title">{{ editingCustomer ? "编辑顾客" : "新增顾客" }}</text>
      <button v-if="editingCustomer" :disabled="submitting" @click="emit('cancel-edit')">取消编辑</button>
    </view>
    <view class="customer-form__row">
      <label class="customer-form__field">
        <text>昵称</text>
        <input v-model="form.nickname" maxlength="30" placeholder="例如：小雨" />
      </label>
      <label class="customer-form__field">
        <text>手机号</text>
        <input v-model="form.phone" type="number" maxlength="11" placeholder="中国大陆 11 位手机号" />
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
      <view v-for="(address, index) in form.addresses" :key="address.id" class="address-card">
        <view class="address-card__heading">
          <text>地址 {{ index + 1 }}</text>
          <button :disabled="submitting" @click="form.addresses.splice(index, 1)">移除</button>
        </view>
        <input v-model="address.addressText" maxlength="100" placeholder="地址正文，例如：建设路 8 号" />
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
.customer-form { padding: 30rpx; border: 2rpx solid #e0e5ec; border-radius: 20rpx; background: #fff; }
.customer-form__heading, .address-editor__heading, .address-card__heading { display: flex; align-items: center; justify-content: space-between; }
.customer-form__title { color: #1e293b; font-size: 31rpx; font-weight: 700; }
.customer-form__heading button, .address-editor__heading button, .address-card__heading button { background: transparent; color: #31549e; font-size: 21rpx; }
.customer-form__row { display: flex; gap: 16rpx; }
.customer-form__field { display: flex; min-width: 0; flex: 1; margin-top: 24rpx; flex-direction: column; color: #465168; font-size: 23rpx; font-weight: 600; }
.customer-form__field input, .address-card input { height: 74rpx; box-sizing: border-box; margin-top: 10rpx; padding: 0 18rpx; border: 2rpx solid #dce2ea; border-radius: 11rpx; background: #f9fafc; color: #263248; font-size: 24rpx; }
.address-editor { margin-top: 28rpx; padding-top: 24rpx; border-top: 2rpx solid #edf0f4; }
.address-editor__copy { display: flex; flex-direction: column; }
.address-editor__title { color: #354158; font-size: 24rpx; font-weight: 700; }
.address-editor__hint, .address-editor__empty { margin-top: 6rpx; color: #828b9a; font-size: 20rpx; }
.address-card { margin-top: 16rpx; padding: 18rpx; border-radius: 13rpx; background: #f5f7fa; }
.address-card__heading { color: #536077; font-size: 22rpx; font-weight: 600; }
.address-card__heading button { color: #9a4a47; }
.address-editor__empty { display: block; }
.customer-form__submit { height: 82rpx; margin-top: 28rpx; border-radius: 14rpx; background: #3159b5; color: #fff; font-size: 27rpx; font-weight: 600; line-height: 82rpx; }
</style>
