<script setup lang="ts">
import { computed } from "vue";
import type { DeepReadonly } from "vue";
import AppIcon from "@/features/shared/components/AppIcon.vue";
import type { AppIconName } from "@/features/shared/components/AppIcon.vue";
import type { BeautyServiceContribution } from "@/services/statistics-service";

const props = defineProps<{
  contributions: DeepReadonly<readonly BeautyServiceContribution[]>;
}>();

const visibleContributions = computed(() => props.contributions.slice(0, 3));
const maximumAmount = computed(() => visibleContributions.value[0]?.transactionAmountCents ?? 1);
const totalAmount = computed(() => props.contributions.reduce((sum, entry) => sum + entry.transactionAmountCents, 0));
const icons: readonly AppIconName[] = ["projects", "customer", "reports"];

/** 将分转换为服务贡献列表使用的人民币文本。 */
function formatStatisticsCurrency(cents: number): string {
  const fixed = (cents / 100).toFixed(2);
  return fixed.endsWith(".00") ? `¥${fixed.slice(0, -3)}` : `¥${fixed}`;
}

/** 以当月最高贡献为视觉基准，最小宽度保证小值仍可识别。 */
function contributionWidth(cents: number): string {
  return `${Math.max(8, Math.round((cents / maximumAmount.value) * 100))}%`;
}

/** 计算单项服务占当月服务贡献金额的比例。 */
function contributionPercent(cents: number): number {
  return Math.round((cents / (totalAmount.value || 1)) * 100);
}
</script>

<template>
  <view class="service-contribution">
    <text class="service-contribution__title">服务贡献</text>
    <view v-if="visibleContributions.length" class="service-contribution__list">
      <view v-for="(item, index) in visibleContributions" :key="item.name" class="service-contribution__row">
        <view class="service-contribution__icon"><AppIcon :name="icons[index]" :size="30" /></view>
        <view class="service-contribution__body">
          <view class="service-contribution__heading">
            <view class="service-contribution__name"><text class="service-contribution__rank">{{ index + 1 }}</text><text>{{ item.name }}</text></view>
            <text class="service-contribution__percent">{{ contributionPercent(item.transactionAmountCents) }}%</text>
          </view>
          <text class="service-contribution__meta">{{ item.completedCount }} 单　{{ formatStatisticsCurrency(item.transactionAmountCents) }}</text>
          <view class="service-contribution__track"><view class="service-contribution__bar" :style="{ width: contributionWidth(item.transactionAmountCents) }" /></view>
        </view>
      </view>
    </view>
    <view v-else class="service-contribution__empty">
      <text class="service-contribution__empty-copy">本月完成服务后，这里会显示服务贡献。</text>
    </view>
  </view>
</template>

<style scoped>
.service-contribution { margin-top: 28rpx; padding: 34rpx 28rpx 26rpx; border: 2rpx solid rgba(255,255,255,.9); border-radius: 28rpx; background: rgba(255,255,255,.9); box-shadow: 0 18rpx 48rpx rgba(142,99,135,.08); }
.service-contribution__title { display: block; color: #21182f; font-size: 34rpx; font-weight: 700; line-height: 1.25; }
.service-contribution__row { display: flex; align-items: center; gap: 22rpx; padding: 28rpx 0; }
.service-contribution__row + .service-contribution__row { border-top: 2rpx solid #f0ebf2; }
.service-contribution__icon { display: flex; width: 72rpx; height: 72rpx; align-items: center; justify-content: center; border-radius: 50%; background: #f4edfc; color: #8358d7; flex: none; }
.service-contribution__body { min-width: 0; flex: 1; }
.service-contribution__heading { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.service-contribution__name { display: flex; min-width: 0; align-items: center; gap: 14rpx; color: #21182f; font-size: 28rpx; font-weight: 650; }
.service-contribution__rank { display: inline-flex; width: 34rpx; height: 34rpx; align-items: center; justify-content: center; border-radius: 50%; background: #eadcff; color: #7042c7; font-size: 22rpx; font-weight: 700; flex: none; }
.service-contribution__percent { color: #21182f; font-size: 29rpx; font-weight: 700; }
.service-contribution__meta { display: block; margin-top: 8rpx; color: #777080; font-size: 23rpx; }
.service-contribution__track { height: 12rpx; margin-top: 14rpx; overflow: hidden; border-radius: 999rpx; background: #eeeaf5; }
.service-contribution__bar { height: 100%; border-radius: inherit; background: linear-gradient(90deg,#9a75e1,#8f72c8); }
.service-contribution__empty { display: flex; min-height: 80rpx; align-items: center; justify-content: center; text-align: center; }
.service-contribution__empty-copy { color: #8a828e; font-size: 22rpx; line-height: 1.5; }
</style>
