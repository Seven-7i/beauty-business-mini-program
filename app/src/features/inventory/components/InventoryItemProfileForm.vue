<script setup lang="ts">
import { reactive, watch } from "vue";
import type { InventoryItemV1 } from "@/domain/data-schema";
import type { UpdateInventoryItemProfileInput } from "@/services/inventory-management-service";

const props = defineProps<{
  item: InventoryItemV1;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "submit", input: UpdateInventoryItemProfileInput): void;
  (event: "cancel"): void;
}>();

const form = reactive({ name: "", unit: "", note: "" });

function loadItem(): void {
  form.name = props.item.name;
  form.unit = props.item.unit;
  form.note = props.item.note ?? "";
}

watch(() => props.item.id, loadItem, { immediate: true });

function submit(): void {
  emit("submit", {
    inventoryItemId: props.item.id,
    name: form.name,
    unit: form.unit,
    note: form.note,
  });
}
</script>

<template>
  <view class="profile-form">
    <view class="profile-form__header">
      <text class="profile-form__title">编辑物品资料</text>
      <button :disabled="submitting" @click="$emit('cancel')">取消</button>
    </view>
    <view class="profile-form__notice">
      当前库存和计量精度不会随资料编辑改变。
    </view>
    <view class="profile-form__row">
      <label class="profile-form__field">
        <text>物品名称</text>
        <input v-model="form.name" maxlength="40" />
      </label>
      <label class="profile-form__field">
        <text>计量单位</text>
        <input v-model="form.unit" maxlength="12" />
      </label>
    </view>
    <label class="profile-form__field">
      <text>备注（选填）</text>
      <textarea v-model="form.note" class="profile-form__textarea" auto-height maxlength="200" />
    </label>
    <button class="profile-form__submit" :disabled="submitting" @click="submit">
      {{ submitting ? "正在保存" : "保存修改" }}
    </button>
  </view>
</template>

<style scoped>
.profile-form {
  margin-top: 24rpx;
  padding: 28rpx;
  border: 2rpx solid #b8c7e4;
  border-radius: 18rpx;
  background: #f4f7fd;
}

.profile-form__header,
.profile-form__row {
  display: flex;
  gap: 16rpx;
}

.profile-form__header {
  align-items: center;
  justify-content: space-between;
}

.profile-form__title {
  color: #243552;
  font-size: 28rpx;
  font-weight: 700;
}

.profile-form__header button {
  background: transparent;
  color: #63708a;
  font-size: 23rpx;
}

.profile-form__notice {
  margin-top: 10rpx;
  color: #748097;
  font-size: 21rpx;
}

.profile-form__field {
  display: flex;
  min-width: 0;
  flex: 1;
  margin-top: 20rpx;
  color: #4c5870;
  font-size: 22rpx;
  font-weight: 600;
  flex-direction: column;
}

.profile-form__field input,
.profile-form__textarea {
  height: 70rpx;
  margin-top: 9rpx;
  box-sizing: border-box;
  padding: 0 18rpx;
  border: 2rpx solid #d5ddea;
  border-radius: 10rpx;
  background: #ffffff;
  color: #263248;
  font-size: 24rpx;
}

.profile-form__textarea {
  min-height: 82rpx;
  padding-top: 16rpx;
  padding-bottom: 16rpx;
  line-height: 1.5;
}

.profile-form__submit {
  height: 74rpx;
  margin-top: 24rpx;
  border-radius: 12rpx;
  background: #3159b5;
  color: #ffffff;
  font-size: 25rpx;
  line-height: 74rpx;
}
</style>
