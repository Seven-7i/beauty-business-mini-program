<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import type { InventoryItemV1, InventoryMovementV1 } from "@/domain/data-schema";

/** 单个物品库存动态时间线的只读输入。 */
interface InventoryMovementListProps {
  /** 当前详情中的物品，用于展示统一计量单位。 */
  item: InventoryItemV1;
  /** 只属于当前物品且已按发生时间倒序排列的库存动态。 */
  movements: readonly InventoryMovementV1[];
  /** 业务提交期间禁止重复进入记录操作。 */
  disabled: boolean;
}

/** 库存动态时间线向详情容器暴露的记录操作。 */
interface InventoryMovementListEmits {
  /** 请求更正一条手工库存记录。 */
  edit: [movement: InventoryMovementV1];
  /** 请求删除一条手工库存记录并重算后续结余。 */
  delete: [movement: InventoryMovementV1];
  /** 请求查看预约消耗的来源预约。 */
  openAppointment: [movement: InventoryMovementV1];
}

const props = defineProps<InventoryMovementListProps>();
const emit = defineEmits<InventoryMovementListEmits>();
const pageSize = 20;
const visibleCount = shallowRef(pageSize);
const visibleMovements = computed(() =>
  props.movements.slice(0, visibleCount.value),
);
const hasMore = computed(() => visibleCount.value < props.movements.length);

watch(
  () => props.item.id,
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

/** 手工产生的记录可以按现有业务规则更正或删除。 */
function isManualMovement(movement: InventoryMovementV1): boolean {
  return movement.type !== "appointment-consumption";
}

/** 正数补齐加号，负数保留数据自身符号。 */
function formatDelta(value: string): string {
  return value.startsWith("-") ? value : `+${value}`;
}

/** 使用稳定短日期，避免相对时间在页面停留期间失真。 */
function formatOccurredAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const monthDay = [date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
  return `${monthDay} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}
</script>

<template>
  <view class="movement-timeline">
    <view v-if="!movements.length" class="movement-timeline__empty" role="status">
      还没有库存动态
    </view>
    <view v-else class="movement-timeline__panel">
      <view
        v-for="movement in visibleMovements"
        :key="movement.id"
        class="movement-row"
      >
        <view class="movement-row__rail" aria-hidden="true">
          <view class="movement-row__line" />
          <view
            class="movement-row__dot"
            :class="{
              'movement-row__dot--decrease': movement.deltaQuantity.startsWith('-'),
              'movement-row__dot--appointment':
                movement.type === 'appointment-consumption',
            }"
          />
        </view>
        <view class="movement-row__content">
          <view class="movement-row__heading">
            <view class="movement-row__identity">
              <text class="movement-row__type">
                {{ movementLabels[movement.type] }}
              </text>
              <text class="movement-row__time">
                {{ formatOccurredAt(movement.occurredAt) }}
              </text>
            </view>
            <view v-if="isManualMovement(movement)" class="movement-row__actions">
              <button :disabled="disabled" @click="emit('edit', movement)">
                编辑
              </button>
              <view class="movement-row__action-divider" aria-hidden="true" />
              <button :disabled="disabled" @click="emit('delete', movement)">
                删除
              </button>
            </view>
          </view>
          <text
            class="movement-row__delta"
            :class="{
              'movement-row__delta--decrease':
                movement.deltaQuantity.startsWith('-'),
            }"
          >
            {{ formatDelta(movement.deltaQuantity) }} {{ item.unit }}
          </text>
          <text class="movement-row__balance">
            {{ movement.beforeQuantity }} → {{ movement.afterQuantity }}
          </text>
          <text v-if="movement.note" class="movement-row__note">
            {{ movement.note }}
          </text>
          <button
            v-if="movement.type === 'appointment-consumption' && movement.appointmentId && !movement.appointmentDeleted"
            class="movement-row__source"
            :disabled="disabled"
            @click="emit('openAppointment', movement)"
          >
            <text>查看来源预约</text>
            <u-icon name="arrow-right" color="#766E74" size="16" />
          </button>
          <text
            v-else-if="movement.type === 'appointment-consumption' && movement.appointmentDeleted"
            class="movement-row__deleted-source"
          >
            来源预约已删除
          </text>
        </view>
      </view>
    </view>
    <button
      v-if="hasMore"
      class="movement-timeline__more"
      @click="visibleCount += pageSize"
    >
      加载更多动态
    </button>
  </view>
</template>

<style scoped>
.movement-timeline { padding-top: 22rpx; }
.movement-timeline__panel { overflow: hidden; border: 2rpx solid rgba(136, 103, 126, 0.08); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 14rpx 36rpx rgba(111, 76, 99, 0.06); }
.movement-timeline__empty { padding: 52rpx 28rpx; border: 2rpx dashed #ded3dc; border-radius: 22rpx; background: rgba(255, 253, 253, 0.72); color: #837a81; font-size: 23rpx; text-align: center; }
.movement-row { display: flex; min-height: 210rpx; padding: 0 28rpx 0 20rpx; }
.movement-row__rail { position: relative; width: 42rpx; flex: none; }
.movement-row__line { position: absolute; top: 0; bottom: 0; left: 18rpx; width: 2rpx; background: rgba(127, 117, 124, 0.2); }
.movement-row:first-child .movement-row__line { top: 34rpx; }
.movement-row:last-child .movement-row__line { bottom: calc(100% - 36rpx); }
.movement-row__dot { position: absolute; z-index: 1; top: 30rpx; left: 10rpx; width: 16rpx; height: 16rpx; border: 4rpx solid #fffdfd; border-radius: 999rpx; background: #4c9f71; box-shadow: 0 0 0 2rpx #4c9f71; }
.movement-row__dot--decrease { background: #d45d68; box-shadow: 0 0 0 2rpx #d45d68; }
.movement-row__dot--appointment { background: #8664c6; box-shadow: 0 0 0 2rpx #8664c6; }
.movement-row__content { min-width: 0; flex: 1; padding: 26rpx 0 24rpx 8rpx; border-bottom: 2rpx solid rgba(137, 123, 132, 0.14); }
.movement-row:last-child .movement-row__content { border-bottom: 0; }
.movement-row__heading, .movement-row__identity, .movement-row__actions, .movement-row__source { display: flex; align-items: center; }
.movement-row__heading { justify-content: space-between; gap: 16rpx; }
.movement-row__identity { min-width: 0; gap: 16rpx; flex-wrap: wrap; }
.movement-row__type { color: #292428; font-size: 26rpx; font-weight: 700; }
.movement-row__time { color: #918a90; font-size: 20rpx; font-variant-numeric: tabular-nums; }
.movement-row__actions { flex: none; gap: 12rpx; }
.movement-row__actions button { min-height: 56rpx; margin: 0; padding: 8rpx 4rpx; border: 0; background: transparent; color: #6a43b0; font-size: 21rpx; line-height: 1.2; }
.movement-row__action-divider { width: 2rpx; height: 24rpx; background: rgba(137, 123, 132, 0.2); }
.movement-row__delta, .movement-row__balance, .movement-row__note { display: block; overflow-wrap: anywhere; }
.movement-row__delta { margin-top: 12rpx; color: #4c9f71; font-size: 28rpx; font-weight: 650; font-variant-numeric: tabular-nums; }
.movement-row__delta--decrease { color: #d45d68; }
.movement-row__balance { margin-top: 8rpx; color: #6f686d; font-size: 23rpx; font-variant-numeric: tabular-nums; }
.movement-row__note { margin-top: 8rpx; color: #8a8188; font-size: 21rpx; line-height: 1.45; }
.movement-row__source { width: 100%; min-height: 58rpx; justify-content: space-between; margin: 10rpx 0 0; padding: 8rpx 0 0; border: 0; background: transparent; color: #6a43b0; font-size: 21rpx; text-align: left; }
.movement-row__deleted-source { display: block; margin-top: 12rpx; color: #918a90; font-size: 20rpx; }
.movement-timeline__more { min-height: 72rpx; margin-top: 16rpx; border: 2rpx solid rgba(106, 67, 176, 0.18); border-radius: 16rpx; background: rgba(255, 255, 255, 0.78); color: #6a43b0; font-size: 22rpx; line-height: 1.3; }

@media (max-width: 360px) {
  .movement-row { padding-right: 22rpx; }
  .movement-row__heading { align-items: flex-start; }
  .movement-row__actions { gap: 8rpx; }
}
</style>
