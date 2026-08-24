<script setup lang="ts">
import { computed, reactive, watch, type DeepReadonly } from "vue";
import type { BeautyProjectV1, InventoryItemV1 } from "@/domain/data-schema";
import type { CreateBeautyProjectInput } from "@/services/beauty-project-management-service";

const props = defineProps<{
  inventoryItems: readonly InventoryItemV1[];
  submitting: boolean;
  editingProject?: DeepReadonly<BeautyProjectV1>;
}>();

const emit = defineEmits<{
  (event: "submit", input: CreateBeautyProjectInput): void;
  (event: "cancel-edit"): void;
  (event: "quick-add-inventory"): void;
}>();

interface UsageDraft {
  inventoryItemId: string;
  quantityInput: string;
}

const form = reactive({
  name: "",
  standardPriceInput: "",
  durationMinutesInput: "60",
  defaultUsages: [] as UsageDraft[],
});
const newUsage = reactive({ inventoryItemId: "", quantityInput: "" });
const inventoryNames = computed(() =>
  props.inventoryItems.map((item) => `${item.name}（${item.unit}）`),
);

function selectInventoryItem(event: { detail: { value: string } }): void {
  const item = props.inventoryItems[Number(event.detail.value)];
  newUsage.inventoryItemId = item?.id ?? "";
}

/** 接收快速新增页回传值，只预选物品，不擅自填写或提交用量。 */
function selectInventoryItemById(inventoryItemId: string): boolean {
  if (props.inventoryItems.some((item) => item.id === inventoryItemId)) {
    newUsage.inventoryItemId = inventoryItemId;
    return true;
  }
  return false;
}

function addUsage(): void {
  if (!newUsage.inventoryItemId || !newUsage.quantityInput.trim()) {
    return;
  }
  const existing = form.defaultUsages.find(
    (usage) => usage.inventoryItemId === newUsage.inventoryItemId,
  );
  if (existing) {
    existing.quantityInput = newUsage.quantityInput;
  } else {
    form.defaultUsages.push({ ...newUsage });
  }
  newUsage.inventoryItemId = "";
  newUsage.quantityInput = "";
}

function itemLabel(inventoryItemId: string): string {
  const item = props.inventoryItems.find((candidate) => candidate.id === inventoryItemId);
  return item ? `${item.name} · ${item.unit}` : "库存物品不可用";
}

function submit(): void {
  emit("submit", {
    name: form.name,
    standardPriceInput: form.standardPriceInput,
    durationMinutesInput: form.durationMinutesInput,
    defaultUsages: form.defaultUsages.map((usage) => ({ ...usage })),
  });
}

function reset(): void {
  form.name = "";
  form.standardPriceInput = "";
  form.durationMinutesInput = "60";
  form.defaultUsages.splice(0);
  newUsage.inventoryItemId = "";
  newUsage.quantityInput = "";
}

function loadEditingProject(project?: DeepReadonly<BeautyProjectV1>): void {
  if (!project) {
    return;
  }
  form.name = project.name;
  form.standardPriceInput = `${Math.floor(project.standardPriceCents / 100)}.${String(project.standardPriceCents % 100).padStart(2, "0")}`;
  form.durationMinutesInput = String(project.durationMinutes);
  form.defaultUsages.splice(
    0,
    form.defaultUsages.length,
    ...project.defaultUsages.map((usage) => ({
      inventoryItemId: usage.inventoryItemId,
      quantityInput: usage.quantity,
    })),
  );
}

watch(() => props.editingProject, loadEditingProject, { immediate: true });

defineExpose({ reset, selectInventoryItemById });
</script>

<template>
  <view class="project-form">
    <view class="project-form__heading">
      <text class="project-form__title">{{ editingProject ? "编辑服务项目" : "新增服务项目" }}</text>
      <button v-if="editingProject" :disabled="submitting" @click="$emit('cancel-edit')">取消编辑</button>
    </view>
    <label class="project-form__field">
      <text>项目名称</text>
      <input v-model="form.name" maxlength="40" placeholder="例如：深层补水护理" />
    </label>
    <view class="project-form__row">
      <label class="project-form__field project-form__field--half">
        <text>标准价格（元）</text>
        <input v-model="form.standardPriceInput" type="digit" placeholder="0.00" />
      </label>
      <label class="project-form__field project-form__field--half">
        <text>预计时长（分钟）</text>
        <input v-model="form.durationMinutesInput" type="number" placeholder="60" />
      </label>
    </view>
    <view class="project-form__duration-shortcuts">
      <text>常用时长</text>
      <button
        v-for="minutes in [30, 60, 90, 120]"
        :key="minutes"
        :class="{ 'project-form__shortcut--active': form.durationMinutesInput === String(minutes) }"
        @click="form.durationMinutesInput = String(minutes)"
      >
        {{ minutes }} 分
      </button>
    </view>

    <view class="usage-editor">
      <view class="usage-editor__heading">
        <text class="usage-editor__title">默认物品用量（选填）</text>
        <button @click="$emit('quick-add-inventory')">+ 新增库存物品</button>
      </view>
      <view v-for="(usage, index) in form.defaultUsages" :key="usage.inventoryItemId" class="usage-editor__item">
        <text>{{ itemLabel(usage.inventoryItemId) }} · {{ usage.quantityInput }}</text>
        <button @click="form.defaultUsages.splice(index, 1)">移除</button>
      </view>
      <view v-if="inventoryItems.length" class="usage-editor__add">
        <picker :range="inventoryNames" @change="selectInventoryItem">
          <view class="usage-editor__picker">
            {{ newUsage.inventoryItemId ? itemLabel(newUsage.inventoryItemId) : "选择库存物品" }}
          </view>
        </picker>
        <input v-model="newUsage.quantityInput" type="digit" placeholder="用量" />
        <button @click="addUsage">添加</button>
      </view>
      <text v-else class="usage-editor__empty">暂无库存物品，可先保存无默认用量的项目。</text>
    </view>
    <button class="project-form__submit" :disabled="submitting" @click="submit">
      {{ submitting ? "正在保存" : editingProject ? "保存修改" : "保存项目" }}
    </button>
  </view>
</template>

<style scoped>
.project-form {
  padding: 30rpx;
  border: 2rpx solid #e0e5ec;
  border-radius: 20rpx;
  background: #ffffff;
}

.project-form__title {
  color: #1e293b;
  font-size: 31rpx;
  font-weight: 700;
}

.project-form__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project-form__heading button {
  background: transparent;
  color: #63708a;
  font-size: 22rpx;
}

.project-form__field {
  display: flex;
  margin-top: 24rpx;
  flex-direction: column;
  color: #465168;
  font-size: 23rpx;
  font-weight: 600;
}

.project-form__row,
.usage-editor__add,
.usage-editor__item {
  display: flex;
  gap: 16rpx;
}

.project-form__field--half {
  min-width: 0;
  flex: 1;
}

.project-form__field input,
.usage-editor__add input,
.usage-editor__picker {
  height: 74rpx;
  box-sizing: border-box;
  margin-top: 10rpx;
  padding: 0 18rpx;
  border: 2rpx solid #dce2ea;
  border-radius: 11rpx;
  background: #f9fafc;
  color: #263248;
  font-size: 24rpx;
  line-height: 72rpx;
}

.usage-editor {
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid #edf0f4;
}

.project-form__duration-shortcuts {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 14rpx;
  color: #788397;
  font-size: 20rpx;
}

.project-form__duration-shortcuts button {
  height: 48rpx;
  padding: 0 13rpx;
  border: 2rpx solid #d4dce8;
  border-radius: 9rpx;
  background: #f7f9fc;
  color: #647087;
  font-size: 20rpx;
  line-height: 46rpx;
}

.project-form__duration-shortcuts .project-form__shortcut--active {
  border-color: #3159b5;
  background: #e8eefb;
  color: #3159b5;
}

.usage-editor__title {
  color: #354158;
  font-size: 24rpx;
  font-weight: 700;
}

.usage-editor__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.usage-editor__heading button {
  background: transparent;
  color: #31549e;
  font-size: 21rpx;
  font-weight: 600;
}

.usage-editor__item {
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
  color: #58647a;
  font-size: 22rpx;
}

.usage-editor__item button {
  background: transparent;
  color: #9a4a47;
  font-size: 21rpx;
}

.usage-editor__add {
  align-items: flex-end;
  margin-top: 12rpx;
}

.usage-editor__add picker {
  min-width: 0;
  flex: 1.4;
}

.usage-editor__add input {
  width: 120rpx;
}

.usage-editor__add button {
  width: 96rpx;
  height: 74rpx;
  border-radius: 11rpx;
  background: #e7edf8;
  color: #31549e;
  font-size: 22rpx;
  line-height: 74rpx;
}

.usage-editor__empty {
  display: block;
  margin-top: 12rpx;
  color: #828b9a;
  font-size: 21rpx;
}

.project-form__submit {
  height: 82rpx;
  margin-top: 28rpx;
  border-radius: 14rpx;
  background: #3159b5;
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 82rpx;
}
</style>
