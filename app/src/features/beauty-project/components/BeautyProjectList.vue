<script setup lang="ts">
import { computed, shallowRef, type DeepReadonly } from "vue";
import type { BeautyProjectV1, InventoryItemV1 } from "@/domain/data-schema";

const props = defineProps<{
  projects: readonly DeepReadonly<BeautyProjectV1>[];
  inventoryItems: readonly InventoryItemV1[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  (event: "edit", project: DeepReadonly<BeautyProjectV1>): void;
  (event: "toggle-status", project: DeepReadonly<BeautyProjectV1>): void;
  (event: "delete", project: DeepReadonly<BeautyProjectV1>): void;
}>();

const activeCount = computed(
  () => props.projects.filter((project) => project.status === "active").length,
);
const query = shallowRef("");
const statusFilter = shallowRef<"all" | "active" | "inactive">("all");
const statusOptions = ["全部状态", "仅启用", "仅停用"];
const visibleProjects = computed(() => {
  const normalizedQuery = query.value.trim();
  return props.projects.filter(
    (project) =>
      (statusFilter.value === "all" || project.status === statusFilter.value) &&
      (!normalizedQuery || project.name.includes(normalizedQuery)),
  );
});

function selectStatus(event: { detail: { value: string } }): void {
  const index = Number(event.detail.value);
  statusFilter.value = index === 1 ? "active" : index === 2 ? "inactive" : "all";
}

function formatPrice(cents: number): string {
  return `￥${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function usageSummary(project: DeepReadonly<BeautyProjectV1>): string {
  if (project.defaultUsages.length === 0) {
    return "未设置默认物品用量";
  }
  return project.defaultUsages
    .map((usage) => {
      const item = props.inventoryItems.find(
        (candidate) => candidate.id === usage.inventoryItemId,
      );
      return item
        ? `${item.name} ${usage.quantity}${item.unit}`
        : `已停用物品 ${usage.quantity}`;
    })
    .join(" · ");
}
</script>

<template>
  <view class="project-list">
    <view class="project-list__heading">
      <text class="project-list__title">当前项目</text>
      <text class="project-list__count">{{ activeCount }} 个启用项目</text>
    </view>
    <view class="project-list__filters">
      <input v-model="query" maxlength="40" placeholder="搜索项目名称" />
      <picker :range="statusOptions" @change="selectStatus">
        <view class="project-list__status-filter">
          {{ statusFilter === "active" ? "仅启用" : statusFilter === "inactive" ? "仅停用" : "全部状态" }}
        </view>
      </picker>
    </view>
    <view v-if="projects.length === 0" class="project-list__empty">
      还没有服务项目，新增后即可用于后续预约。
    </view>
    <view v-else-if="visibleProjects.length === 0" class="project-list__empty">
      没有符合当前搜索和状态条件的项目。
    </view>
    <view v-else class="project-list__records">
      <view v-for="project in visibleProjects" :key="project.id" class="project-card">
        <view class="project-card__top">
          <view class="project-card__name-line">
            <text class="project-card__name">{{ project.name }}</text>
            <text v-if="project.status === 'inactive'" class="project-card__status">已停用</text>
          </view>
          <text class="project-card__price">{{ formatPrice(project.standardPriceCents) }}</text>
        </view>
        <text class="project-card__duration">预计 {{ project.durationMinutes }} 分钟</text>
        <text class="project-card__usage">{{ usageSummary(project) }}</text>
        <view class="project-card__actions">
          <button :disabled="disabled" @click="emit('edit', project)">编辑</button>
          <button :disabled="disabled" @click="emit('toggle-status', project)">
            {{ project.status === "active" ? "停用" : "启用" }}
          </button>
          <button class="project-card__delete" :disabled="disabled" @click="emit('delete', project)">
            删除
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.project-list {
  margin-top: 34rpx;
}

.project-list__heading,
.project-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project-list__title {
  color: #1f2a3d;
  font-size: 30rpx;
  font-weight: 700;
}

.project-list__count {
  color: #7a8496;
  font-size: 22rpx;
}

.project-list__filters {
  display: flex;
  gap: 14rpx;
  margin-top: 16rpx;
}

.project-list__filters input,
.project-list__status-filter {
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

.project-list__filters input {
  min-width: 0;
  flex: 1;
}

.project-list__filters picker {
  width: 154rpx;
}

.project-list__empty {
  margin-top: 18rpx;
  padding: 50rpx 30rpx;
  border: 2rpx dashed #ccd4e0;
  border-radius: 18rpx;
  color: #788397;
  font-size: 23rpx;
  line-height: 1.6;
  text-align: center;
}

.project-list__records {
  margin-top: 18rpx;
}

.project-card {
  display: flex;
  margin-bottom: 16rpx;
  padding: 24rpx;
  border: 2rpx solid #e1e6ed;
  border-radius: 16rpx;
  background: #ffffff;
  flex-direction: column;
}

.project-card__name {
  color: #263248;
  font-size: 27rpx;
  font-weight: 700;
}

.project-card__name-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10rpx;
}

.project-card__status {
  padding: 3rpx 8rpx;
  border-radius: 6rpx;
  background: #eceff4;
  color: #747e8e;
  font-size: 18rpx;
}

.project-card__price {
  color: #244f9e;
  font-size: 27rpx;
  font-weight: 700;
}

.project-card__duration,
.project-card__usage {
  margin-top: 9rpx;
  color: #68748a;
  font-size: 22rpx;
}

.project-card__actions {
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
}

.project-card__actions button {
  width: 112rpx;
  height: 54rpx;
  border: 2rpx solid #bac7de;
  border-radius: 10rpx;
  background: #f5f7fb;
  color: #3f5f99;
  font-size: 21rpx;
  line-height: 52rpx;
}

.project-card__actions .project-card__delete {
  color: #9a4a47;
}

.project-card__usage {
  color: #818a9a;
  line-height: 1.5;
}
</style>
