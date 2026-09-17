import { nextTick, onBeforeUnmount, onMounted, type Ref } from "vue";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * 为 H5 语义弹层约束并恢复键盘焦点；小程序端没有 DOM 时安全跳过。
 * 弹层自身继续使用微信原生控件，避免把 H5 辅助逻辑带入业务状态。
 */
export function useDialogFocusTrap(
  panel: Readonly<Ref<HTMLElement | null>>,
  closeOnEscape: () => void,
): void {
  let previouslyFocused: HTMLElement | null = null;

  function focusableElements(): HTMLElement[] {
    return panel.value
      ? Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      closeOnEscape();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = focusableElements();
    if (!focusable.length) {
      event.preventDefault();
      panel.value?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  onMounted(() => {
    if (typeof document === "undefined") return;
    previouslyFocused = document.activeElement as HTMLElement | null;
    void nextTick(() => {
      const target = focusableElements()[0] ?? panel.value;
      target?.focus();
      panel.value?.addEventListener("keydown", handleKeydown);
    });
  });

  onBeforeUnmount(() => {
    panel.value?.removeEventListener("keydown", handleKeydown);
    previouslyFocused?.focus();
  });
}
