<script setup lang="ts">
import { reactive, watch } from "vue";
import type { InventoryUnitKind } from "@/domain/data-schema";
import type { CreateInventoryItemInput } from "@/services/inventory-management-service";

/** 新增库存物品表单的页面输入。 */
interface InventoryItemFormProps {
  /** 提交期间锁定全部字段和主操作，避免重复写入。 */
  submitting: boolean;
}

/** 新增库存物品表单向容器暴露的操作。 */
interface InventoryItemFormEmits {
  /** 提交新增库存物品草稿。 */
  submit: [input: CreateInventoryItemInput];
  /** 当前草稿是否偏离新增页的初始值。 */
  dirtyChange: [dirty: boolean];
}

const props = defineProps<InventoryItemFormProps>();
const emit = defineEmits<InventoryItemFormEmits>();

const form = reactive({
  name: "",
  unit: "",
  unitKind: "continuous" as InventoryUnitKind,
  initialQuantityInput: "0",
  note: "",
});
const pristineSignature = JSON.stringify(form);

watch(
  [
    () => form.name,
    () => form.unit,
    () => form.unitKind,
    () => form.initialQuantityInput,
    () => form.note,
  ],
  () => emit("dirtyChange", JSON.stringify(form) !== pristineSignature),
);

/** 从选择器值同步连续或离散计量方式。 */
function selectUnitKind(event: { detail: { value: string } }): void {
  form.unitKind = event.detail.value === "0" ? "continuous" : "discrete";
}

/** 将当前表单草稿交给容器执行新增用例。 */
function submit(): void {
  if (props.submitting) {
    return;
  }
  emit("submit", { ...form });
}
</script>

<template>
  <view class="item-editor">
    <view class="item-form">
      <view class="item-form__notice">
        <u-icon name="info-circle" color="#5842B8" size="18" />
        <text>首次库存会同时生成入库记录</text>
      </view>
      <label class="item-form__field">
        <text class="item-form__label">物品名称</text>
        <input
          v-model="form.name"
          :disabled="submitting"
          maxlength="40"
          placeholder="例如：修护面膜"
        />
      </label>
      <label class="item-form__field">
        <text class="item-form__label">计量单位</text>
        <input
          v-model="form.unit"
          :disabled="submitting"
          maxlength="12"
          placeholder="例如：片、毫升"
        />
      </label>
      <label class="item-form__field">
        <text class="item-form__label">计量方式</text>
        <picker
          :disabled="submitting"
          :range="['连续（可小数）', '离散（仅整数）']"
          :value="form.unitKind === 'continuous' ? 0 : 1"
          @change="selectUnitKind"
        >
          <view class="item-form__picker">
            <text>
              {{ form.unitKind === "continuous" ? "连续（可小数）" : "离散（仅整数）" }}
            </text>
            <u-icon name="arrow-down" color="#514B67" size="15" />
          </view>
        </picker>
      </label>
      <label class="item-form__field">
        <text class="item-form__label">首次库存</text>
        <input
          v-model="form.initialQuantityInput"
          :disabled="submitting"
          type="digit"
          maxlength="14"
        />
        <text class="item-form__helper">没有库存可填 0</text>
      </label>
      <label class="item-form__field">
        <text class="item-form__label">备注（选填）</text>
        <textarea
          v-model="form.note"
          :disabled="submitting"
          class="item-form__textarea"
          auto-height
          maxlength="200"
          placeholder="规格、品牌或存放位置"
        />
      </label>
    </view>
    <view
      class="item-form__submit"
      :class="{ 'item-form__submit--disabled': submitting }"
      role="button"
      :aria-disabled="submitting"
      hover-class="item-form__submit--pressed"
      :hover-start-time="20"
      :hover-stay-time="80"
      @click="submit"
    >
      {{ submitting ? "正在保存" : "保存物品" }}
    </view>
  </view>
</template>

<style scoped>
.item-editor { position: relative; z-index: 1; }

.item-form {
  padding: 32rpx;
  border: 2rpx solid rgba(136, 103, 126, 0.08);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16rpx 40rpx rgba(111, 76, 99, 0.07);
}

.item-form__notice {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 22rpx;
  border: 2rpx solid rgba(102, 72, 199, 0.1);
  border-radius: 14rpx;
  background: #faf7ff;
  color: #5842b8;
  font-size: 21rpx;
  line-height: 1.45;
}

.item-form__field {
  display: flex;
  min-width: 0;
  flex: 1;
  margin-top: 28rpx;
  color: #302a2f;
  font-size: 24rpx;
  font-weight: 600;
  flex-direction: column;
}

.item-form__label {
  color: inherit;
}

.item-form__field input,
.item-form__picker,
.item-form__textarea {
  height: 82rpx;
  margin-top: 14rpx;
  box-sizing: border-box;
  padding: 0 18rpx;
  border: 2rpx solid #e1dce5;
  border-radius: 16rpx;
  background: #ffffff;
  color: #292529;
  font-size: 24rpx;
}

.item-form__textarea {
  min-height: 156rpx;
  padding-top: 20rpx;
  padding-bottom: 20rpx;
  line-height: 1.5;
}

.item-form__picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  line-height: 82rpx;
}

.item-form__helper {
  margin-top: 10rpx;
  color: #837b8d;
  font-size: 20rpx;
  font-weight: 400;
}

.item-form__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 88rpx;
  margin: 34rpx 0 0;
  box-sizing: border-box;
  padding: 0;
  border: 0;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #7048df 0%, #4d2bd2 100%);
  color: #ffffff;
  font-size: 28rpx;
  line-height: 1;
}

.item-form__submit--pressed {
  opacity: 0.9;
  transform: translateY(1rpx);
}

.item-form__submit--disabled {
  opacity: 0.58;
}
</style>
