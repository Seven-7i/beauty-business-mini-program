<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import type { InventoryItemV1, InventoryMovementV1 } from "@/domain/data-schema";

const props = defineProps<{
  movements: readonly InventoryMovementV1[];
  items: readonly InventoryItemV1[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  (event: "edit", movement: InventoryMovementV1): void;
  (event: "delete", movement: InventoryMovementV1): void;
}>();

const pageSize = 20;
const visibleCount = shallowRef(pageSize);
const visibleMovements = computed(() =>
  props.movements.slice(0, visibleCount.value),
);
const hasMore = computed(
  () => visibleCount.value < props.movements.length,
);

watch(
  () => props.movements.length,
  () => {
    visibleCount.value = pageSize;
  },
);

const movementLabels: Record<InventoryMovementV1["type"], string> = {
  initial: "首次入库",
  restock: "补货",
  stocktake: "盘点修正",
  "appointment-consumption": "预约消耗",
};

function itemLabel(movement: InventoryMovementV1): string {
  return (
    props.items.find((item) => item.id === movement.inventoryItemId)?.name ??
    "历史物品"
  );
}

function formatOccurredAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const parts = [date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
  return `${parts} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
</script>

<template>
  <view v-if="movements.length" class="movement-list">
    <view class="movement-list__heading">
      <text class="movement-list__title">最近变动</text>
      <text class="movement-list__hint">共 {{ movements.length }} 条</text>
    </view>
    <view class="movement-list__records">
      <view v-for="movement in visibleMovements" :key="movement.id" class="movement-row">
        <view class="movement-row__copy">
          <text class="movement-row__name">{{ itemLabel(movement) }} · {{ movementLabels[movement.type] }}</text>
          <text class="movement-row__time">{{ formatOccurredAt(movement.occurredAt) }}</text>
        </view>
        <view class="movement-row__quantity">
          <text>{{ movement.deltaQuantity.startsWith('-') ? '' : '+' }}{{ movement.deltaQuantity }}</text>
          <text class="movement-row__after">结余 {{ movement.afterQuantity }}</text>
        </view>
        <view v-if="movement.type !== 'appointment-consumption'" class="movement-row__actions">
          <button :disabled="disabled" @click="emit('edit', movement)">编辑</button>
          <button :disabled="disabled" @click="emit('delete', movement)">删除</button>
        </view>
        <text v-else class="movement-row__readonly">
          {{ movement.appointmentDeleted ? "来源预约已删除" : "预约记录" }}
        </text>
      </view>
    </view>
    <button
      v-if="hasMore"
      class="movement-list__more"
      @click="visibleCount += pageSize"
    >
      加载更多记录
    </button>
  </view>
</template>

<style scoped>
.movement-list {
  margin-top: 34rpx;
}

.movement-list__heading,
.movement-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.movement-list__title {
  color: #1f2a3d;
  font-size: 30rpx;
  font-weight: 700;
}

.movement-list__hint {
  color: #7a8496;
  font-size: 21rpx;
}

.movement-list__records {
  margin-top: 16rpx;
  border: 2rpx solid #e1e6ed;
  border-radius: 16rpx;
  background: #ffffff;
}

.movement-list__more {
  height: 70rpx;
  margin-top: 14rpx;
  border: 2rpx solid #d7deea;
  border-radius: 11rpx;
  background: #f7f9fc;
  color: #526b99;
  font-size: 22rpx;
  line-height: 68rpx;
}

.movement-row {
  min-height: 86rpx;
  margin: 0 22rpx;
  border-bottom: 2rpx solid #eef1f5;
}

.movement-row:last-child {
  border-bottom: 0;
}

.movement-row__copy,
.movement-row__quantity {
  display: flex;
  flex-direction: column;
}

.movement-row__actions {
  display: flex;
  width: 86rpx;
  margin-left: 16rpx;
  flex-direction: column;
  gap: 5rpx;
}

.movement-row__actions button {
  height: 38rpx;
  background: transparent;
  color: #536b96;
  font-size: 19rpx;
  line-height: 38rpx;
}

.movement-row__actions button:last-child {
  color: #9a4a47;
}

.movement-row__readonly {
  width: 92rpx;
  margin-left: 14rpx;
  color: #8a92a1;
  font-size: 18rpx;
  line-height: 1.35;
  text-align: right;
}

.movement-row__name {
  color: #354158;
  font-size: 23rpx;
  font-weight: 600;
}

.movement-row__time,
.movement-row__after {
  margin-top: 5rpx;
  color: #8991a0;
  font-size: 19rpx;
}

.movement-row__quantity {
  align-items: flex-end;
  color: #31549e;
  font-size: 24rpx;
  font-weight: 700;
}
</style>
