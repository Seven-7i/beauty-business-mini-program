const KEYBOARD_CLEARANCE_PX = 16;

/**
 * 在键盘覆盖页面时为保存按钮追加等高滚动空间。
 * 额外留出少量间距，避免按钮紧贴键盘边缘而难以点按。
 */
export function keyboardSpacerHeight(keyboardHeight: number): number {
  if (!Number.isFinite(keyboardHeight) || keyboardHeight <= 0) {
    return 0;
  }
  return Math.ceil(keyboardHeight) + KEYBOARD_CLEARANCE_PX;
}
