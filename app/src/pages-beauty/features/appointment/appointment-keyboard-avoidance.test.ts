import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keyboardSpacerHeight } from "./appointment-keyboard-avoidance";

describe("appointment keyboard avoidance", () => {
  it("adds scrollable space equal to the keyboard plus a small clearance", () => {
    expect(keyboardSpacerHeight(0)).toBe(0);
    expect(keyboardSpacerHeight(312)).toBe(328);
    expect(keyboardSpacerHeight(-1)).toBe(0);
  });

  it("wires keyboard height changes to a spacer after the submit button", () => {
    const source = readFileSync(
      new URL("./components/AppointmentForm.vue", import.meta.url),
      "utf8",
    );

    expect(source).toContain('@keyboardheightchange="handleKeyboardHeightChange"');
    expect(source).toContain('class="appointment-form__keyboard-spacer"');
    expect(source).toContain(':style="keyboardSpacerStyle"');
  });
});
