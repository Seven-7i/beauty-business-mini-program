<script setup lang="ts">
import { computed, type DeepReadonly } from "vue";
import type { InventoryItemV1 } from "@/domain/data-schema";
import type { AppointmentUsageDraft } from "../appointment-form-state";

interface AppointmentUsageEditorProps {
  /** 当前用量草稿；更新时通过 v-model 事件返回新数组。 */
  modelValue: readonly AppointmentUsageDraft[];
  /** 允许添加且用于解析单位的库存物品。 */
  inventoryItems: readonly DeepReadonly<InventoryItemV1>[];
  /** 提交期间禁用全部编辑入口。 */
  disabled?: boolean;
  /** 由完成弹层按库存物品标识传入的数量校验错误。 */
  quantityErrors?: Readonly<Record<string, string>>;
}

const props = withDefaults(
  defineProps<AppointmentUsageEditorProps>(),
  { disabled: false, quantityErrors: () => ({}) },
);

const emit = defineEmits<{
  /** 提交完整的新用量数组，避免直接修改父组件状态。 */
  (event: "update:modelValue", value: AppointmentUsageDraft[]): void;
}>();

/** 未加入当前用量的库存物品；选择后立即创建一行，避免遗漏额外添加操作。 */
const availableInventoryItems = computed(() =>
  props.inventoryItems.filter(
    (item) =>
      !props.modelValue.some(
        (usage) => usage.inventoryItemId === item.id,
      ),
  ),
);
const availableInventoryNames = computed(() =>
  availableInventoryItems.value.map((item) => `${item.name}（${item.unit}）`),
);

/** 每条已有用量可重选的物品范围：保留当前项，排除其他行已选的物品。 */
const usagePickerOptions = computed(() =>
  props.modelValue.map((usage) =>
    props.inventoryItems.filter(
      (item) =>
        item.id === usage.inventoryItemId ||
        !props.modelValue.some(
          (otherUsage) => otherUsage.inventoryItemId === item.id,
        ),
    ),
  ),
);
const usagePickerNames = computed(() =>
  usagePickerOptions.value.map((options) =>
    options.map((item) => `${item.name}（${item.unit}）`),
  ),
);

/** 返回库存快照的当前展示名称；历史物品不可用时保留明确占位。 */
function inventoryLabel(inventoryItemId: string): string {
  const item = props.inventoryItems.find(
    (candidate) => candidate.id === inventoryItemId,
  );
  return item ? `${item.name} · ${item.unit}` : "库存物品不可用";
}

/** 更新指定用量并以新数组向父组件提交，保持单向数据流。 */
function updateQuantity(index: number, quantityInput: string): void {
  emit(
    "update:modelValue",
    props.modelValue.map((usage, position) =>
      position === index ? { ...usage, quantityInput } : { ...usage },
    ),
  );
}

/** 兼容各端 input 事件结构并提取字符串值。 */
function handleQuantityInput(index: number, event: unknown): void {
  const detail = (event as { detail?: { value?: unknown } }).detail;
  updateQuantity(index, String(detail?.value ?? ""));
}

/** 选择库存物品后立刻追加空用量行，用户只需在该行填写实际数量。 */
function selectInventoryItem(event: { detail: { value: string } }): void {
  const inventoryItem = availableInventoryItems.value[
    Number(event.detail.value)
  ];
  if (!inventoryItem) {
    return;
  }
  emit("update:modelValue", [
    ...props.modelValue.map((usage) => ({ ...usage })),
    { inventoryItemId: inventoryItem.id, quantityInput: "" },
  ]);
}

/** 将已有用量替换为未被其他行使用的物品，并保留用户已填的数量。 */
function replaceInventoryItem(
  index: number,
  event: { detail: { value: string } },
): void {
  const inventoryItem = usagePickerOptions.value[index]?.[
    Number(event.detail.value)
  ];
  if (!inventoryItem) {
    return;
  }
  emit(
    "update:modelValue",
    props.modelValue.map((usage, position) =>
      position === index
        ? { inventoryItemId: inventoryItem.id, quantityInput: usage.quantityInput }
        : { ...usage },
    ),
  );
}

/** 移除一项实际用量。 */
function removeUsage(index: number): void {
  emit(
    "update:modelValue",
    props.modelValue
      .filter((_usage, position) => position !== index)
      .map((usage) => ({ ...usage })),
  );
}
</script>

<template>
  <view class="usage-editor">
    <view v-if="!modelValue.length" class="usage-editor__empty">
      本次没有库存用量，可按需添加
    </view>
    <view
      v-for="(usage, index) in modelValue"
      :key="usage.inventoryItemId"
      class="usage-editor__row"
    >
      <picker
        class="usage-editor__row-picker"
        :range="usagePickerNames[index]"
        :disabled="disabled || !usagePickerNames[index].length"
        @change="replaceInventoryItem(index, $event)"
      >
        <view class="usage-editor__name">
          <text>{{ inventoryLabel(usage.inventoryItemId) }}</text>
          <u-icon name="arrow-down" color="#766E85" size="15" />
        </view>
      </picker>
      <view class="usage-editor__quantity-field">
        <input
          class="usage-editor__quantity"
          :class="{ 'usage-editor__quantity--invalid': quantityErrors[usage.inventoryItemId] }"
          type="digit"
          :value="usage.quantityInput"
          :disabled="disabled"
          placeholder="用量"
          @input="handleQuantityInput(index, $event)"
        />
        <text v-if="quantityErrors[usage.inventoryItemId]" class="usage-editor__quantity-error">
          {{ quantityErrors[usage.inventoryItemId] }}
        </text>
      </view>
      <button
        class="usage-editor__remove"
        :disabled="disabled"
        aria-label="移除用量"
        @click="removeUsage(index)"
      >
        <u-icon name="minus-circle" color="#ff3347" size="20" />
      </button>
    </view>
    <view class="usage-editor__add-row">
      <picker
        class="usage-editor__picker"
        :range="availableInventoryNames"
        :disabled="disabled || !availableInventoryItems.length"
        @change="selectInventoryItem"
      >
        <view class="usage-editor__picker-value">
          <view class="usage-editor__picker-copy">
            <text class="usage-editor__picker-label">库存物品</text>
            <text
              class="usage-editor__picker-name"
              :class="'usage-editor__picker-name--placeholder'"
            >
              {{ availableInventoryItems.length ? "选择库存物品" : inventoryItems.length ? "库存物品已全部加入" : "暂无可选库存物品" }}
            </text>
          </view>
          <u-icon name="arrow-down" color="#6B55D8" size="17" />
        </view>
      </picker>
    </view>
  </view>
</template>

<style scoped>
.usage-editor { width: 100%; }
.usage-editor__empty { padding: 22rpx; border: 2rpx dashed #d8d4e6; border-radius: 14rpx; color: #8a8598; font-size: 23rpx; text-align: center; }
.usage-editor__row { display: flex; align-items: center; min-height: 82rpx; border: 2rpx solid #e4e1ec; background: #fff; }
.usage-editor__row + .usage-editor__row { border-top: 0; }
.usage-editor__row:first-child { border-radius: 14rpx 14rpx 0 0; }
.usage-editor__row:last-child { border-radius: 0 0 14rpx 14rpx; }
.usage-editor__row-picker { display: block; min-width: 0; flex: 1; }
.usage-editor__name { display: flex; min-height: 82rpx; min-width: 0; box-sizing: border-box; align-items: center; gap: 8rpx; padding: 0 18rpx; color: #262334; font-size: 24rpx; }
.usage-editor__name text { min-width: 0; flex: 1; overflow-wrap: anywhere; }
.usage-editor__quantity-field { width: 150rpx; padding: 8rpx 0; }
.usage-editor__quantity { width: 140rpx; height: 64rpx; box-sizing: border-box; padding: 0 14rpx; border: 2rpx solid #ded9e8; border-radius: 10rpx; color: #24212e; font-size: 24rpx; text-align: center; }
.usage-editor__quantity--invalid { border-color: #d92f42; background: #fff7f7; }
.usage-editor__quantity-error { display: block; margin-top: 4rpx; color: #d92f42; font-size: 18rpx; line-height: 1.3; text-align: center; }
.usage-editor__remove { display: flex; width: 78rpx; height: 78rpx; align-items: center; justify-content: center; padding: 0; background: transparent; }
.usage-editor__add-row { margin-top: 16rpx; padding: 14rpx; border: 2rpx dashed #6c4df2; border-radius: 14rpx; background: #faf9ff; }
.usage-editor__picker { display: block; width: 100%; }
.usage-editor__picker-value { display: flex; min-height: 82rpx; box-sizing: border-box; align-items: center; justify-content: space-between; gap: 16rpx; padding: 12rpx 18rpx; border: 2rpx solid #ded9e8; border-radius: 10rpx; background: #fff; }
.usage-editor__picker-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4rpx; }
.usage-editor__picker-label { color: #797282; font-size: 19rpx; }
.usage-editor__picker-name { color: #30265d; font-size: 24rpx; line-height: 1.3; overflow-wrap: anywhere; }
.usage-editor__picker-name--placeholder { color: #8a8493; }
</style>
