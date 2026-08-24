import { describe, expect, it } from "vitest";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "./uni-storage-adapter";

describe("微信本地存储适配器", () => {
  it("读取不存在的 key 时返回 undefined", async () => {
    const runtime: UniStorageRuntime = {
      getStorage({ fail }) {
        fail({ errMsg: "getStorage:fail data not found" });
      },
      setStorage() {
        throw new Error("本测试不应调用 setStorage");
      },
      removeStorage() {
        throw new Error("本测试不应调用 removeStorage");
      },
      getStorageInfo() {
        throw new Error("本测试不应调用 getStorageInfo");
      },
    };

    const storage = createUniStorageAdapter(runtime);

    await expect(storage.get("missing")).resolves.toBeUndefined();
  });

  it("写入的数据可以通过同一接口读回", async () => {
    const data = new Map<string, unknown>();
    const runtime = {
      getStorage({
        key,
        success,
        fail,
      }: Parameters<UniStorageRuntime["getStorage"]>[0]) {
        if (!data.has(key)) {
          fail({ errMsg: "getStorage:fail data not found" });
          return;
        }

        success({ data: data.get(key) });
      },
      setStorage({
        key,
        data: value,
        success,
      }: {
        key: string;
        data: unknown;
        success: () => void;
      }) {
        data.set(key, value);
        success();
      },
      removeStorage({
        key,
        success,
      }: {
        key: string;
        success: () => void;
      }) {
        data.delete(key);
        success();
      },
      getStorageInfo() {
        throw new Error("本测试不应调用 getStorageInfo");
      },
    };

    const storage = createUniStorageAdapter(runtime);

    await storage.set("bm:modules:unlocked", ["beauty"]);

    await expect(
      storage.get("bm:modules:unlocked"),
    ).resolves.toEqual(["beauty"]);
  });

  it("删除后再次读取返回 undefined", async () => {
    const data = new Map<string, unknown>([
      ["bm:stage0:probe", { ok: true }],
    ]);
    const runtime = {
      getStorage({
        key,
        success,
        fail,
      }: Parameters<UniStorageRuntime["getStorage"]>[0]) {
        if (!data.has(key)) {
          fail({ errMsg: "getStorage:fail data not found" });
          return;
        }

        success({ data: data.get(key) });
      },
      setStorage() {
        throw new Error("本测试不应调用 setStorage");
      },
      removeStorage({
        key,
        success,
      }: {
        key: string;
        success: () => void;
      }) {
        data.delete(key);
        success();
      },
      getStorageInfo() {
        throw new Error("本测试不应调用 getStorageInfo");
      },
    };

    const storage = createUniStorageAdapter(runtime);

    await storage.remove("bm:stage0:probe");

    await expect(storage.get("bm:stage0:probe")).resolves.toBeUndefined();
  });

  it("读取 Storage 当前占用、上限和 key 列表", async () => {
    const runtime: UniStorageRuntime = {
      getStorage() {
        throw new Error("本测试不应调用 getStorage");
      },
      setStorage() {
        throw new Error("本测试不应调用 setStorage");
      },
      removeStorage() {
        throw new Error("本测试不应调用 removeStorage");
      },
      getStorageInfo({ success }) {
        success({
          keys: ["bm:modules:unlocked", "bm:stage0:probe"],
          currentSize: 128,
          limitSize: 10240,
        });
      },
    };

    const storage = createUniStorageAdapter(runtime);

    await expect(storage.getCapacityInfo()).resolves.toEqual({
      keys: ["bm:modules:unlocked", "bm:stage0:probe"],
      currentSizeKb: 128,
      limitSizeKb: 10240,
    });
  });

  it("读取 Storage 容量失败时保留平台错误信息", async () => {
    const runtime: UniStorageRuntime = {
      getStorage() {
        throw new Error("本测试不应调用 getStorage");
      },
      setStorage() {
        throw new Error("本测试不应调用 setStorage");
      },
      removeStorage() {
        throw new Error("本测试不应调用 removeStorage");
      },
      getStorageInfo({ fail }) {
        fail({ errMsg: "getStorageInfo:fail system error" });
      },
    };

    const storage = createUniStorageAdapter(runtime);

    await expect(storage.getCapacityInfo()).rejects.toThrow(
      "getStorageInfo:fail system error",
    );
  });
});
