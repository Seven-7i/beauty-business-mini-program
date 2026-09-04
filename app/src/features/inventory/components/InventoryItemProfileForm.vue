<script setup lang="ts">
import { reactive, shallowRef, watch } from "vue";
import type { InventoryItemV1 } from "@/domain/data-schema";
import type { UpdateInventoryItemProfileInput } from "@/services/inventory-management-service";

/** 库存物品资料表单的业务输入。 */
interface InventoryItemProfileFormProps {
  /** 当前编辑的库存物品。 */
  item: InventoryItemV1;
  /** 提交期间锁定资料与低频操作。 */
  submitting: boolean;
  /** 物品已有业务引用时锁定计量单位，避免历史数量失去含义。 */
  unitLocked: boolean;
}

/** 库存物品资料表单向容器暴露的操作。 */
interface InventoryItemProfileFormEmits {
  /** 提交名称、单位和备注修改。 */
  submit: [input: UpdateInventoryItemProfileInput];
  /** 当前草稿是否偏离载入的物品资料。 */
  dirtyChange: [dirty: boolean];
}

const props = defineProps<InventoryItemProfileFormProps>();
const emit = defineEmits<InventoryItemProfileFormEmits>();

const form = reactive({ name: "", unit: "", note: "" });
const initialSignature = shallowRef("");

/** 切换物品时重新载入资料快照。 */
function loadItem(): void {
  form.name = props.item.name;
  form.unit = props.item.unit;
  form.note = props.item.note ?? "";
  initialSignature.value = JSON.stringify(form);
  emit("dirtyChange", false);
}

watch(() => props.item.id, loadItem, { immediate: true });
watch(
  [() => form.name, () => form.unit, () => form.note],
  () => emit("dirtyChange", JSON.stringify(form) !== initialSignature.value),
);

/** 将当前资料草稿转换为 service 接受的更新命令。 */
function submit(): void {
  if (props.submitting) {
    return;
  }

  emit("submit", {
    inventoryItemId: props.item.id,
    name: form.name,
    unit: form.unit,
    note: form.note,
  });
}
</script>

<template>
  <view class="profile-editor">
    <view class="profile-form">
      <view class="profile-form__notice">
        <u-icon name="info-circle" color="#5842B8" size="18" />
        <text>当前库存和计量精度不会随资料编辑改变。</text>
      </view>
      <label class="profile-form__field">
        <text>物品名称</text>
        <input v-model="form.name" :disabled="submitting" maxlength="40" />
      </label>
      <label class="profile-form__field">
        <text>计量单位</text>
        <input
          v-model="form.unit"
          :disabled="submitting || unitLocked"
          maxlength="12"
        />
        <text v-if="unitLocked" class="profile-form__helper">
          已被业务引用后不可修改单位
        </text>
      </label>
      <label class="profile-form__field">
        <text>备注（选填）</text>
        <textarea
          v-model="form.note"
          class="profile-form__textarea"
          :disabled="submitting"
          auto-height
          maxlength="200"
        />
      </label>
    </view>
    <view
      class="profile-form__submit"
      :class="{ 'profile-form__submit--disabled': submitting }"
      role="button"
      :aria-disabled="submitting"
      hover-class="profile-form__submit--pressed"
      :hover-start-time="20"
      :hover-stay-time="80"
      @click="submit"
    >
      {{ submitting ? "正在保存" : "保存修改" }}
    </view>
  </view>
</template>

<style scoped>
.profile-editor { position: relative; z-index: 1; }
.profile-form {
  padding: 32rpx;
  border: 2rpx solid rgba(136, 103, 126, 0.08);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16rpx 40rpx rgba(111, 76, 99, 0.07);
}

.profile-form__notice {
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

.profile-form__field {
  display: flex;
  min-width: 0;
  flex: 1;
  margin-top: 28rpx;
  color: #302a2f;
  font-size: 24rpx;
  font-weight: 600;
  flex-direction: column;
}

.profile-form__field input,
.profile-form__textarea {
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

.profile-form__textarea {
  min-height: 156rpx;
  padding-top: 20rpx;
  padding-bottom: 20rpx;
  line-height: 1.5;
}

.profile-form__helper {
  margin-top: 10rpx;
  color: #837b8d;
  font-size: 20rpx;
  font-weight: 400;
}

.profile-form__submit {
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

.profile-form__submit--pressed {
  opacity: 0.9;
  transform: translateY(1rpx);
}

.profile-form__submit--disabled {
  opacity: 0.58;
}
</style>
