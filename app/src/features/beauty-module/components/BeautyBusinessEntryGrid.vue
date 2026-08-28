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
        hover-class="business-entry--pressed"
        :hover-start-time="20"
        :hover-stay-time="80"
        @click="entry.activate"
      >
        <view class="business-entry__icon" aria-hidden="true">
          <AppIcon :name="entry.icon" :size="26" />
        </view>
        <text class="business-entry__label">{{ entry.label }}</text>
        <AppIcon name="chevron-right" :size="17" color="#968B93" />
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.business-entry {
  display: flex;
  min-width: 0;
  min-height: 116rpx;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 16rpx;
  border: 2rpx solid #eadfe7;
  border-radius: 19rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 20rpx rgba(111, 76, 99, 0.08);
  color: #7f5aa0;
  text-align: left;
  transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
}

.business-entry--pressed {
  border-color: #d9c3dc;
  background: #f8f0f7;
  transform: scale(0.98);
}

.business-entry__icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #eadced;
  border-radius: 17rpx;
  background: #f4ebf5;
  color: #7f5aa0;
  line-height: 0;
}

.business-entry__label {
  min-width: 0;
  flex: 1;
  color: #383138;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

@media (max-width: 360px) {
  .business-entry {
    gap: 10rpx;
    padding-right: 12rpx;
    padding-left: 12rpx;
  }

  .business-entry__icon {
    width: 58rpx;
    height: 58rpx;
  }

  .business-entry__label {
    font-size: 20rpx;
  }
}
</style>
