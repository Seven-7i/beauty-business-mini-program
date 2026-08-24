import { effectScope } from "vue";
import { describe, expect, it } from "vitest";
import type { StorageAdapter } from "@/infrastructure/storage/uni-storage-adapter";
import {
  WechatFileOperationError,
  type BackupFileAdapter,
} from "@/infrastructure/wechat/backup-file-adapter";
import { useCapabilityCheck } from "./useCapabilityCheck";

function createStorage(): StorageAdapter {
  const values = new Map<string, unknown>();

  return {
    async get<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    },
    async getCapacityInfo() {
      return {
        keys: [...values.keys()],
        currentSizeKb: Math.ceil(
          [...values.values()].reduce<number>(
            (total, value) => total + JSON.stringify(value).length,
            0,
          ) / 1024,
        ),
        limitSizeKb: 10240,
      };
    },
  };
}

describe("基础能力检查 composable", () => {
  it("在用户点击的同步调用栈内触发微信文件转发", async () => {
    const localFiles = new Map<string, string>();
    let rollbackContents = "";
    let userGestureActive = false;
    const files: BackupFileAdapter = {
      async createJsonFile(name, contents) {
        const path = `wxfile://usr/${name}`;
        localFiles.set(path, contents);
        return { name, path };
      },
      async readTextFile(path) {
        return localFiles.get(path) ?? "";
      },
      async chooseJsonFile() {
        return { name: "backup.json", path: "wxfile://tmp/backup.json", sizeBytes: 2 };
      },
      async shareFile() {
        if (!userGestureActive) {
          throw new Error(
            "shareFileMessage:fail can only be invoked by user TAP gesture",
          );
        }
      },
      async removeFile(path) {
        localFiles.delete(path);
      },
      async removeGeneratedBackupFiles() {},
      async writeRollbackSnapshot(contents) {
        rollbackContents = contents;
        return { name: "rollback.json", path: "wxfile://usr/rollback.json" };
      },
      async readRollbackSnapshot() {
        return rollbackContents;
      },
      async readRollbackSnapshotIfExists() {
        return undefined;
      },
      async removeRollbackSnapshot() {
        rollbackContents = "";
      },
      async writeCapacityProbeSnapshot(contents) {
        return { name: "capacity.json", path: `wxfile://usr/${contents.length}.json` };
      },
      async readCapacityProbeSnapshot() {
        return "";
      },
      async readCapacityProbeSnapshotIfExists() {
        return undefined;
      },
      async removeCapacityProbeSnapshot() {},
    };
    const scope = effectScope();
    const capability = scope.run(() =>
      useCapabilityCheck({ storage: createStorage(), files }),
    );

    expect(capability).toBeDefined();
    await capability?.runAutomatedChecks();

    userGestureActive = true;
    const check = capability?.checkShare();
    userGestureActive = false;
    await check;

    capability?.confirmShareSent();
    const share = capability?.checks.find((item) => item.id === "share");
    expect(share).toMatchObject({ status: "passed" });
    scope.stop();
  });

  it("微信返回转发成功后仍保留源文件供聊天发送", async () => {
    const localFiles = new Map<string, string>();
    let rollbackContents = "";
    let sharedFilePath = "";
    const files: BackupFileAdapter = {
      async createJsonFile(name, contents) {
        const path = `wxfile://usr/${name}`;
        localFiles.set(path, contents);
        return { name, path };
      },
      async readTextFile(path) {
        return localFiles.get(path) ?? "";
      },
      async chooseJsonFile() {
        return { name: "backup.json", path: "wxfile://tmp/backup.json", sizeBytes: 2 };
      },
      async shareFile(file) {
        sharedFilePath = file.path;
      },
      async removeFile(path) {
        localFiles.delete(path);
      },
      async removeGeneratedBackupFiles() {},
      async writeRollbackSnapshot(contents) {
        rollbackContents = contents;
        return { name: "rollback.json", path: "wxfile://usr/rollback.json" };
      },
      async readRollbackSnapshot() {
        return rollbackContents;
      },
      async readRollbackSnapshotIfExists() {
        return undefined;
      },
      async removeRollbackSnapshot() {
        rollbackContents = "";
      },
      async writeCapacityProbeSnapshot(contents) {
        return { name: "capacity.json", path: `wxfile://usr/${contents.length}.json` };
      },
      async readCapacityProbeSnapshot() {
        return "";
      },
      async readCapacityProbeSnapshotIfExists() {
        return undefined;
      },
      async removeCapacityProbeSnapshot() {},
    };
    const scope = effectScope();
    const capability = scope.run(() =>
      useCapabilityCheck({ storage: createStorage(), files }),
    );

    expect(capability).toBeDefined();
    await capability?.runAutomatedChecks();
    await capability?.checkShare();

    // 微信回调后才会继续完成聊天选择与发送，源文件此时必须仍然存在。
    expect(sharedFilePath).not.toBe("");
    expect(localFiles.has(sharedFilePath)).toBe(true);
    const share = capability?.checks.find((item) => item.id === "share");
    expect(share).toMatchObject({ status: "awaiting-confirmation" });
    expect(share?.detail).toContain("请确认实际结果");

    capability?.confirmShareSent();
    expect(share).toMatchObject({ status: "passed" });

    // 华为真机取消也可能返回 success；第二次必须重新进入待确认，不能保留旧成功状态。
    await capability?.checkShare();
    expect(share).toMatchObject({ status: "awaiting-confirmation" });
    capability?.confirmShareCancelled();
    expect(share).toMatchObject({
      status: "cancelled",
      detail: "已取消本次操作",
    });
    scope.stop();
  });

  it("分享取消时保留测试文件并显示取消信息", async () => {
    let latestContents = "{}";
    let rollbackContents = "";
    const files: BackupFileAdapter = {
      async createJsonFile(name, contents) {
        latestContents = contents;
        return { name, path: `wxfile://usr/${name}` };
      },
      async readTextFile() {
        return latestContents;
      },
      async chooseJsonFile() {
        return { name: "backup.json", path: "wxfile://tmp/backup.json", sizeBytes: 2 };
      },
      async shareFile() {
        throw new WechatFileOperationError("share", {
          errMsg: "shareFileMessage:fail cancel",
        });
      },
      async removeFile() {},
      async removeGeneratedBackupFiles() {},
      async writeRollbackSnapshot(contents) {
        rollbackContents = contents;
        return { name: "rollback.json", path: "wxfile://usr/rollback.json" };
      },
      async readRollbackSnapshot() {
        return rollbackContents;
      },
      async readRollbackSnapshotIfExists() {
        return undefined;
      },
      async removeRollbackSnapshot() {},
      async writeCapacityProbeSnapshot(contents) {
        return { name: "capacity.json", path: `wxfile://usr/${contents.length}.json` };
      },
      async readCapacityProbeSnapshot() {
        return "";
      },
      async readCapacityProbeSnapshotIfExists() {
        return undefined;
      },
      async removeCapacityProbeSnapshot() {},
    };
    const scope = effectScope();
    const capability = scope.run(() =>
      useCapabilityCheck({ storage: createStorage(), files }),
    );

    expect(capability).toBeDefined();
    await capability?.runAutomatedChecks();
    await capability?.checkShare();

    const share = capability?.checks.find((item) => item.id === "share");
    expect(share).toMatchObject({ status: "cancelled" });
    expect(share?.detail).toContain("已取消本次操作");
    scope.stop();
  });
});
