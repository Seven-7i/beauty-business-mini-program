<script setup lang="ts">
import {
  computed,
  nextTick,
  reactive,
  shallowRef,
  watch,
  type DeepReadonly,
} from "vue";
import type { BeautyProjectV1, InventoryItemV1 } from "@/domain/data-schema";
import type { CreateBeautyProjectInput } from "@/services/beauty-project-management-service";
import { parseDecimalQuantity } from "@/utils/decimal-quantity";

/** 服务项目统一新增/编辑表单的业务输入。 */
interface BeautyProjectFormProps {
  /** 全部库存物品；已选停用物品仍需可读，新增选择只提供启用项。 */
  inventoryItems: readonly InventoryItemV1[];
  /** 提交期间锁定全部字段和操作。 */
  submitting: boolean;
  /** 编辑模式下预填的当前项目；缺失时为新增模式。 */
  editingProject?: DeepReadonly<BeautyProjectV1>;
  /** service 校验返回的字段或业务错误。 */
  errorMessage?: string;
}

/** 服务项目表单向容器暴露的用户意图。 */
interface BeautyProjectFormEmits {
  /** 提交完整项目草稿。 */
  submit: [input: CreateBeautyProjectInput];
  /** 当前草稿是否偏离进入页面时的初始状态。 */
  dirtyChange: [dirty: boolean];
  /** 进入独立库存新增页并在返回后保留当前项目草稿。 */
  quickAddInventory: [];
}

/** 服务项目表单供快速新增回传使用的最小公开契约。 */
interface BeautyProjectFormExpose {
  /** 将新建库存物品预选到待添加用量行，不擅自填写数量。 */
  selectInventoryItemById(inventoryItemId: string): boolean;
  /** 将首次提交的字段错误带入当前视口；无字段错误时返回 false。 */
  scrollToFirstError(): Promise<boolean>;
}

interface UsageDraft {
  /** 被配置建议用量的库存物品标识。 */
  inventoryItemId: string;
  /** 已按计量精度规范化或尚待 service 校验的数量文本。 */
  quantityInput: string;
}

const props = withDefaults(defineProps<BeautyProjectFormProps>(), {
  editingProject: undefined,
  errorMessage: "",
});
const emit = defineEmits<BeautyProjectFormEmits>();
const form = reactive({
  name: "",
  standardPriceInput: "",
  durationMinutesInput: "60",
  defaultUsages: [] as UsageDraft[],
});
const newUsage = reactive({ inventoryItemId: "", quantityInput: "" });
const usageError = shallowRef("");
const initialSignature = shallowRef("");
const selectableInventoryItems = computed(() =>
  props.inventoryItems.filter(
    (item) =>
      item.status === "active" &&
      !form.defaultUsages.some(
        (usage) => usage.inventoryItemId === item.id,
      ),
  ),
);
const inventoryNames = computed(() =>
  selectableInventoryItems.value.map((item) => `${item.name}（${item.unit}）`),
);
const selectedNewUsageItem = computed(() =>
  props.inventoryItems.find((item) => item.id === newUsage.inventoryItemId),
);
const submitLabel = computed(() =>
  props.submitting
    ? "正在保存"
    : props.editingProject
      ? "保存修改"
      : "保存项目",
);
const nameError = computed(() =>
  props.errorMessage.includes("项目名称") ||
  props.errorMessage.includes("同名")
    ? props.errorMessage
    : "",
);
const priceError = computed(() =>
  props.errorMessage.includes("标准价格") ? props.errorMessage : "",
);
const durationError = computed(() =>
  props.errorMessage.includes("预计服务时长") ? props.errorMessage : "",
);
const defaultUsageError = computed(() =>
  props.errorMessage.includes("默认用量") ||
  props.errorMessage.includes("库存物品")
    ? props.errorMessage
    : usageError.value,
);

/** 将当前表单与尚未加入列表的用量行转换为稳定草稿签名。 */
function draftSignature(): string {
  return JSON.stringify({
    name: form.name,
    standardPriceInput: form.standardPriceInput,
    durationMinutesInput: form.durationMinutesInput,
    defaultUsages: form.defaultUsages,
    newUsage,
  });
}

/** 向页面容器同步当前草稿是否需要原生返回保护。 */
function emitDirtyState(): void {
  emit("dirtyChange", draftSignature() !== initialSignature.value);
}

/** 从 picker 索引选择一个仍可用于新配置的库存物品。 */
function selectInventoryItem(event: { detail: { value: string } }): void {
  const item = selectableInventoryItems.value[Number(event.detail.value)];
  newUsage.inventoryItemId = item?.id ?? "";
  usageError.value = "";
}

/**
 * 接收快速新增页回传值，只预选物品，不擅自填写或提交用量。
 * 当前由 BeautyProjectEditor 在库存新增页返回后调用。
 */
function selectInventoryItemById(inventoryItemId: string): boolean {
  if (
    props.inventoryItems.some(
      (item) => item.id === inventoryItemId && item.status === "active",
    )
  ) {
    newUsage.inventoryItemId = inventoryItemId;
    usageError.value = "";
    return true;
  }
  return false;
}

/** 校验待添加数量并把一项默认用量加入项目草稿。 */
function addUsage(): boolean {
  if (props.submitting) {
    return false;
  }
  const item = selectedNewUsageItem.value;
  if (!item) {
    usageError.value = "请先选择库存物品";
    return false;
  }
  try {
    const quantity = parseDecimalQuantity(newUsage.quantityInput, {
      unitKind: item.unitKind,
      positive: true,
    });
    form.defaultUsages.push({
      inventoryItemId: item.id,
      quantityInput: quantity,
    });
    newUsage.inventoryItemId = "";
    newUsage.quantityInput = "";
    usageError.value = "";
    return true;
  } catch (error) {
    usageError.value =
      error instanceof Error ? error.message : "请填写有效的默认用量";
    return false;
  }
}

/** 从当前草稿移除一项默认用量，库存事实不受影响。 */
function removeUsage(index: number): void {
  form.defaultUsages.splice(index, 1);
  usageError.value = "";
}

/** 解析已配置默认用量的物品名称、数量与单位。 */
function usageLabel(usage: UsageDraft): string {
  const item = props.inventoryItems.find(
    (candidate) => candidate.id === usage.inventoryItemId,
  );
  return item
    ? `${item.name} · ${usage.quantityInput} ${item.unit}`
    : `库存物品不可用 · ${usage.quantityInput}`;
}

/** 选择常用时长并保持分钟字段仍可手动修改。 */
function selectDuration(minutes: number): void {
  if (!props.submitting) {
    form.durationMinutesInput = String(minutes);
  }
}

/** 按字段顺序定位首次提交错误，业务级错误留给页面提示处理。 */
async function scrollToFirstError(): Promise<boolean> {
  const selector = nameError.value
    ? ".project-form__field--name"
    : priceError.value
      ? ".project-form__field--price"
      : durationError.value
        ? ".project-form__field--duration"
        : defaultUsageError.value
          ? ".usage-editor"
          : "";
  if (!selector) {
    return false;
  }
  await nextTick();
  uni.pageScrollTo({ selector, duration: 180 });
  return true;
}

/** 提交草稿；待添加行有内容时先纳入默认用量，避免静默丢失。 */
function submit(): void {
  if (props.submitting) {
    return;
  }
  if (
    (newUsage.inventoryItemId || newUsage.quantityInput.trim()) &&
    !addUsage()
  ) {
    return;
  }
  emit("submit", {
    name: form.name,
    standardPriceInput: form.standardPriceInput,
    durationMinutesInput: form.durationMinutesInput,
    defaultUsages: form.defaultUsages.map((usage) => ({ ...usage })),
  });
}

/** 切换新增/编辑模式时载入稳定初始值并重置脏草稿基线。 */
function loadProject(project?: DeepReadonly<BeautyProjectV1>): void {
  form.name = project?.name ?? "";
  form.standardPriceInput = project
    ? `${Math.floor(project.standardPriceCents / 100)}.${String(
        project.standardPriceCents % 100,
      ).padStart(2, "0")}`
    : "";
  form.durationMinutesInput = project
    ? String(project.durationMinutes)
    : "60";
  form.defaultUsages.splice(
    0,
    form.defaultUsages.length,
    ...(project?.defaultUsages.map((usage) => ({
      inventoryItemId: usage.inventoryItemId,
      quantityInput: usage.quantity,
    })) ?? []),
  );
  newUsage.inventoryItemId = "";
  newUsage.quantityInput = "";
  usageError.value = "";
  initialSignature.value = draftSignature();
  emit("dirtyChange", false);
}

// 只在编辑目标变化时重载初值。库存快速新增返回会刷新同一项目对象，
// 此时必须保留尚未保存的项目草稿，不能因对象引用变化而覆盖输入。
watch(() => props.editingProject?.id, () => loadProject(props.editingProject), {
  immediate: true,
});
watch(form, emitDirtyState, { deep: true });
watch(newUsage, emitDirtyState, { deep: true });

const exposed: BeautyProjectFormExpose = {
  selectInventoryItemById,
  scrollToFirstError,
};
defineExpose(exposed);
</script>

<template>
  <view class="project-editor">
    <view class="project-form">
      <label class="project-form__field project-form__field--name">
        <text class="project-form__label">项目名称 <text class="project-form__required">*</text></text>
        <input
          v-model="form.name"
          :disabled="submitting"
          maxlength="40"
          placeholder="例如：深层补水护理"
          placeholder-style="color:#9A94A0"
        />
        <text v-if="nameError" class="project-form__field-error">{{ nameError }}</text>
      </label>

      <label class="project-form__field project-form__field--price">
        <text class="project-form__label">标准价格 <text class="project-form__required">*</text></text>
        <view class="project-form__input-shell">
          <input
            v-model="form.standardPriceInput"
            :disabled="submitting"
            type="digit"
            placeholder="0.00"
            placeholder-style="color:#9A94A0"
          />
          <text>元</text>
        </view>
        <text v-if="priceError" class="project-form__field-error">{{ priceError }}</text>
      </label>

      <label class="project-form__field project-form__field--duration">
        <text class="project-form__label">预计服务时长 <text class="project-form__required">*</text></text>
        <view class="project-form__input-shell">
          <input
            v-model="form.durationMinutesInput"
            :disabled="submitting"
            type="number"
            placeholder="60"
            placeholder-style="color:#9A94A0"
          />
          <text>分钟</text>
        </view>
        <text v-if="durationError" class="project-form__field-error">{{ durationError }}</text>
      </label>

      <view class="duration-shortcuts" role="radiogroup" aria-label="常用时长">
        <text class="duration-shortcuts__label">常用时长</text>
        <view class="duration-shortcuts__options">
          <view
            v-for="minutes in [30, 60, 90, 120]"
            :key="minutes"
            class="duration-shortcuts__option"
            :class="{
              'duration-shortcuts__option--active':
                form.durationMinutesInput === String(minutes),
              'duration-shortcuts__option--disabled': submitting,
            }"
            role="radio"
            :aria-checked="form.durationMinutesInput === String(minutes)"
            :aria-disabled="submitting"
            hover-class="duration-shortcuts__option--pressed"
            @click="selectDuration(minutes)"
          >
            {{ minutes }} 分
          </view>
        </view>
      </view>
    </view>

    <section class="usage-editor" aria-label="默认物品用量">
      <view class="usage-editor__heading">
        <view class="usage-editor__heading-copy">
          <text class="usage-editor__title">默认物品用量 <text class="usage-editor__optional">（选填）</text></text>
          <text class="usage-editor__description">用于创建预约时带出，可在预约中调整</text>
        </view>
        <button
          class="usage-editor__quick-add"
          :disabled="submitting"
          hover-class="usage-editor__quick-add--pressed"
          @click="emit('quickAddInventory')"
        >
          <u-icon name="plus" color="#6340B0" size="12" />
          <text>新增库存物品</text>
        </button>
      </view>

      <view v-if="form.defaultUsages.length" class="usage-editor__selected">
        <view
          v-for="(usage, index) in form.defaultUsages"
          :key="usage.inventoryItemId"
          class="usage-editor__selected-row"
        >
          <text>{{ usageLabel(usage) }}</text>
          <button
            :disabled="submitting"
            :aria-label="`移除${usageLabel(usage)}`"
            @click="removeUsage(index)"
          >
            移除
          </button>
        </view>
      </view>

      <view class="usage-editor__add-row">
        <picker
          class="usage-editor__picker"
          :disabled="submitting || !selectableInventoryItems.length"
          :range="inventoryNames"
          @change="selectInventoryItem"
        >
          <view class="usage-editor__picker-value">
            <text>
              {{
                selectedNewUsageItem
                  ? `${selectedNewUsageItem.name}（${selectedNewUsageItem.unit}）`
                  : selectableInventoryItems.length
                    ? "选择库存物品"
                    : "暂无可选物品"
              }}
            </text>
            <u-icon name="arrow-down" color="#8B8490" size="14" />
          </view>
        </picker>
        <input
          v-model="newUsage.quantityInput"
          class="usage-editor__quantity"
          :disabled="submitting"
          type="digit"
          placeholder="用量"
          placeholder-style="color:#9A94A0"
        />
        <view
          class="usage-editor__add-button"
          :class="{ 'usage-editor__add-button--disabled': submitting }"
          role="button"
          :aria-disabled="submitting"
          hover-class="usage-editor__add-button--pressed"
          @click="addUsage"
        >
          添加
        </view>
      </view>
      <text v-if="defaultUsageError" class="usage-editor__error">{{ defaultUsageError }}</text>
      <text v-else-if="!form.defaultUsages.length" class="usage-editor__empty">
        暂未添加默认用量
      </text>
    </section>

    <view
      class="project-editor__submit"
      :class="{ 'project-editor__submit--disabled': submitting }"
      role="button"
      :aria-disabled="submitting"
      hover-class="project-editor__submit--pressed"
      :hover-start-time="20"
      :hover-stay-time="80"
      @click="submit"
    >
      {{ submitLabel }}
    </view>
  </view>
</template>

<style scoped>
.project-editor { position: relative; z-index: 1; }
.project-form, .usage-editor { padding: 32rpx; border: 2rpx solid rgba(136, 103, 126, 0.08); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 16rpx 40rpx rgba(111, 76, 99, 0.07); }
.project-form__field { display: flex; min-width: 0; margin-top: 30rpx; color: #302a2f; font-size: 24rpx; font-weight: 600; flex-direction: column; }
.project-form__field:first-child { margin-top: 0; }
.project-form__label { line-height: 1.35; }
.project-form__required { color: #e33c52; }
.project-form__field > input, .project-form__input-shell { height: 82rpx; margin-top: 14rpx; box-sizing: border-box; border: 2rpx solid #e1dce5; border-radius: 16rpx; background: #ffffff; color: #292529; font-size: 24rpx; }
.project-form__field > input { padding: 0 20rpx; }
.project-form__input-shell { display: flex; align-items: center; gap: 16rpx; padding: 0 20rpx; }
.project-form__input-shell input { min-width: 0; height: 78rpx; flex: 1; color: #292529; font-size: 24rpx; }
.project-form__input-shell > text { flex: none; color: #716a70; font-size: 23rpx; font-weight: 400; }
.project-form__field-error, .usage-editor__error { margin-top: 10rpx; color: #b83f4c; font-size: 20rpx; font-weight: 400; line-height: 1.45; overflow-wrap: anywhere; }
.duration-shortcuts { margin-top: 22rpx; }
.duration-shortcuts__label { color: #746c77; font-size: 22rpx; }
.duration-shortcuts__options { display: flex; gap: 12rpx; margin-top: 14rpx; }
.duration-shortcuts__option { display: flex; min-width: 0; height: 70rpx; box-sizing: border-box; flex: 1; align-items: center; justify-content: center; border: 2rpx solid #e0dae4; border-radius: 15rpx; background: #ffffff; color: #4e484d; font-size: 22rpx; line-height: 1; transition: background-color 120ms ease, transform 120ms ease; }
.duration-shortcuts__option--active { border-color: #6841c2; background: #f4effd; color: #5b32b4; font-weight: 600; }
.duration-shortcuts__option--pressed { transform: scale(0.98); }
.duration-shortcuts__option--disabled { opacity: 0.58; }
.usage-editor { margin-top: 24rpx; }
.usage-editor__heading, .usage-editor__quick-add, .usage-editor__selected-row, .usage-editor__add-row, .usage-editor__picker-value { display: flex; align-items: center; }
.usage-editor__heading { justify-content: space-between; gap: 18rpx; }
.usage-editor__heading-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.usage-editor__title { color: #2c272b; font-size: 27rpx; font-weight: 700; }
.usage-editor__optional { color: #777078; font-size: 21rpx; font-weight: 400; }
.usage-editor__description { margin-top: 10rpx; color: #776f75; font-size: 20rpx; line-height: 1.45; }
.usage-editor__quick-add { min-height: 68rpx; flex: none; justify-content: center; gap: 6rpx; margin: 0; padding: 0 16rpx; border: 2rpx solid #6841c2; border-radius: 14rpx; background: #ffffff; color: #5d37ae; font-size: 20rpx; line-height: 1; }
.usage-editor__quick-add--pressed { background: #f5f0fc; }
.usage-editor__selected { margin-top: 24rpx; border-top: 2rpx solid rgba(137, 123, 132, 0.14); }
.usage-editor__selected-row { min-height: 76rpx; justify-content: space-between; gap: 18rpx; border-bottom: 2rpx solid rgba(137, 123, 132, 0.12); color: #423c41; font-size: 22rpx; overflow-wrap: anywhere; }
.usage-editor__selected-row > text { min-width: 0; flex: 1; }
.usage-editor__selected-row button { min-width: 88rpx; min-height: 68rpx; flex: none; margin: 0; padding: 0 10rpx; border: 0; background: transparent; color: #9f4750; font-size: 21rpx; line-height: 1; }
.usage-editor__add-row { align-items: stretch; gap: 12rpx; margin-top: 26rpx; }
.usage-editor__picker { min-width: 0; flex: 1.45; }
.usage-editor__picker-value, .usage-editor__quantity { height: 76rpx; box-sizing: border-box; border: 2rpx solid #e1dce5; border-radius: 15rpx; background: #ffffff; color: #4d464c; font-size: 21rpx; }
.usage-editor__picker-value { justify-content: space-between; gap: 10rpx; padding: 0 16rpx; }
.usage-editor__picker-value > text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.usage-editor__quantity { width: 132rpx; flex: none; padding: 0 14rpx; }
.usage-editor__add-button { display: flex; width: 102rpx; height: 76rpx; box-sizing: border-box; flex: none; align-items: center; justify-content: center; border-radius: 15rpx; background: #f2ecfb; color: #5c34b0; font-size: 22rpx; line-height: 1; }
.usage-editor__add-button--pressed { background: #e8def7; }
.usage-editor__add-button--disabled { opacity: 0.58; }
.usage-editor__empty { display: block; margin-top: 24rpx; color: #8a8289; font-size: 21rpx; text-align: center; }
.project-editor__submit { display: flex; width: 100%; height: 88rpx; box-sizing: border-box; align-items: center; justify-content: center; margin-top: 34rpx; padding: 0; border: 0; border-radius: 16rpx; background: linear-gradient(135deg, #7048df 0%, #4d2bd2 100%); box-shadow: 0 14rpx 32rpx rgba(91, 50, 185, 0.2); color: #ffffff; font-size: 28rpx; line-height: 1; }
.project-editor__submit--pressed { opacity: 0.9; transform: translateY(1rpx); }
.project-editor__submit--disabled { opacity: 0.58; }

@media (max-width: 360px) {
  .project-form, .usage-editor { padding-right: 24rpx; padding-left: 24rpx; }
  .usage-editor__heading { align-items: flex-start; flex-direction: column; }
  .usage-editor__quick-add { align-self: flex-end; }
  .usage-editor__add-row { flex-wrap: wrap; }
  .usage-editor__picker { flex-basis: calc(100% - 150rpx); }
}
</style>
