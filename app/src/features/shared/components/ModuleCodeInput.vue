<script setup lang="ts">
import { computed, shallowRef } from "vue";

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
const focused = shallowRef(false);

const digits = computed(() =>
  Array.from(
    { length: props.maxlength },
    (_, index) => moduleCode.value[index] ?? "",
  ),
);

function handleInput(event: InputEvent): void {
  const payload = event as unknown as {
    detail?: { value?: unknown };
    target?: { value?: unknown };
  };
  const inputValue = payload.detail?.value ?? payload.target?.value ?? "";
  moduleCode.value = String(inputValue)
    .replace(/\D/g, "")
    .slice(0, props.maxlength);
}
</script>

<template>
  <view
    class="module-code-input"
    :class="{
      'module-code-input--focused': focused,
      'module-code-input--disabled': props.disabled,
    }"
  >
    <input
      class="module-code-input__native"
      type="number"
      inputmode="numeric"
      :value="moduleCode"
      :maxlength="props.maxlength"
      :disabled="props.disabled"
      :aria-label="props.ariaLabel"
      :adjust-position="true"
      :cursor-spacing="18"
      @input="handleInput"
      @focus="focused = true"
      @blur="focused = false"
    />

    <view
      v-for="(digit, index) in digits"
      :key="index"
      class="module-code-input__cell"
      :class="{
        'module-code-input__cell--active':
          focused && moduleCode.length < props.maxlength && index === moduleCode.length,
        'module-code-input__cell--filled': Boolean(digit),
      }"
      aria-hidden="true"
    >
      <text v-if="digit" class="module-code-input__digit">{{ digit }}</text>
      <view
        v-else-if="focused && index === moduleCode.length"
        class="module-code-input__caret"
      />
    </view>
  </view>
</template>

<style scoped>
.module-code-input {
  position: relative;
  display: grid;
  width: 100%;
  max-width: 560rpx;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14rpx;
}

.module-code-input__native {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  opacity: 0.01;
  color: transparent;
  caret-color: transparent;
}

.module-code-input__cell {
  display: flex;
  min-width: 0;
  height: 86rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #9aa7bd;
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.74);
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.module-code-input__cell--active {
  border-color: #3d4a5d;
  box-shadow:
    0 0 0 4rpx rgba(61, 74, 93, 0.1),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.8);
}

.module-code-input__cell--filled {
  border-color: #6f7888;
}

.module-code-input__digit {
  color: #172033;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1;
}

.module-code-input__caret {
  width: 3rpx;
  height: 38rpx;
  border-radius: 2rpx;
  background: #3d4a5d;
  animation: module-code-caret 1s steps(2, jump-none) infinite;
}

.module-code-input--disabled {
  opacity: 0.56;
}

@keyframes module-code-caret {
  50% {
    opacity: 0;
  }
}

@media (max-width: 360px) {
  .module-code-input {
    gap: 10rpx;
  }

  .module-code-input__cell {
    height: 78rpx;
  }

  .module-code-input__digit {
    font-size: 36rpx;
  }
}
</style>
