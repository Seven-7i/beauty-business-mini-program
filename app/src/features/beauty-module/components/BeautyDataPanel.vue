<script setup lang="ts">
import { computed, shallowRef } from "vue";
import BackupExportSection from "@/features/backup-restore/components/BackupExportSection.vue";
import BackupRestoreSection from "@/features/backup-restore/components/BackupRestoreSection.vue";
import AppIcon from "@/features/shared/components/AppIcon.vue";
import type {
  BackupExportViewState,
  BackupRestoreViewState,
} from "@/features/backup-restore/types";
import { formatLocalDateTime } from "@/utils/date-time-display";

type BeautyDataAction = "export" | "restore" | undefined;

/**
 * 美容模块“数据”页的展示输入。
 *
 * 当前仅由 `pages/beauty/index.vue` 组装；导出与恢复状态仍由
 * `useBackupRestoreFlow` 作为唯一状态来源维护。
 */
interface BeautyDataPanelProps {
  exportState: Readonly<BackupExportViewState>;
  restoreState: Readonly<BackupRestoreViewState>;
  busy: boolean;
  lastExportedAt?: string;
  lastExportFileName?: string;
}

const props = defineProps<BeautyDataPanelProps>();

/**
 * 向页面组合层转交备份流程操作，不在展示组件内直接触碰本机文件。
 */
const emit = defineEmits<{
  (event: "prepareExport"): void;
  (event: "shareExport"): void;
  (event: "confirmExportSent"): void;
  (event: "confirmExportCancelled"): void;
  (event: "selectRestore"): void;
  (event: "prepareCurrentExport"): void;
  (event: "proceedRestore"): void;
  (event: "returnHome"): void;
}>();

const activeAction = shallowRef<BeautyDataAction>();

const latestExportLabel = computed(() =>
  props.lastExportedAt ? formatLocalDateTime(props.lastExportedAt) : "尚未导出",
);

const latestExportHint = computed(() =>
  props.lastExportedAt ? "已完成本机导出记录" : "建议每 7 天导出一次",
);

/**
 * 切换美容数据操作区；再次点击当前入口时收起，点击另一入口时直接切换。
 *
 * 当前仅服务 `BeautyDataPanel` 内的导出与恢复折叠卡，不改变备份流程状态。
 */
function toggleAction(action: Exclude<BeautyDataAction, undefined>): void {
  activeAction.value = activeAction.value === action ? undefined : action;
}
</script>

<template>
  <view class="beauty-data-panel">
    <view class="beauty-data-panel__atmosphere" aria-hidden="true" />
    <view class="beauty-data-panel__content">
      <view class="export-status-card">
        <view class="export-status-card__copy">
          <text class="export-status-card__label">最近导出</text>
          <text class="export-status-card__value">{{ latestExportLabel }}</text>
          <text class="export-status-card__hint">{{ latestExportHint }}</text>
        </view>
        <view class="export-status-card__icon" aria-hidden="true">
          <AppIcon name="backup" :size="50" color="#8561B8" />
        </view>
      </view>

      <view class="beauty-data-panel__actions" aria-label="美容数据操作">
        <view
          class="data-action"
          :class="{ 'data-action--active': activeAction === 'export' }"
          role="button"
          tabindex="0"
          :aria-expanded="activeAction === 'export'"
          hover-class="app-pressable"
          @click="toggleAction('export')"
        >
          <view class="data-action__copy">
            <text class="data-action__title">导出美容模块</text>
            <text class="data-action__description">顾客、预约、库存和经营数据</text>
          </view>
          <view class="data-action__trailing">
            <view class="data-action__icon"><AppIcon name="backup" :size="27" /></view>
            <view
              class="data-action__chevron"
              :class="{ 'data-action__chevron--expanded': activeAction === 'export' }"
              aria-hidden="true"
            >
              <AppIcon
                name="chevron-right"
                :size="18"
                :color="activeAction === 'export' ? '#FFFFFF' : '#918B93'"
              />
            </view>
          </view>
        </view>

        <view v-if="activeAction === 'export'" class="data-action__details">
          <BackupExportSection
            :state="props.exportState"
            :last-exported-at="props.lastExportedAt"
            :last-export-file-name="props.lastExportFileName"
            :busy="props.busy"
            scope-label="美容模块"
            :show-last-system-export="false"
            @prepare="emit('prepareExport')"
            @share="emit('shareExport')"
            @confirm-sent="emit('confirmExportSent')"
            @confirm-cancelled="emit('confirmExportCancelled')"
          />
        </view>

        <view
          class="data-action"
          :class="{ 'data-action--active': activeAction === 'restore' }"
          role="button"
          tabindex="0"
          :aria-expanded="activeAction === 'restore'"
          hover-class="app-pressable"
          @click="toggleAction('restore')"
        >
          <view class="data-action__copy">
            <text class="data-action__title">从备份恢复</text>
            <text class="data-action__description">覆盖当前美容模块数据前会再次确认</text>
          </view>
          <view class="data-action__trailing">
            <view class="data-action__icon"><AppIcon name="file-restore" :size="27" /></view>
            <view
              class="data-action__chevron"
              :class="{ 'data-action__chevron--expanded': activeAction === 'restore' }"
              aria-hidden="true"
            >
              <AppIcon
                name="chevron-right"
                :size="18"
                :color="activeAction === 'restore' ? '#FFFFFF' : '#918B93'"
              />
            </view>
          </view>
        </view>

        <view v-if="activeAction === 'restore'" class="data-action__details">
          <BackupRestoreSection
            :state="props.restoreState"
            :busy="props.busy"
            @select="emit('selectRestore')"
            @prepare-current-export="emit('prepareCurrentExport')"
            @proceed="emit('proceedRestore')"
            @return-home="emit('returnHome')"
          />
        </view>
      </view>

      <view class="privacy-notice">
        <view class="privacy-notice__icon"><AppIcon name="info" :size="22" color="#B97620" /></view>
        <view class="privacy-notice__copy">
          <text class="privacy-notice__title">备份文件未加密，请妥善保管</text>
          <text class="privacy-notice__description">文件可能包含顾客资料，请勿发送给无关人员。</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.beauty-data-panel { position: relative; min-height: calc(100vh - 88rpx); overflow: hidden; background: #fbf5f7; }
.beauty-data-panel__atmosphere { position: absolute; top: 38rpx; right: -210rpx; width: 600rpx; height: 600rpx; border-radius: 50%; background: radial-gradient(circle, rgba(220, 197, 239, .72), rgba(251, 245, 247, 0) 68%); pointer-events: none; }
.beauty-data-panel__content { position: relative; z-index: 1; display: flex; box-sizing: border-box; flex-direction: column; gap: 24rpx; padding: 32rpx 30rpx calc(190rpx + env(safe-area-inset-bottom)); }
.export-status-card { display: flex; min-height: 220rpx; box-sizing: border-box; align-items: center; justify-content: space-between; padding: 34rpx 38rpx; border: 2rpx solid rgba(255, 255, 255, .82); border-radius: 30rpx; background: rgba(255, 253, 254, .72); box-shadow: 0 20rpx 42rpx rgba(126, 88, 114, .10), inset 0 2rpx 0 rgba(255, 255, 255, .86); backdrop-filter: blur(18rpx); }
.export-status-card__copy { display: flex; min-width: 0; flex-direction: column; }
.export-status-card__label { color: #69626c; font-size: 24rpx; }
.export-status-card__value { margin-top: 16rpx; color: #714fa4; font-size: 42rpx; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
.export-status-card__hint { margin-top: 14rpx; color: #79717d; font-size: 21rpx; }
.export-status-card__icon { display: flex; width: 116rpx; height: 116rpx; flex: none; align-items: center; justify-content: center; margin-left: 22rpx; border-radius: 50%; background: linear-gradient(135deg, #f1e8fb, #e5d7f5); }
.beauty-data-panel__actions { display: flex; flex-direction: column; gap: 18rpx; }
.data-action { display: flex; min-height: 142rpx; box-sizing: border-box; align-items: center; justify-content: space-between; gap: 18rpx; padding: 26rpx 28rpx 26rpx 34rpx; border: 2rpx solid rgba(151, 112, 175, .11); border-radius: 25rpx; background: #fffdfd; box-shadow: 0 12rpx 28rpx rgba(126, 88, 114, .08); }
.data-action--active { border-color: transparent; border-radius: 25rpx 25rpx 0 0; background: linear-gradient(135deg, #875eb5, #68428e); box-shadow: 0 12rpx 24rpx rgba(103, 65, 141, .16); }
.data-action__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.data-action__title { color: #2a222d; font-size: 30rpx; font-weight: 700; }
.data-action__description { margin-top: 11rpx; color: #77707a; font-size: 22rpx; line-height: 1.45; overflow-wrap: anywhere; }
.data-action__trailing { display: flex; flex: none; align-items: center; gap: 18rpx; }
.data-action__icon { display: flex; width: 76rpx; height: 76rpx; align-items: center; justify-content: center; border-radius: 50%; background: #f0e8f8; color: #7650a9; }
.data-action__chevron { display: flex; align-items: center; justify-content: center; transform: rotate(0deg); transition: transform 180ms ease; }
.data-action__chevron--expanded { transform: rotate(-90deg); }
.data-action--active .data-action__title, .data-action--active .data-action__description { color: #ffffff; }
.data-action--active .data-action__description { color: rgba(255, 255, 255, .82); }
.data-action--active .data-action__icon { background: rgba(255, 255, 255, .2); color: #ffffff; }
.data-action__details { margin-top: -18rpx; padding: 18rpx 0 0; overflow: hidden; border: 2rpx solid rgba(151, 112, 175, .16); border-top: 0; border-radius: 0 0 25rpx 25rpx; background: rgba(245, 238, 252, .92); box-shadow: 0 16rpx 30rpx rgba(103, 65, 141, .10); }
.privacy-notice { display: flex; align-items: flex-start; gap: 18rpx; padding: 24rpx 26rpx; border: 2rpx solid #f1d6ac; border-radius: 20rpx; background: #fff9ee; }
.privacy-notice__icon { display: flex; width: 42rpx; height: 42rpx; flex: none; align-items: center; justify-content: center; border-radius: 50%; background: #ffedce; }
.privacy-notice__copy { display: flex; min-width: 0; flex-direction: column; }
.privacy-notice__title { color: #9c6420; font-size: 24rpx; font-weight: 650; line-height: 1.5; overflow-wrap: anywhere; }
.privacy-notice__description { margin-top: 6rpx; color: #886e48; font-size: 20rpx; line-height: 1.55; overflow-wrap: anywhere; }
.beauty-data-panel :deep(.data-section), .beauty-data-panel :deep(.restore-section) { border-color: transparent; border-radius: 0 0 23rpx 23rpx; background: #f6effc !important; box-shadow: none; }
.beauty-data-panel :deep(.data-section__eyebrow), .beauty-data-panel :deep(.restore-section__eyebrow) { color: #8561b8; }
.beauty-data-panel :deep(.data-section__button), .beauty-data-panel :deep(.restore-section__button) { background: #7954a0 !important; color: #ffffff !important; }
.beauty-data-panel :deep(.restore-section__button--danger) { background: #a94442 !important; }
.beauty-data-panel :deep(.data-section__button), .beauty-data-panel :deep(.restore-section__button) { border-radius: 18rpx; }
</style>
