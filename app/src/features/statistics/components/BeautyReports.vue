<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { BeautyHomeOverview } from "@/services/statistics-service";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import BeautyReportSummary from "./BeautyReportSummary.vue";
import BeautyServiceContribution from "./BeautyServiceContribution.vue";

defineProps<{
  overview?: DeepReadonly<BeautyHomeOverview>;
  month: Date;
  canSelectNextMonth: boolean;
  loading: boolean;
  errorMessage: string;
}>();

defineEmits<{
  (event: "retry"): void;
  (event: "previousMonth"): void;
  (event: "nextMonth"): void;
}>();
</script>

<template>
  <view class="beauty-reports">
    <view v-if="loading" class="beauty-reports__state">正在读取本月经营数据</view>
    <RecoverableErrorNotice
      v-else-if="errorMessage"
      :message="errorMessage"
      retryable
      @retry="$emit('retry')"
    />
    <template v-else>
      <BeautyReportSummary
        :overview="overview"
        :month="month"
        :can-select-next-month="canSelectNextMonth"
        @previous-month="$emit('previousMonth')"
        @next-month="$emit('nextMonth')"
      />
      <BeautyServiceContribution :contributions="overview?.serviceContributions ?? []" />
    </template>
  </view>
</template>

<style scoped>
.beauty-reports {
  min-height: calc(100vh - 88rpx);
  box-sizing: border-box;
  padding: 30rpx 22rpx calc(150rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 78% 2%, rgba(226, 213, 249, 0.5), transparent 34%),
    linear-gradient(180deg, #fff2f6 0%, #fbf3fa 48%, #fff7f8 100%);
}

.beauty-reports__state {
  padding: 52rpx 28rpx;
  color: #82798a;
  font-size: 24rpx;
  text-align: center;
}
</style>
