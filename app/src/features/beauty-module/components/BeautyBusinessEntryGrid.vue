<script setup lang="ts">
import type { AppIconName } from "@/features/shared/components/AppIcon.vue";
import AppIcon from "@/features/shared/components/AppIcon.vue";

const emit = defineEmits<{
  (event: "open-inventory"): void;
  (event: "open-projects"): void;
  (event: "open-customers"): void;
  (event: "open-appointments"): void;
}>();

const entries: readonly {
  id: string;
  label: string;
  icon: AppIconName;
  activate: () => void;
}[] = [
  {
    id: "appointments",
    label: "预约执行",
    icon: "appointment",
    activate: () => emit("open-appointments"),
  },
  {
    id: "customers",
    label: "顾客管理",
    icon: "customer",
    activate: () => emit("open-customers"),
  },
  {
    id: "projects",
    label: "服务项目",
    icon: "projects",
    activate: () => emit("open-projects"),
  },
  {
    id: "inventory",
    label: "物品库存",
    icon: "inventory",
    activate: () => emit("open-inventory"),
  },
];
</script>

<template>
  <section class="business-entries" aria-labelledby="beauty-entries-heading">
    <text id="beauty-entries-heading" class="business-entries__title">业务入口</text>
    <view class="business-entries__grid">
      <button
        v-for="entry in entries"
        :key="entry.id"
        class="business-entry"
        :aria-label="entry.label"
        @click="entry.activate"
      >
        <AppIcon :name="entry.icon" :size="31" />
        <text class="business-entry__label">{{ entry.label }}</text>
      </button>
    </view>
  </section>
</template>

<style scoped>
.business-entries {
  margin-top: 34rpx;
  padding: 30rpx 20rpx 24rpx;
  border: 2rpx solid rgba(143, 108, 132, 0.08);
  border-radius: 24rpx;
  background: #fffdfd;
  box-shadow: 0 14rpx 38rpx rgba(119, 75, 103, 0.07);
}

.business-entries__title {
  display: block;
  padding: 0 8rpx 24rpx;
  color: #28232a;
  font-size: 31rpx;
  font-weight: 700;
}

.business-entries__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.business-entry {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 142rpx;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 14rpx 8rpx;
  background: transparent;
  color: #7f5aa0;
  flex-direction: column;
}

.business-entry + .business-entry::before {
  position: absolute;
  top: 18rpx;
  bottom: 18rpx;
  left: 0;
  width: 2rpx;
  background: #eee7ec;
  content: "";
}

.business-entry__label {
  color: #383138;
  font-size: 22rpx;
  line-height: 1.35;
  text-align: center;
}

@media (max-width: 340px) {
  .business-entry {
    min-height: 132rpx;
    gap: 12rpx;
  }

  .business-entry__label {
    font-size: 20rpx;
  }
}
</style>
