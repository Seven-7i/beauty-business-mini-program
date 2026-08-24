<script setup lang="ts">
import { reactive, watch } from "vue";
import type { InventoryItemV1 } from "@/domain/data-schema";
import type { AdjustInventoryInput } from "@/services/inventory-management-service";

const props = defineProps<{
  item: InventoryItemV1;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "submit", input: AdjustInventoryInput): void;
  (event: "cancel"): void;
}>();

const form = reactive({
  kind: "restock" as AdjustInventoryInput["kind"],
  quantityInput: "",
  note: "",
});

watch(
  () => props.item.id,
  () => {
    form.kind = "restock";
    form.quantityInput = "";
    form.note = "";
  },
);

function submit(): void {
  emit("submit", {
    inventoryItemId: props.item.id,
    kind: form.kind,
    quantityInput: form.quantityInput,
    note: form.note,
  });
}
</script>

<template>
  <view class="adjustment">
    <view class="adjustment__header">
      <view class="adjustment__copy">
        <text class="adjustment__title">调整 {{ item.name }}</text>
        <text class="adjustment__current">当前 {{ item.currentQuantity }}{{ item.unit }}</text>
      </view>
      <button class="adjustment__close" :disabled="submitting" @click="$emit('cancel')">
        取消
      </button>
    </view>
    <view class="adjustment__switch" aria-label="调整方式">
      <button
        :class="['adjustment__switch-button', { 'adjustment__switch-button--active': form.kind === 'restock' }]"
        :disabled="submitting"
        @click="form.kind = 'restock'"
      >
        补货增加
      </button>
      <button
        :class="['adjustment__switch-button', { 'adjustment__switch-button--active': form.kind === 'stocktake' }]"
        :disabled="submitting"
        @click="form.kind = 'stocktake'"
      >
        盘点修正
      </button>
    </view>
    <label class="adjustment__field">
      <text>{{ form.kind === "restock" ? "本次增加数量" : "盘点后的实际库存" }}</text>
      <input
        v-model="form.quantityInput"
        type="digit"
        maxlength="14"
        :placeholder="`单位：${item.unit}`"
      />
    </label>
    <label class="adjustment__field">
      <text>备注（选填）</text>
      <textarea
        v-model="form.note"
        class="adjustment__textarea"
        auto-height
        maxlength="200"
        placeholder="例如：到货批次或盘点原因"
      />
    </label>
    <button class="adjustment__submit" :disabled="submitting" @click="submit">
      {{ submitting ? "正在保存" : "确认调整" }}
    </button>
  </view>
</template>

<style scoped>
.adjustment {
  margin-top: 24rpx;
  padding: 28rpx;
  border: 2rpx solid #b8c7e4;
  border-radius: 18rpx;
  background: #f4f7fd;
}

.adjustment__header,
.adjustment__switch {
  display: flex;
  align-items: center;
}

.adjustment__header {
  justify-content: space-between;
}

.adjustment__copy,
.adjustment__field {
  display: flex;
  flex-direction: column;
}

.adjustment__title {
  color: #243552;
  font-size: 28rpx;
  font-weight: 700;
}

.adjustment__current {
  margin-top: 6rpx;
  color: #6e7990;
  font-size: 22rpx;
}

.adjustment__close {
  background: transparent;
  color: #63708a;
  font-size: 23rpx;
}

.adjustment__switch {
  gap: 12rpx;
  margin-top: 24rpx;
}

.adjustment__switch-button {
  height: 64rpx;
  flex: 1;
  border: 2rpx solid #c9d3e4;
  border-radius: 10rpx;
  background: #ffffff;
  color: #5d6880;
  font-size: 23rpx;
  line-height: 62rpx;
}

.adjustment__switch-button--active {
  border-color: #3159b5;
  background: #3159b5;
  color: #ffffff;
}

.adjustment__field {
  margin-top: 20rpx;
  color: #4c5870;
  font-size: 22rpx;
  font-weight: 600;
}

.adjustment__field input,
.adjustment__textarea {
  height: 72rpx;
  margin-top: 9rpx;
  box-sizing: border-box;
  padding: 0 18rpx;
  border: 2rpx solid #d5ddea;
  border-radius: 10rpx;
  background: #ffffff;
  color: #263248;
  font-size: 24rpx;
}

.adjustment__textarea {
  min-height: 82rpx;
  padding-top: 16rpx;
  padding-bottom: 16rpx;
  line-height: 1.5;
}

.adjustment__submit {
  height: 74rpx;
  margin-top: 24rpx;
  border-radius: 12rpx;
  background: #3159b5;
  color: #ffffff;
  font-size: 25rpx;
  line-height: 74rpx;
}
</style>
