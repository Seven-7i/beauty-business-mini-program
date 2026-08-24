import { describe, expect, it } from "vitest";
import { ensureApplicationDataRecovered } from "./application-startup";

describe("应用启动恢复门", () => {
  it("合并同时发起的检查，并在完成后允许下一次重新检查", async () => {
    let callCount = 0;
    let releaseFirst: ((value: "none") => void) | undefined;
    const repository = {
      recoverInterruptedReplace() {
        callCount += 1;
        if (callCount === 1) {
          return new Promise<"none">((resolve) => {
            releaseFirst = resolve;
          });
        }
        return Promise.resolve<"none">("none");
      },
    };

    const appCheck = ensureApplicationDataRecovered(repository);
    const pageCheck = ensureApplicationDataRecovered(repository);
    expect(callCount).toBe(1);
    releaseFirst?.("none");
    await expect(Promise.all([appCheck, pageCheck])).resolves.toEqual([
      "none",
      "none",
    ]);

    await expect(ensureApplicationDataRecovered(repository)).resolves.toBe(
      "none",
    );
    expect(callCount).toBe(2);
  });
});
