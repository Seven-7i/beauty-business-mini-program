<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    maxlength?: number;
    disabled?: boolean;
    ariaLabel?: string;
  }>(),
  {
    maxlength: 6,
    disabled: false,
    ariaLabel: "模块授权码",
  },
);

const moduleCode = defineModel<string>({ required: true });

function handleInput(value: string | number): void {
  moduleCode.value = String(value)
    .replace(/\D/g, "")
    .slice(0, props.maxlength);
}
</script>

<template>
  <view
    class="module-code-input"
    :class="{ 'module-code-input--disabled': props.disabled }"
  >
    <up-code-input
      :model-value="moduleCode"
      :maxlength="props.maxlength"
      mode="box"
      size="80rpx"
      space="14rpx"
      font-size="40rpx"
      color="#172033"
      border-color="#9AA7BD"
      :bold="true"
      :hairline="true"
      :disabled-dot="true"
      :disabled-keyboard="props.disabled"
      :adjust-position="true"
      :aria-label="props.ariaLabel"
      @update:model-value="handleInput"
    />
  </view>
</template>

<style scoped>
.module-code-input {
  display: flex;
  width: 550rpx;
  height: 80rpx;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.module-code-input--disabled {
  opacity: 0.56;
}
</style>
