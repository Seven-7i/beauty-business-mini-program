<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { BeautyProjectV1, InventoryItemV1 } from "@/domain/data-schema";
import { filterBeautyProjects } from "../composables/useBeautyProjectManagement";
import BeautyProjectCard from "./BeautyProjectCard.vue";

/** 服务项目列表的只读展示输入。 */
interface BeautyProjectListProps {
  /** 已按状态和名称排序的全部服务项目。 */
  projects: readonly BeautyProjectV1[];
  /** 用于将默认用量标识解析为业务名称和单位。 */
  inventoryItems: readonly InventoryItemV1[];
  /** 页面读取或提交期间禁止重复进入。 */
  disabled: boolean;
}

/** 服务项目列表向页面编排层暴露的操作。 */
interface BeautyProjectListEmits {
  /** 请求打开独立新增服务项目表单。 */
  add: [];
  /** 请求进入指定服务项目详情。 */
  view: [project: BeautyProjectV1];
}

const props = defineProps<BeautyProjectListProps>();
const emit = defineEmits<BeautyProjectListEmits>();
const keyword = shallowRef("");
const inactiveOnly = shallowRef(false);
const visibleProjects = computed(() =>
  filterBeautyProjects(props.projects, keyword.value, inactiveOnly.value),
);
const emptyMessage = computed(() => {
  if (keyword.value.trim()) {
    return inactiveOnly.value
      ? "没有符合搜索条件的停用项目"
      : "没有符合搜索条件的启用项目";
  }
  return inactiveOnly.value
    ? "暂无停用服务项目"
    : "还没有启用服务项目，点击“新增”添加第一项服务";
});

/** 在互斥的启用项目与停用项目范围之间切换。 */
function toggleInactiveOnly(): void {
  inactiveOnly.value = !inactiveOnly.value;
}
</script>

<template>
  <section class="project-list" aria-label="服务项目列表">
    <view class="project-list__toolbar">
      <label class="project-list__search">
        <u-icon name="search" color="#777078" size="20" />
        <input
          v-model="keyword"
          class="project-list__search-input"
          maxlength="40"
          placeholder="搜索项目名称"
          placeholder-style="color:#938c92"
          confirm-type="search"
        />
      </label>
      <button
        class="project-list__add"
        :disabled="disabled"
        aria-label="新增服务项目"
        hover-class="project-list__add--pressed"
        :hover-start-time="20"
        :hover-stay-time="80"
        @click="emit('add')"
      >
        <u-icon name="plus" color="#FFFFFF" size="14" />
        <text>新增</text>
      </button>
    </view>

    <view class="project-list__scope">
      <text class="project-list__count">{{ visibleProjects.length }} 项</text>
      <button
        class="project-list__inactive-toggle"
        role="checkbox"
        :aria-checked="inactiveOnly"
        :disabled="disabled"
        @click="toggleInactiveOnly"
      >
        <view
          class="project-list__checkbox"
          :class="{ 'project-list__checkbox--checked': inactiveOnly }"
          aria-hidden="true"
        >
          <text v-if="inactiveOnly" class="project-list__checkmark">✓</text>
        </view>
        <text>仅看停用</text>
      </button>
    </view>

    <view v-if="!visibleProjects.length" class="project-list__empty" role="status">
      {{ emptyMessage }}
    </view>
    <view v-else class="project-list__cards">
      <BeautyProjectCard
        v-for="project in visibleProjects"
        :key="project.id"
        :project="project"
        :inventory-items="inventoryItems"
        :disabled="disabled"
        @view="emit('view', $event)"
      />
    </view>
  </section>
</template>

<style scoped>
.project-list { position: relative; z-index: 1; }
.project-list__toolbar, .project-list__search, .project-list__add, .project-list__scope, .project-list__inactive-toggle { display: flex; align-items: center; }
.project-list__toolbar { gap: 18rpx; }
.project-list__search { min-width: 0; height: 88rpx; box-sizing: border-box; flex: 1; gap: 16rpx; padding: 0 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 22rpx; background: rgba(255, 255, 255, 0.94); box-shadow: 0 12rpx 34rpx rgba(111, 75, 101, 0.06); }
.project-list__search-input { min-width: 0; height: 84rpx; flex: 1; color: #332f33; font-size: 25rpx; }
.project-list__add { width: 164rpx; min-height: 88rpx; flex: none; justify-content: center; gap: 8rpx; margin: 0; padding: 0 18rpx; border: 0; border-radius: 22rpx; background: linear-gradient(135deg, #7853b9 0%, #6437aa 100%); box-shadow: 0 14rpx 30rpx rgba(102, 59, 161, 0.22); color: #ffffff; font-size: 25rpx; font-weight: 600; line-height: 1; transition: opacity 120ms ease, transform 120ms ease; }
.project-list__add--pressed { opacity: 0.88; transform: scale(0.98); }
.project-list__scope { min-height: 76rpx; justify-content: space-between; gap: 18rpx; margin-top: 28rpx; padding: 0 2rpx; flex-wrap: wrap; }
.project-list__count { color: #6f45b5; font-size: 25rpx; font-weight: 600; }
.project-list__inactive-toggle { min-height: 68rpx; flex: none; gap: 12rpx; margin: 0; padding: 8rpx 0 8rpx 16rpx; border: 0; background: transparent; color: #413b40; font-size: 24rpx; line-height: 1.2; }
.project-list__checkbox { display: flex; width: 34rpx; height: 34rpx; box-sizing: border-box; align-items: center; justify-content: center; border: 2rpx solid #827b80; border-radius: 8rpx; background: rgba(255, 255, 255, 0.76); }
.project-list__checkbox--checked { border-color: #6c43b1; background: #6c43b1; }
.project-list__checkmark { color: #ffffff; font-size: 24rpx; font-weight: 700; line-height: 1; }
.project-list__empty { margin-top: 20rpx; padding: 52rpx 28rpx; border: 2rpx dashed #ded3dc; border-radius: 22rpx; background: rgba(255, 253, 253, 0.72); color: #837a81; font-size: 23rpx; line-height: 1.55; text-align: center; }
.project-list__cards { overflow-wrap: anywhere; }

@media (max-width: 360px) {
  .project-list__toolbar { gap: 12rpx; }
  .project-list__search { padding-right: 18rpx; padding-left: 18rpx; }
  .project-list__add { width: 152rpx; padding-right: 14rpx; padding-left: 14rpx; }
}
</style>
