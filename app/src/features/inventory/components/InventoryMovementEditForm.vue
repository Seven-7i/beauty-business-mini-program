<script setup lang="ts">
import { reactive, watch } from "vue";
import type { InventoryItemV1, InventoryMovementV1 } from "@/domain/data-schema";
import type { RewriteManualInventoryMovementInput } from "@/services/inventory-management-service";

const props = defineProps<{
  movement: InventoryMovementV1;
  item: InventoryItemV1;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "submit", input: RewriteManualInventoryMovementInput): void;
  (event: "cancel"): void;
}>();

const form = reactive({ quantityInput: "", note: "" });

function loadMovement(): void {
  form.quantityInput =
    props.movement.type === "restock"
      ? props.movement.deltaQuantity
      : props.movement.afterQuantity;
  form.note = props.movement.note ?? "";
}

watch(() => props.movement.id, loadMovement, { immediate: true });

function submit(): void {
  emit("submit", {
    movementId: props.movement.id,
    operation: "edit",
    quantityInput: form.quantityInput,
    note: form.note,
  });
}
</script>

<template>
  <view class="movement-edit">
    <view class="movement-edit__header">
      <view class="movement-edit__copy">
        <text class="movement-edit__title">编辑 {{ item.name }} 的手工记录</text>
        <text class="movement-edit__hint">
          {{ movement.type === "restock" ? "填写补货增加量" : "填写当次记录后的实际库存" }}
        </text>
      </view>
      <button :disabled="submitting" @click="$emit('cancel')">取消</button>
    </view>
    <label class="movement-edit__field">
      <text>数量（{{ item.unit }}）</text>
      <input v-model="form.quantityInput" type="digit" maxlength="14" />
    </label>
    <label class="movement-edit__field">
      <text>说明（选填）</text>
      <textarea v-model="form.note" class="movement-edit__textarea" auto-height maxlength="200" />
    </label>
    <view class="movement-edit__warning">保存后系统会重新计算这条记录之后的库存结余。</view>
    <button class="movement-edit__submit" :disabled="submitting" @click="submit">
      {{ submitting ? "正在重算" : "保存并重算库存" }}
    </button>
  </view>
</template>

<style scoped>
.movement-edit {
  margin-top: 24rpx;
  padding: 28rpx;
  border: 2rpx solid #b8c7e4;
  border-radius: 18rpx;
  background: #f4f7fd;
}

.movement-edit__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.movement-edit__copy,
.movement-edit__field {
  display: flex;
  flex-direction: column;
}

.movement-edit__title {
  color: #243552;
  font-size: 27rpx;
  font-weight: 700;
}

.movement-edit__hint {
  margin-top: 7rpx;
  color: #748097;
  font-size: 21rpx;
}

.movement-edit__header button {
  flex: none;
  background: transparent;
  color: #63708a;
  font-size: 22rpx;
}

.movement-edit__field {
  margin-top: 20rpx;
  color: #4c5870;
  font-size: 22rpx;
  font-weight: 600;
}

.movement-edit__field input,
.movement-edit__textarea {
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

.movement-edit__textarea {
  min-height: 82rpx;
  padding-top: 16rpx;
  padding-bottom: 16rpx;
  line-height: 1.5;
}

.movement-edit__warning {
  margin-top: 18rpx;
  color: #7b6544;
  font-size: 21rpx;
  line-height: 1.5;
}

.movement-edit__submit {
  height: 74rpx;
  margin-top: 20rpx;
  border-radius: 12rpx;
  background: #3159b5;
  color: #ffffff;
  font-size: 24rpx;
  line-height: 74rpx;
}
</style>
