<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from "vue";
import type { InventoryItemV1 } from "@/domain/data-schema";
import type { AdjustInventoryInput } from "@/services/inventory-management-service";
import {
  decimalQuantityToHundredths,
  hundredthsToDecimalQuantity,
  parseDecimalQuantity,
} from "@/utils/decimal-quantity";

/** 库存调整表单的业务输入。 */
interface InventoryAdjustmentFormProps {
  /** 本次需要调整的库存物品。 */
  item: InventoryItemV1;
  /** 由卡片快捷入口决定的初始调整方式。 */
  initialKind: AdjustInventoryInput["kind"];
  /** 提交期间锁定表单，避免重复写入。 */
  submitting: boolean;
}

/** 库存调整表单向容器暴露的操作。 */
interface InventoryAdjustmentFormEmits {
  /** 提交一次已填写的补货或盘点修正。 */
  submit: [input: AdjustInventoryInput];
  /** 调整方式切换后同步原生导航栏标题。 */
  kindChange: [kind: AdjustInventoryInput["kind"]];
  /** 当前草稿是否偏离进入页面时的初始值。 */
  dirtyChange: [dirty: boolean];
}

const props = defineProps<InventoryAdjustmentFormProps>();
const emit = defineEmits<InventoryAdjustmentFormEmits>();

const form = reactive({
  kind: "restock" as AdjustInventoryInput["kind"],
  quantityInput: "",
  note: "",
});
const initialSignature = shallowRef("");
const parsedQuantity = computed(() => {
  if (!form.quantityInput.trim()) {
    return undefined;
  }
  try {
    return parseDecimalQuantity(form.quantityInput, {
      unitKind: props.item.unitKind,
      positive: form.kind === "restock",
    });
  } catch {
    return undefined;
  }
});
const beforeQuantity = computed(() => props.item.currentQuantity);
const deltaQuantity = computed(() => {
  const quantity = parsedQuantity.value;
  if (!quantity) {
    return undefined;
  }
  const quantityHundredths = decimalQuantityToHundredths(quantity);
  const currentHundredths = decimalQuantityToHundredths(
    props.item.currentQuantity,
  );
  return hundredthsToDecimalQuantity(
    form.kind === "restock"
      ? quantityHundredths
      : quantityHundredths - currentHundredths,
  );
});
const afterQuantity = computed(() => {
  const quantity = parsedQuantity.value;
  if (!quantity) {
    return undefined;
  }
  try {
    return form.kind === "restock"
      ? hundredthsToDecimalQuantity(
          decimalQuantityToHundredths(props.item.currentQuantity) +
            decimalQuantityToHundredths(quantity),
        )
      : quantity;
  } catch {
    return undefined;
  }
});
const deltaLabel = computed(() => {
  const delta = deltaQuantity.value;
  if (!delta) {
    return "—";
  }
  return decimalQuantityToHundredths(delta) > 0 ? `+${delta}` : delta;
});
const deltaTone = computed<"positive" | "negative" | "">(() => {
  const delta = deltaQuantity.value;
  if (!delta) {
    return "";
  }
  const hundredths = decimalQuantityToHundredths(delta);
  return hundredths > 0 ? "positive" : hundredths < 0 ? "negative" : "";
});

/** 根据卡片快捷入口初始化调整方式，并清空上一份调整草稿。 */
function resetAdjustmentDraft(): void {
  form.kind = props.initialKind;
  form.quantityInput = "";
  form.note = "";
  initialSignature.value = JSON.stringify(form);
  emit("dirtyChange", false);
}

/** 切换补货或盘点语义，并通知路由同步独立页标题。 */
function selectKind(kind: AdjustInventoryInput["kind"]): void {
  if (props.submitting || form.kind === kind) {
    return;
  }
  form.kind = kind;
  form.quantityInput = "";
  emit("kindChange", kind);
}

watch(
  [() => props.item.id, () => props.initialKind],
  resetAdjustmentDraft,
  { immediate: true },
);
watch(
  [() => form.kind, () => form.quantityInput, () => form.note],
  () => emit("dirtyChange", JSON.stringify(form) !== initialSignature.value),
);

/** 将表单草稿转换为 service 接受的库存调整命令。 */
function submit(): void {
  if (props.submitting) {
    return;
  }

  emit("submit", {
    inventoryItemId: props.item.id,
    kind: form.kind,
    quantityInput: form.quantityInput,
    note: form.note,
  });
}
</script>

<template>
  <view class="adjustment">
    <view class="adjustment__switch" role="tablist" aria-label="调整方式">
      <view
        :class="[
          'adjustment__switch-button',
          {
            'adjustment__switch-button--active': form.kind === 'restock',
            'adjustment__switch-button--disabled': submitting,
          },
        ]"
        role="tab"
        :aria-selected="form.kind === 'restock'"
        :aria-disabled="submitting"
        hover-class="adjustment__switch-button--pressed"
        :hover-start-time="20"
        :hover-stay-time="80"
        @click="selectKind('restock')"
      >
        补货增加
      </view>
      <view
        :class="[
          'adjustment__switch-button',
          {
            'adjustment__switch-button--active': form.kind === 'stocktake',
            'adjustment__switch-button--disabled': submitting,
          },
        ]"
        role="tab"
        :aria-selected="form.kind === 'stocktake'"
        :aria-disabled="submitting"
        hover-class="adjustment__switch-button--pressed"
        :hover-start-time="20"
        :hover-stay-time="80"
        @click="selectKind('stocktake')"
      >
        盘点修正
      </view>
    </view>
    <view v-if="form.kind === 'stocktake'" class="adjustment__notice">
      <u-icon name="info-circle" color="#C26723" size="18" />
      <text>填写盘点后的实际库存，系统将自动计算差额</text>
    </view>
    <label class="adjustment__field">
      <text>{{ form.kind === "restock" ? "本次增加数量" : "盘点后的实际库存" }}</text>
      <view class="adjustment__input-wrap">
        <input
          v-model="form.quantityInput"
          :disabled="submitting"
          type="digit"
          maxlength="14"
          placeholder="0"
        />
        <text>{{ item.unit }}</text>
      </view>
    </label>
    <view class="adjustment__preview" aria-label="库存调整预览">
      <view class="adjustment__preview-item">
        <text>调整前</text>
        <text>{{ beforeQuantity }}</text>
      </view>
      <view class="adjustment__preview-divider" aria-hidden="true" />
      <view class="adjustment__preview-item">
        <text>{{ form.kind === "restock" ? "本次" : "差额" }}</text>
        <text
          :class="{
            'adjustment__delta--positive': deltaTone === 'positive',
            'adjustment__delta--negative': deltaTone === 'negative',
          }"
        >
          {{ deltaLabel }}
        </text>
      </view>
      <view class="adjustment__preview-divider" aria-hidden="true" />
      <view class="adjustment__preview-item">
        <text>调整后</text>
        <text>{{ afterQuantity ?? "—" }}</text>
      </view>
    </view>
    <label class="adjustment__field">
      <text>备注（选填）</text>
      <textarea
        v-model="form.note"
        :disabled="submitting"
        class="adjustment__textarea"
        auto-height
        maxlength="200"
        placeholder="例如：到货批次或盘点原因"
      />
    </label>
    <view
      class="adjustment__submit"
      :class="{ 'adjustment__submit--disabled': submitting }"
      role="button"
      :aria-disabled="submitting"
      hover-class="adjustment__submit--pressed"
      :hover-start-time="20"
      :hover-stay-time="80"
      @click="submit"
    >
      {{
        submitting
          ? "正在保存"
          : form.kind === "restock"
            ? "确认补货"
            : "确认盘点修正"
      }}
    </view>
  </view>
</template>

<style scoped>
.adjustment {
  padding: 32rpx;
  border: 2rpx solid rgba(136, 103, 126, 0.08);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16rpx 40rpx rgba(111, 76, 99, 0.07);
}

.adjustment__switch {
  display: flex;
  align-items: center;
}

.adjustment__field {
  display: flex;
  flex-direction: column;
}

.adjustment__switch {
  overflow: hidden;
  border: 2rpx solid #7042d9;
  border-radius: 16rpx;
}

.adjustment__switch-button {
  display: flex;
  height: 78rpx;
  flex: 1;
  align-items: center;
  justify-content: center;
  margin: 0;
  box-sizing: border-box;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: #ffffff;
  color: #6138bf;
  font-size: 25rpx;
  line-height: 1;
}

.adjustment__switch-button--active {
  background: linear-gradient(135deg, #7048df 0%, #4d2bd2 100%);
  color: #ffffff;
}

.adjustment__switch-button--pressed { opacity: 0.82; }
.adjustment__switch-button--disabled { opacity: 0.58; }

.adjustment__notice {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 24rpx;
  padding: 20rpx 22rpx;
  border-radius: 14rpx;
  background: #fff5ec;
  color: #b75a18;
  font-size: 21rpx;
  line-height: 1.45;
}

.adjustment__field {
  margin-top: 28rpx;
  color: #302a2f;
  font-size: 24rpx;
  font-weight: 600;
}

.adjustment__input-wrap,
.adjustment__textarea {
  margin-top: 14rpx;
  box-sizing: border-box;
  border: 2rpx solid #e1dce5;
  border-radius: 16rpx;
  background: #ffffff;
  color: #292529;
}

.adjustment__input-wrap {
  display: flex;
  height: 92rpx;
  align-items: center;
  gap: 16rpx;
  padding: 0 24rpx;
}

.adjustment__input-wrap input {
  min-width: 0;
  height: 88rpx;
  flex: 1;
  font-size: 34rpx;
  font-weight: 650;
}

.adjustment__input-wrap text {
  color: #8a8389;
  font-size: 23rpx;
}

.adjustment__textarea {
  min-height: 146rpx;
  padding: 20rpx 22rpx;
  font-size: 24rpx;
  line-height: 1.5;
}

.adjustment__preview {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
  padding: 24rpx 12rpx;
  border-radius: 18rpx;
  background: #faf8fb;
}

.adjustment__preview-item {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  color: #777076;
  font-size: 21rpx;
  flex-direction: column;
}

.adjustment__preview-item text:last-child {
  max-width: 100%;
  margin-top: 10rpx;
  color: #5c565b;
  font-size: 29rpx;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.adjustment__preview-divider {
  width: 2rpx;
  height: 68rpx;
  flex: none;
  background: rgba(137, 123, 132, 0.18);
}

.adjustment__preview-item .adjustment__delta--positive { color: #25a35a; }
.adjustment__preview-item .adjustment__delta--negative { color: #ee2455; }

.adjustment__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 88rpx;
  margin: 30rpx 0 0;
  box-sizing: border-box;
  padding: 0;
  border: 0;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #7048df 0%, #4d2bd2 100%);
  color: #ffffff;
  font-size: 28rpx;
  line-height: 1;
}

.adjustment__submit--pressed {
  opacity: 0.9;
  transform: translateY(1rpx);
}

.adjustment__submit--disabled { opacity: 0.58; }
</style>
