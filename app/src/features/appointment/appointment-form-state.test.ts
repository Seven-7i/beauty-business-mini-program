import { describe, expect, it } from "vitest";
import { applyProjectSelection } from "./appointment-form-state";

describe("预约表单项目选择", () => {
  it("选择器确认项目后立即加入预约项目组合", () => {
    expect(applyProjectSelection([], "project-1")).toEqual({
      projectIds: ["project-1"],
      changed: true,
    });
  });

  it("重复选择已有项目时不改变项目组合", () => {
    expect(applyProjectSelection(["project-1"], "project-1")).toEqual({
      projectIds: ["project-1"],
      changed: false,
    });
  });
});
