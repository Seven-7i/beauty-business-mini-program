import { describe, expect, it } from "vitest";
import { unlockModule } from "./module-authorization";

describe("模块授权", () => {
  it("输入 587960 可以解锁美容模块", () => {
    const result = unlockModule("587960", []);

    expect(result).toEqual({
      status: "unlocked",
      moduleId: "beauty",
      unlockedModules: ["beauty"],
    });
  });

  it("输入无效授权码时不解锁模块", () => {
    const result = unlockModule("123456", []);

    expect(result).toEqual({
      status: "invalid",
      unlockedModules: [],
    });
  });

  it("重复输入授权码时不重复添加美容模块", () => {
    const result = unlockModule("587960", ["beauty"]);

    expect(result).toEqual({
      status: "already-unlocked",
      moduleId: "beauty",
      unlockedModules: ["beauty"],
    });
  });
});
