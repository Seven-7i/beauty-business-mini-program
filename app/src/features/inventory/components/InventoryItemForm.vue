<script setup lang="ts">
import { reactive } from "vue";
import type { InventoryUnitKind } from "@/domain/data-schema";
import type { CreateInventoryItemInput } from "@/services/inventory-management-service";

defineProps<{
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "submit", input: CreateInventoryItemInput): void;
}>();

const form = reactive({
  name: "",
  unit: "",
  unitKind: "continuous" as InventoryUnitKind,
  initialQuantityInput: "0",
  note: "",
});

function selectUnitKind(event: { detail: { value: string } }): void {
  form.unitKind = event.detail.value === "0" ? "continuous" : "discrete";
}

function submit(): void {
  emit("submit", { ...form });
}

/** 成功保存后由容器调用，失败时保留输入便于用户修正。 */
function reset(): void {
  form.name = "";
  form.unit = "";
  form.unitKind = "continuous";
  form.initialQuantityInput = "0";
  form.note = "";
}

defineExpose({ reset });
</script>

<template>
  <view class="item-form">
    <view class="item-form__heading">
      <text class="item-form__title">新增库存物品</text>
      <text class="item-form__hint">首次库存会同时生成入库记录</text>
    </view>

    <label class="item-form__field">
      <text class="item-form__label">物品名称</text>
      <input v-model="form.name" maxlength="40" placeholder="例如：修护面膜" />
    </label>
    <view class="item-form__row">
      <label class="item-form__field item-form__field--half">
        <text class="item-form__label">计量单位</text>
        <input v-model="form.unit" maxlength="12" placeholder="片 / 毫升" />
      </label>
      <label class="item-form__field item-form__field--half">
        <text class="item-form__label">计量方式</text>
        <picker
          :range="['连续（可小数）', '离散（仅整数）']"
          :value="form.unitKind === 'continuous' ? 0 : 1"
          @change="selectUnitKind"
        >
          <view class="item-form__picker">
            {{ form.unitKind === "continuous" ? "连续（可小数）" : "离散（仅整数）" }}
          </view>
        </picker>
      </label>
    </view>
    <label class="item-form__field">
      <text class="item-form__label">首次库存</text>
      <input
        v-model="form.initialQuantityInput"
        type="digit"
        maxlength="14"
        placeholder="没有库存可填 0"
      />
    </label>
    <label class="item-form__field">
      <text class="item-form__label">备注（选填）</text>
      <textarea
        v-model="form.note"
        class="item-form__textarea"
        auto-height
        maxlength="200"
        placeholder="规格、品牌或存放位置"
      />
    </label>

    <button class="item-form__submit" :disabled="submitting" @click="submit">
      {{ submitting ? "正在保存" : "保存物品" }}
    </button>
  </view>
</template>

<style scoped>
.item-form {
  padding: 30rpx;
  border: 2rpx solid #e0e5ec;
  border-radius: 20rpx;
  background: #ffffff;
}

.item-form__heading,
.item-form__field {
  display: flex;
  flex-direction: column;
}

.item-form__title {
  color: #1e293b;
  font-size: 31rpx;
  font-weight: 700;
}

.item-form__hint {
  margin-top: 8rpx;
  color: #778195;
  font-size: 22rpx;
}

.item-form__field {
  margin-top: 24rpx;
}

.item-form__row {
  display: flex;
  gap: 18rpx;
}

.item-form__field--half {
  min-width: 0;
  flex: 1;
}

.item-form__label {
  margin-bottom: 10rpx;
  color: #465168;
  font-size: 23rpx;
  font-weight: 600;
}

.item-form__field input,
.item-form__picker,
.item-form__textarea {
  height: 76rpx;
  box-sizing: border-box;
  padding: 0 20rpx;
  border: 2rpx solid #dce2ea;
  border-radius: 12rpx;
  background: #f9fafc;
  color: #243047;
  font-size: 25rpx;
  line-height: 76rpx;
}

.item-form__textarea {
  min-height: 82rpx;
  padding-top: 18rpx;
  padding-bottom: 18rpx;
  line-height: 1.5;
}

.item-form__picker {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-form__submit {
  height: 82rpx;
  margin-top: 28rpx;
  border-radius: 14rpx;
  background: #3159b5;
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 82rpx;
}

.item-form__submit[disabled] {
  background: #9aa9ca;
}
</style>
