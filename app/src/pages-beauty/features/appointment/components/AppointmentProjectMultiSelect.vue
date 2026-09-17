<script setup lang="ts">
import { computed, shallowRef, watch, type DeepReadonly } from "vue";
import type { BeautyProjectV1 } from "@/domain/data-schema";

interface AppointmentProjectMultiSelectProps {
  /** 是否显示项目多选面板。 */
  show: boolean;
  /** 当前可选择的启用服务项目。 */
  projects: readonly DeepReadonly<BeautyProjectV1>[];
  /** 打开面板时作为临时勾选初始值的项目标识。 */
  selectedProjectIds: readonly string[];
  /** 保存预约期间禁止更改项目组合。 */
  disabled: boolean;
}

const props = defineProps<AppointmentProjectMultiSelectProps>();

const emit = defineEmits<{
  /** 确认后回传去重且仍可选择的项目标识。 */
  (event: "confirm", projectIds: string[]): void;
  /** 取消、关闭遮罩或关闭图标时丢弃临时勾选。 */
  (event: "cancel"): void;
}>();

const query = shallowRef("");
const draftProjectIds = shallowRef<string[]>([]);

/** 按名称筛选多选面板中可见的服务项目。 */
const visibleProjects = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return keyword
    ? props.projects.filter((project) =>
        project.name.toLowerCase().includes(keyword),
      )
    : props.projects;
});

/** 面板打开时以父表单的项目组合重建临时勾选，关闭后不保留未确认修改。 */
function resetDraftProjectIds(): void {
  const selectableIds = new Set(props.projects.map((project) => project.id));
  draftProjectIds.value = props.selectedProjectIds.filter(
    (projectId, index, allProjectIds) =>
      selectableIds.has(projectId) && allProjectIds.indexOf(projectId) === index,
  );
  query.value = "";
}

/** 让项目行与右侧 uview-plus 勾选框都能切换临时选择。 */
function toggleProject(projectId: string): void {
  if (props.disabled) {
    return;
  }
  draftProjectIds.value = draftProjectIds.value.includes(projectId)
    ? draftProjectIds.value.filter((id) => id !== projectId)
    : [...draftProjectIds.value, projectId];
}

/** 放弃临时调整并通知父表单关闭面板。 */
function cancel(): void {
  if (!props.disabled) {
    emit("cancel");
  }
}

/** 确认本次多选结果，由父表单统一刷新金额、时长和默认用量。 */
function confirm(): void {
  if (props.disabled) {
    return;
  }
  emit("confirm", [...draftProjectIds.value]);
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      resetDraftProjectIds();
    }
  },
);
</script>

<template>
  <u-popup
    :show="show"
    mode="bottom"
    round="22"
    :closeable="true"
    close-icon-pos="top-right"
    :close-on-click-overlay="!disabled"
    @close="cancel"
  >
    <view class="project-multi-select">
      <view class="project-multi-select__header">
        <view>
          <text class="project-multi-select__title">选择服务项目</text>
          <text class="project-multi-select__hint">可一次勾选多个项目，确认后统一更新预约组合</text>
        </view>
        <text class="project-multi-select__count">已选 {{ draftProjectIds.length }} 项</text>
      </view>

      <view class="project-multi-select__search">
        <u-icon name="search" color="#6b6574" size="20" />
        <input v-model="query" :disabled="disabled" maxlength="30" placeholder="搜索服务项目" />
      </view>

      <scroll-view class="project-multi-select__list" scroll-y>
        <view
          v-for="project in visibleProjects"
          :key="project.id"
          class="project-multi-select__item"
          :class="{ 'project-multi-select__item--selected': draftProjectIds.includes(project.id) }"
          role="checkbox"
          :tabindex="disabled ? -1 : 0"
          :aria-checked="draftProjectIds.includes(project.id)"
          :aria-disabled="disabled"
          hover-class="project-multi-select__item--pressed"
          :hover-start-time="20"
          :hover-stay-time="80"
          @click="toggleProject(project.id)"
          @keyup.enter="toggleProject(project.id)"
          @keyup.space.prevent="toggleProject(project.id)"
        >
          <view class="project-multi-select__item-main">
            <text class="project-multi-select__item-name">{{ project.name }}</text>
            <text class="project-multi-select__item-meta">
              ¥{{ (project.standardPriceCents / 100).toFixed(2) }} · {{ project.durationMinutes }} 分钟
            </text>
          </view>
          <view class="project-multi-select__checkbox" @click.stop>
            <u-checkbox
              :name="project.id"
              :used-alone="true"
              :checked="draftProjectIds.includes(project.id)"
              shape="square"
              active-color="#5639df"
              inactive-color="#c9c4d0"
              :disabled="disabled"
              label=""
              :label-disabled="true"
              @change="toggleProject(project.id)"
            />
          </view>
        </view>
        <view v-if="!visibleProjects.length" class="project-multi-select__empty">
          未找到匹配的服务项目
        </view>
      </scroll-view>

      <view class="project-multi-select__actions">
        <view
          class="project-multi-select__button"
          :class="{ 'project-multi-select__button--disabled': disabled }"
          role="button"
          :tabindex="disabled ? -1 : 0"
          :aria-disabled="disabled"
          :hover-class="disabled ? 'none' : 'app-pressable'"
          @click="cancel"
          @keyup.enter="cancel"
          @keyup.space.prevent="cancel"
        >
          取消
        </view>
        <view
          class="project-multi-select__button project-multi-select__button--primary"
          :class="{ 'project-multi-select__button--disabled': disabled }"
          role="button"
          :tabindex="disabled ? -1 : 0"
          :aria-disabled="disabled"
          :hover-class="disabled ? 'none' : 'app-pressable'"
          @click="confirm"
          @keyup.enter="confirm"
          @keyup.space.prevent="confirm"
        >
          确认选择（{{ draftProjectIds.length }}）
        </view>
      </view>
    </view>
  </u-popup>
</template>

<style scoped>
.project-multi-select { box-sizing: border-box; padding: 34rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); background: #fff; }
.project-multi-select__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; padding-right: 58rpx; }
.project-multi-select__title, .project-multi-select__hint, .project-multi-select__item-name, .project-multi-select__item-meta { display: block; }
.project-multi-select__title { color: #211c27; font-size: 32rpx; font-weight: 700; }
.project-multi-select__hint { margin-top: 8rpx; color: #777080; font-size: 21rpx; line-height: 1.45; }
.project-multi-select__count { flex: none; margin-top: 4rpx; color: #4d34d9; font-size: 23rpx; font-weight: 600; white-space: nowrap; }
.project-multi-select__search { display: flex; height: 76rpx; align-items: center; gap: 14rpx; margin-top: 24rpx; padding: 0 18rpx; border: 2rpx solid #e4e0e8; border-radius: 14rpx; background: #fbfaff; }
.project-multi-select__search input { min-width: 0; height: 72rpx; flex: 1; color: #27222e; font-size: 24rpx; }
.project-multi-select__list { height: 700rpx; margin-top: 18rpx; }
.project-multi-select__item { display: flex; min-height: 104rpx; align-items: center; justify-content: space-between; gap: 20rpx; padding: 18rpx; border-bottom: 2rpx solid #eeeaf1; background: #fff; }
.project-multi-select__item--selected { background: #faf8ff; }
.project-multi-select__item--pressed { background: #f4f0ff; }
.project-multi-select__item-main { min-width: 0; flex: 1; }
.project-multi-select__checkbox { display: flex; align-items: center; justify-content: center; flex: none; padding: 12rpx; }
.project-multi-select__item-name { overflow: hidden; color: #292430; font-size: 26rpx; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.project-multi-select__item-meta { margin-top: 8rpx; color: #777080; font-size: 21rpx; }
.project-multi-select__empty { padding: 82rpx 24rpx; color: #918a97; font-size: 24rpx; text-align: center; }
.project-multi-select__actions { display: flex; gap: 18rpx; padding-top: 22rpx; border-top: 2rpx solid #eeeaf1; }
.project-multi-select__button { display: flex; height: 82rpx; align-items: center; justify-content: center; flex: 1; border: 2rpx solid #5940dd; border-radius: 14rpx; background: #fff; color: #4c34d8; font-size: 26rpx; font-weight: 600; }
.project-multi-select__button--primary { border: 0; background: linear-gradient(135deg, #5a3ce0, #4022d5); color: #fff; }
.project-multi-select__button--disabled { opacity: 0.55; }
</style>
