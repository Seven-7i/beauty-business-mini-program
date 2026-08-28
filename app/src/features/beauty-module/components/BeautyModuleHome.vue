<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import type { BeautyHomeOverview } from "@/services/statistics-service";
import BeautyAppointmentReminders from "./BeautyAppointmentReminders.vue";
import BeautyBusinessEntryGrid from "./BeautyBusinessEntryGrid.vue";
import BeautyHomeOverviewCard from "./BeautyHomeOverview.vue";

defineProps<{
  overview?: DeepReadonly<BeautyHomeOverview>;
  customers: readonly DeepReadonly<CustomerV1>[];
  loading: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  (event: "open-inventory"): void;
  (event: "open-projects"): void;
  (event: "open-customers"): void;
  (event: "open-appointments"): void;
  (event: "retry"): void;
}>();
</script>

<template>
  <main class="beauty-home">
    <view class="beauty-home__glow beauty-home__glow--rose" aria-hidden="true" />
    <view class="beauty-home__glow beauty-home__glow--lavender" aria-hidden="true" />

    <header class="beauty-home__intro">
      <text class="beauty-home__eyebrow">庄月空间 · 美容</text>
      <text class="beauty-home__title">经营管理</text>
    </header>

    <BeautyHomeOverviewCard
      :overview="overview"
      :loading="loading"
      :error-message="errorMessage"
    />
    <BeautyAppointmentReminders
      :reminders="overview?.reminders ?? []"
      :customers="customers"
      :loading="loading"
      :error-message="errorMessage"
      @open-appointments="emit('open-appointments')"
      @retry="emit('retry')"
    />
    <BeautyBusinessEntryGrid
      @open-inventory="emit('open-inventory')"
      @open-projects="emit('open-projects')"
      @open-customers="emit('open-customers')"
      @open-appointments="emit('open-appointments')"
    />
  </main>
</template>

<style scoped>
.beauty-home {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  padding: 46rpx 30rpx calc(172rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 46%, #f8f4f7 100%);
}

.beauty-home__glow {
  position: absolute;
  z-index: 0;
  border-radius: 999rpx;
  pointer-events: none;
}

.beauty-home__glow--rose {
  top: -100rpx;
  right: -180rpx;
  width: 520rpx;
  height: 520rpx;
  background: radial-gradient(circle, rgba(244, 205, 220, 0.5) 0%, rgba(244, 205, 220, 0) 70%);
}

.beauty-home__glow--lavender {
  top: 170rpx;
  right: -120rpx;
  width: 430rpx;
  height: 300rpx;
  background: radial-gradient(circle, rgba(219, 198, 237, 0.42) 0%, rgba(219, 198, 237, 0) 72%);
}

.beauty-home__intro {
  position: relative;
  z-index: 1;
  display: flex;
  padding: 6rpx 10rpx 36rpx;
  flex-direction: column;
}

.beauty-home__eyebrow {
  color: #9b72a4;
  font-size: 24rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.beauty-home__title {
  margin-top: 22rpx;
  color: #282329;
  font-size: 58rpx;
  font-weight: 750;
  letter-spacing: 2rpx;
  line-height: 1.15;
}

@media (max-width: 360px) {
  .beauty-home {
    padding-right: 24rpx;
    padding-left: 24rpx;
  }

  .beauty-home__title {
    font-size: 52rpx;
  }
}
</style>
