<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { InventoryItemV1 } from "@/domain/data-schema";
import type { InventoryItemStockSummary } from "../composables/useInventoryManagement";

defineEmits<{
  (event: "adjust", item: InventoryItemV1): void;
  (event: "edit", item: InventoryItemV1): void;
  (event: "toggle-status", item: InventoryItemV1): void;
  (event: "delete", item: InventoryItemV1): void;
}>();

const props = defineProps<{
  summaries: readonly InventoryItemStockSummary[];
  disabled: boolean;
}>();

const activeCount = computed(
  () => props.summaries.filter(({ item }) => item.status === "active").length,
);
const query = shallowRef("");
const statusFilter = shallowRef<"all" | "active" | "inactive">("all");
const statusOptions = ["全部状态", "仅启用", "仅停用"];
const visibleSummaries = computed(() => {
  const normalizedQuery = query.value.trim();
  return props.summaries.filter(({ item }) => {
    const matchesStatus =
      statusFilter.value === "all" || item.status === statusFilter.value;
    const matchesQuery =
      !normalizedQuery ||
      item.name.includes(normalizedQuery) ||
      item.unit.includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
});

function selectStatus(event: { detail: { value: string } }): void {
  const index = Number(event.detail.value);
  statusFilter.value = index === 1 ? "active" : index === 2 ? "inactive" : "all";
}
</script>

<template>
  <view class="item-list">
    <view class="item-list__heading">
      <text class="item-list__title">当前库存</text>
      <text class="item-list__count">{{ activeCount }} 种启用物品</text>
    </view>

    <view class="item-list__filters">
      <input v-model="query" maxlength="40" placeholder="搜索名称或单位" />
      <picker :range="statusOptions" @change="selectStatus">
        <view class="item-list__status-filter">
          {{ statusFilter === "active" ? "仅启用" : statusFilter === "inactive" ? "仅停用" : "全部状态" }}
        </view>
      </picker>
    </view>

    <view v-if="summaries.length === 0" class="item-list__empty">
      <text class="item-list__empty-title">还没有库存物品</text>
      <text class="item-list__empty-copy">先新增常用物品，后续项目可设置默认用量。</text>
    </view>
    <view v-else-if="visibleSummaries.length === 0" class="item-list__empty">
      没有符合当前搜索和状态条件的物品。
    </view>
    <view v-else class="item-list__records">
      <view v-for="summary in visibleSummaries" :key="summary.item.id" class="item-card">
        <view class="item-card__copy">
          <view class="item-card__name-line">
            <text class="item-card__name">{{ summary.item.name }}</text>
            <text v-if="summary.item.status === 'inactive'" class="item-card__status">已停用</text>
          </view>
          <text class="item-card__note">
            占用 {{ summary.occupiedQuantity }} · 可用 {{ summary.availableQuantity }}{{ summary.item.unit }}
          </text>
        </view>
        <view class="item-card__quantity">
          <text class="item-card__number">{{ summary.item.currentQuantity }}</text>
          <text class="item-card__unit">{{ summary.item.unit }}</text>
        </view>
        <view class="item-card__actions">
          <button
            v-if="summary.item.status === 'active'"
            class="item-card__action"
            :disabled="disabled"
            @click="$emit('adjust', summary.item)"
          >调整</button>
          <button class="item-card__action" :disabled="disabled" @click="$emit('edit', summary.item)">
            编辑
          </button>
          <button class="item-card__status-action" :disabled="disabled" @click="$emit('toggle-status', summary.item)">
            {{ summary.item.status === "active" ? "停用" : "启用" }}
          </button>
          <button class="item-card__delete-action" :disabled="disabled" @click="$emit('delete', summary.item)">
            删除
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.item-list {
  margin-top: 34rpx;
}

.item-list__heading,
.item-card {
  display: flex;
  align-items: center;
}

.item-list__heading {
  justify-content: space-between;
  padding: 0 4rpx;
}

.item-list__title {
  color: #1f2a3d;
  font-size: 30rpx;
  font-weight: 700;
}

.item-list__count {
  color: #7a8496;
  font-size: 22rpx;
}

.item-list__filters {
  display: flex;
  gap: 14rpx;
  margin-top: 16rpx;
}

.item-list__filters input,
.item-list__status-filter {
  height: 66rpx;
  box-sizing: border-box;
  padding: 0 18rpx;
  border: 2rpx solid #dce2ea;
  border-radius: 11rpx;
  background: #ffffff;
  color: #4c5870;
  font-size: 22rpx;
  line-height: 64rpx;
}

.item-list__filters input {
  min-width: 0;
  flex: 1;
}

.item-list__filters picker {
  width: 154rpx;
}

.item-list__empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  margin-top: 20rpx;
  padding: 54rpx 34rpx;
  border: 2rpx dashed #ccd4e0;
  border-radius: 18rpx;
  color: #788397;
  text-align: center;
}

.item-list__empty-title {
  color: #465168;
  font-size: 27rpx;
  font-weight: 600;
}

.item-list__empty-copy {
  margin-top: 12rpx;
  font-size: 23rpx;
  line-height: 1.6;
}

.item-list__records {
  margin-top: 18rpx;
}

.item-card {
  min-height: 112rpx;
  margin-bottom: 16rpx;
  padding: 22rpx 20rpx 22rpx 24rpx;
  border: 2rpx solid #e1e6ed;
  border-radius: 16rpx;
  background: #ffffff;
}

.item-card__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.item-card__name {
  overflow: hidden;
  color: #263248;
  font-size: 27rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-card__name-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10rpx;
}

.item-card__status {
  flex: none;
  padding: 3rpx 8rpx;
  border-radius: 6rpx;
  background: #eceff4;
  color: #747e8e;
  font-size: 18rpx;
}

.item-card__note {
  overflow: hidden;
  margin-top: 8rpx;
  color: #858d9c;
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-card__quantity {
  display: flex;
  align-items: baseline;
  margin: 0 22rpx;
}

.item-card__number {
  color: #244f9e;
  font-size: 33rpx;
  font-weight: 700;
}

.item-card__unit {
  margin-left: 5rpx;
  color: #68748a;
  font-size: 21rpx;
}

.item-card__actions {
  display: flex;
  width: 108rpx;
  flex-direction: column;
  gap: 8rpx;
}

.item-card__action,
.item-card__status-action,
.item-card__delete-action {
  width: 108rpx;
  height: 48rpx;
  padding: 0;
  border: 2rpx solid #9eb1d8;
  border-radius: 12rpx;
  background: #f5f7fc;
  color: #31549e;
  font-size: 23rpx;
  line-height: 46rpx;
}

.item-card__delete-action {
  color: #9a4a47;
}

.item-card__status-action {
  background: transparent;
  color: #737d8e;
  font-size: 21rpx;
}
</style>
