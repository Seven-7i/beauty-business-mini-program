<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import type { BeautyHomeOverview } from "@/services/statistics-service";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";

const props = defineProps<{
  overview?: DeepReadonly<BeautyHomeOverview>;
  customers: readonly DeepReadonly<CustomerV1>[];
  loading: boolean;
  errorMessage: string;
}>();

defineEmits<{
  (event: "open-inventory"): void;
  (event: "open-projects"): void;
  (event: "open-customers"): void;
  (event: "open-appointments"): void;
  (event: "retry"): void;
}>();

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function customerName(customerId: string): string {
  return props.customers.find(({ id }) => id === customerId)?.nickname ?? "顾客已删除";
}

function formatSchedule(scheduledAt: string): string {
  const value = new Date(scheduledAt);
  return `${value.getMonth() + 1}月${value.getDate()}日 ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function reminderLabel(group: "overdue" | "today" | "next-three-days"): string {
  return group === "overdue" ? "已逾期" : group === "today" ? "今天" : "未来三天";
}
</script>

<template>
  <view class="beauty-home">
    <view class="beauty-home__intro">
      <text class="beauty-home__eyebrow">庄月空间 · 美容</text>
      <text class="beauty-home__title">经营管理</text>
      <text class="beauty-home__description">从预约源记录实时汇总，不保存可重复计算的统计副本。</text>
    </view>

    <view class="beauty-home__metrics">
      <view class="metric-card">
        <text class="metric-card__value">{{ overview?.monthlyCompletedCount ?? 0 }}</text>
        <text class="metric-card__label">本月完成</text>
      </view>
      <view class="metric-card metric-card--wide">
        <text class="metric-card__value">{{ formatCurrency(overview?.monthlyTransactionAmountCents ?? 0) }}</text>
        <text class="metric-card__label">本月成交</text>
      </view>
      <view class="metric-card">
        <text class="metric-card__value">{{ overview?.pendingCount ?? 0 }}</text>
        <text class="metric-card__label">待执行</text>
      </view>
    </view>

    <view class="beauty-home__section beauty-home__reminders">
      <view class="beauty-home__section-heading">
        <text class="beauty-home__section-title">近期预约</text>
        <button @click="$emit('open-appointments')">查看全部</button>
      </view>
      <view v-if="loading" class="reminder-empty">正在读取本机预约</view>
      <RecoverableErrorNotice
        v-else-if="errorMessage"
        :message="errorMessage"
        retryable
        @retry="$emit('retry')"
      />
      <view v-else-if="!overview?.reminders.length" class="reminder-empty">暂无逾期、今天或未来三天的待执行预约</view>
      <button v-for="reminder in overview?.reminders ?? []" :key="reminder.appointment.id" class="reminder-row" @click="$emit('open-appointments')">
        <text class="reminder-row__badge" :class="{ 'reminder-row__badge--overdue': reminder.group === 'overdue' }">{{ reminderLabel(reminder.group) }}</text>
        <view class="reminder-row__copy">
          <text class="reminder-row__customer">{{ customerName(reminder.appointment.customerId) }}</text>
          <text class="reminder-row__meta">{{ formatSchedule(reminder.appointment.scheduledAt) }} · {{ reminder.appointment.projectSnapshots.map(({ name }) => name).join('、') }}</text>
        </view>
        <text class="feature-row__arrow">›</text>
      </button>
    </view>

    <view class="beauty-home__section">
      <text class="beauty-home__section-title">基础资料</text>
      <button class="feature-row" @click="$emit('open-inventory')">
        <view class="feature-row__mark">库</view>
        <view class="feature-row__copy">
          <text class="feature-row__title">物品库存</text>
          <text class="feature-row__meta">库存数量、预约占用、补货、盘点和变动记录</text>
        </view>
        <text class="feature-row__arrow">›</text>
      </button>
      <button class="feature-row" @click="$emit('open-projects')">
        <view class="feature-row__mark feature-row__mark--project">项</view>
        <view class="feature-row__copy">
          <text class="feature-row__title">服务项目</text>
          <text class="feature-row__meta">标准价格、预计时长和默认物品用量</text>
        </view>
        <text class="feature-row__arrow">›</text>
      </button>
      <button class="feature-row" @click="$emit('open-customers')">
        <view class="feature-row__mark feature-row__mark--customer">客</view>
        <view class="feature-row__copy">
          <text class="feature-row__title">顾客管理</text>
          <text class="feature-row__meta">唯一昵称、完整手机号和多个服务地址</text>
        </view>
        <text class="feature-row__arrow">›</text>
      </button>
    </view>

    <view class="beauty-home__section beauty-home__section--later">
      <text class="beauty-home__section-title">业务执行</text>
      <button class="feature-row" @click="$emit('open-appointments')">
        <view class="feature-row__mark feature-row__mark--appointment">约</view>
        <view class="coming-row__copy">
          <text class="coming-row__title">预约执行</text>
          <text class="coming-row__meta">多项目、地址快照、库存占用和时间冲突</text>
        </view>
        <text class="feature-row__arrow">›</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.beauty-home {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 44rpx 28rpx calc(150rpx + env(safe-area-inset-bottom));
}

.beauty-home__intro {
  display: flex;
  padding: 0 8rpx;
  flex-direction: column;
}

.beauty-home__eyebrow {
  color: #31549e;
  font-size: 22rpx;
  font-weight: 600;
}

.beauty-home__title {
  margin-top: 14rpx;
  color: #1a2538;
  font-size: 43rpx;
  font-weight: 700;
}

.beauty-home__description {
  margin-top: 12rpx;
  color: #727d90;
  font-size: 24rpx;
}

.beauty-home__metrics {
  display: grid;
  grid-template-columns: 1fr 1.35fr 1fr;
  gap: 12rpx;
  margin-top: 30rpx;
}

.metric-card {
  display: flex;
  min-width: 0;
  padding: 22rpx 12rpx;
  border: 2rpx solid #dfe5ec;
  border-radius: 17rpx;
  background: #ffffff;
  flex-direction: column;
  text-align: center;
}

.metric-card__value {
  color: #263650;
  font-size: 29rpx;
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.metric-card__label {
  margin-top: 7rpx;
  color: #7b8492;
  font-size: 19rpx;
}

.beauty-home__section {
  margin-top: 40rpx;
}

.beauty-home__section-title {
  display: block;
  margin-bottom: 16rpx;
  padding: 0 6rpx;
  color: #4b566b;
  font-size: 23rpx;
  font-weight: 700;
}

.beauty-home__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.beauty-home__section-heading button {
  min-height: 64rpx;
  margin: -12rpx 0 4rpx;
  padding: 0 12rpx;
  background: transparent;
  color: #31549e;
  font-size: 21rpx;
  line-height: 64rpx;
}

.reminder-empty {
  padding: 24rpx;
  border: 2rpx dashed #d7dde5;
  border-radius: 16rpx;
  color: #7b8492;
  font-size: 21rpx;
  line-height: 1.5;
  text-align: center;
}

.reminder-row {
  display: flex;
  width: 100%;
  min-height: 104rpx;
  box-sizing: border-box;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 12rpx;
  padding: 18rpx 20rpx;
  border: 2rpx solid #e0e5ec;
  border-radius: 16rpx;
  background: #ffffff;
  text-align: left;
}

.reminder-row__badge {
  flex: none;
  padding: 7rpx 10rpx;
  border-radius: 8rpx;
  background: #e9f0ec;
  color: #426654;
  font-size: 18rpx;
}

.reminder-row__badge--overdue {
  background: #fae9e7;
  color: #984943;
}

.reminder-row__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.reminder-row__customer {
  color: #28344a;
  font-size: 24rpx;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.reminder-row__meta {
  margin-top: 7rpx;
  color: #788397;
  font-size: 19rpx;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.feature-row {
  display: flex;
  width: 100%;
  min-height: 126rpx;
  align-items: center;
  margin-bottom: 16rpx;
  padding: 22rpx 24rpx;
  border: 2rpx solid #e0e5ec;
  border-radius: 18rpx;
  background: #ffffff;
  text-align: left;
}

.feature-row__mark {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: #e4ebfa;
  color: #3159b5;
  font-size: 27rpx;
  font-weight: 700;
}

.feature-row__mark--project {
  background: #e8eef3;
  color: #465d76;
}

.feature-row__mark--customer {
  background: #f2e9e5;
  color: #8a5948;
}

.feature-row__mark--appointment {
  background: #e8f0ed;
  color: #3f6f60;
}

.feature-row__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  margin-left: 20rpx;
  flex-direction: column;
}

.feature-row__title,
.coming-row__title {
  color: #263248;
  font-size: 28rpx;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.feature-row__meta,
.coming-row__meta {
  margin-top: 7rpx;
  color: #788397;
  font-size: 21rpx;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.feature-row__arrow {
  flex: none;
  margin-left: 14rpx;
  color: #6c7789;
  font-size: 46rpx;
  font-weight: 300;
}

@media (max-width: 360px) {
  .beauty-home__metrics {
    grid-template-columns: 1fr 1fr;
  }

  .metric-card--wide {
    grid-column: 1 / -1;
    grid-row: 1;
  }
}

.beauty-home__section--later {
  margin-top: 34rpx;
}

.coming-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border: 2rpx dashed #ced5df;
  border-radius: 16rpx;
  background: #f5f7fa;
}

.coming-row__copy {
  display: flex;
  flex-direction: column;
}

.coming-row__status {
  flex: none;
  margin-left: 20rpx;
  padding: 6rpx 12rpx;
  border-radius: 8rpx;
  background: #e8ebf0;
  color: #747e8e;
  font-size: 19rpx;
}
</style>
