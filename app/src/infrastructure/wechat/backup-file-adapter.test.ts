import { describe, expect, it, vi } from "vitest";
import {
  createWechatBackupFileAdapter,
  WechatFileOperationError,
  type WechatBackupFileRuntime,
  type WechatFileSystemManager,
} from "./backup-file-adapter";

function createRuntime(overrides: {
  fileSystem?: Partial<WechatFileSystemManager>;
  chooseMessageFile?: WechatBackupFileRuntime["chooseMessageFile"];
  shareFileMessage?: WechatBackupFileRuntime["shareFileMessage"];
} = {}): WechatBackupFileRuntime {
  const fileSystem: WechatFileSystemManager = {
    writeFile() {
      throw new Error("本测试不应调用 writeFile");
    },
    readFile() {
      throw new Error("本测试不应调用 readFile");
    },
    unlink() {
      throw new Error("本测试不应调用 unlink");
    },
    readdir() {
      throw new Error("本测试不应调用 readdir");
    },
    ...overrides.fileSystem,
  };

  return {
    env: { USER_DATA_PATH: "wxfile://usr" },
    getFileSystemManager: () => fileSystem,
    chooseMessageFile:
      overrides.chooseMessageFile ??
      (() => {
        throw new Error("本测试不应调用 chooseMessageFile");
      }),
    shareFileMessage:
      overrides.shareFileMessage ??
      (() => {
        throw new Error("本测试不应调用 shareFileMessage");
      }),
  };
}

describe("微信备份文件适配器", () => {
  it("在用户数据目录生成 UTF-8 JSON 文件", async () => {
    const writeFile = vi.fn(
      ({ success }: Parameters<WechatFileSystemManager["writeFile"]>[0]) =>
        success(),
    );
    const adapter = createWechatBackupFileAdapter(
      createRuntime({ fileSystem: { writeFile } }),
    );

    await expect(
      adapter.createJsonFile("美容管家备份_20260804_2030.json", '{"ok":true}'),
    ).resolves.toEqual({
      name: "美容管家备份_20260804_2030.json",
      path: "wxfile://usr/美容管家备份_20260804_2030.json",
    });
    expect(writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: "wxfile://usr/美容管家备份_20260804_2030.json",
        data: '{"ok":true}',
        encoding: "utf8",
      }),
    );
  });

  it("只允许当前目录下的 JSON 文件名", async () => {
    const adapter = createWechatBackupFileAdapter(createRuntime());

    await expect(
      adapter.createJsonFile("../backup.json", "{}"),
    ).rejects.toThrow("JSON 文件名无效");
    await expect(adapter.createJsonFile("backup.txt", "{}")).rejects.toThrow(
      "JSON 文件名无效",
    );
  });

  it("启动清理只删除产品生成的备份文件", async () => {
    const removed: string[] = [];
    const adapter = createWechatBackupFileAdapter(
      createRuntime({
        fileSystem: {
          readdir({ success }) {
            success({
              files: [
                "美容管家备份_20260808_1430.json",
                "美容管家备份_20261340_2561.json",
                "bm-application-data-rollback.json",
                "notes.json",
              ],
            });
          },
          unlink({ filePath, success }) {
            removed.push(filePath);
            success();
          },
        },
      }),
    );

    await adapter.removeGeneratedBackupFiles({
      createdBefore: new Date(2026, 7, 8, 15, 0),
    });

    expect(removed).toEqual([
      "wxfile://usr/美容管家备份_20260808_1430.json",
    ]);
  });

  it("启动清理保留安全年龄内仍可能被微信读取的备份", async () => {
    const removed: string[] = [];
    const adapter = createWechatBackupFileAdapter(
      createRuntime({
        fileSystem: {
          readdir({ success }) {
            success({
              files: [
                "美容管家备份_20260808_1430.json",
                "美容管家备份_20260808_1455.json",
              ],
            });
          },
          unlink({ filePath, success }) {
            removed.push(filePath);
            success();
          },
        },
      }),
    );

    await adapter.removeGeneratedBackupFiles({
      createdBefore: new Date(2026, 7, 8, 14, 45),
    });

    expect(removed).toEqual([
      "wxfile://usr/美容管家备份_20260808_1430.json",
    ]);
  });

  it("文件名缺少秒数时按该分钟结束计算安全年龄", async () => {
    const removed: string[] = [];
    const adapter = createWechatBackupFileAdapter(
      createRuntime({
        fileSystem: {
          readdir({ success }) {
            success({ files: ["美容管家备份_20260808_1445.json"] });
          },
          unlink({ filePath, success }) {
            removed.push(filePath);
            success();
          },
        },
      }),
    );

    await adapter.removeGeneratedBackupFiles({
      createdBefore: new Date(2026, 7, 8, 14, 45, 1),
    });
    expect(removed).toEqual([]);

    await adapter.removeGeneratedBackupFiles({
      createdBefore: new Date(2026, 7, 8, 14, 46),
    });
    expect(removed).toEqual([
      "wxfile://usr/美容管家备份_20260808_1445.json",
    ]);
  });

  it("从聊天中只选择一个 JSON 文件", async () => {
    const chooseMessageFile = vi.fn(({
      success,
    }: Parameters<WechatBackupFileRuntime["chooseMessageFile"]>[0]) => {
      success({
        tempFiles: [
          {
            name: "美容管家备份_20260804_2030.json",
            path: "wxfile://tmp/backup.json",
            size: 2048,
          },
        ],
      });
    });
    const adapter = createWechatBackupFileAdapter(
      createRuntime({ chooseMessageFile }),
    );

    await expect(adapter.chooseJsonFile()).resolves.toEqual({
      name: "美容管家备份_20260804_2030.json",
      path: "wxfile://tmp/backup.json",
      sizeBytes: 2048,
    });
    expect(chooseMessageFile).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1, type: "file", extension: ["json"] }),
    );
  });

  it("分享取消可与其他失败区分", async () => {
    const runtime = createRuntime({
      shareFileMessage({ fail }) {
        fail({ errMsg: "shareFileMessage:fail cancel" });
      },
    });
    const adapter = createWechatBackupFileAdapter(runtime);

    const error = await adapter
      .shareFile({ name: "backup.json", path: "wxfile://usr/backup.json" })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(WechatFileOperationError);
    expect(error).toMatchObject({ operation: "share", cancelled: true });
  });

  it("回滚快照写入独立临时文件并能读取和清理", async () => {
    const files = new Map<string, string>();
    const adapter = createWechatBackupFileAdapter(
      createRuntime({
        fileSystem: {
          writeFile({ filePath, data, success }) {
            files.set(filePath, data);
            success();
          },
          readFile({ filePath, success }) {
            success({ data: files.get(filePath) ?? "" });
          },
          unlink({ filePath, success }) {
            files.delete(filePath);
            success();
          },
        },
      }),
    );

    await adapter.writeRollbackSnapshot('{"before":"current-data"}');

    await expect(adapter.readRollbackSnapshot()).resolves.toBe(
      '{"before":"current-data"}',
    );
    await adapter.removeRollbackSnapshot();
    expect(files.size).toBe(0);
  });

  it("容量压力检查使用独立快照文件，不覆盖恢复快照", async () => {
    const files = new Map<string, string>();
    const adapter = createWechatBackupFileAdapter(
      createRuntime({
        fileSystem: {
          writeFile({ filePath, data, success }) {
            files.set(filePath, data);
            success();
          },
          readFile({ filePath, success }) {
            success({ data: files.get(filePath) ?? "" });
          },
          unlink({ filePath, success }) {
            files.delete(filePath);
            success();
          },
        },
      }),
    );

    await adapter.writeRollbackSnapshot('{"kind":"recovery"}');
    await adapter.writeCapacityProbeSnapshot('{"kind":"capacity"}');

    await expect(adapter.readRollbackSnapshot()).resolves.toBe(
      '{"kind":"recovery"}',
    );
    await expect(adapter.readCapacityProbeSnapshot()).resolves.toBe(
      '{"kind":"capacity"}',
    );
    expect(files.size).toBe(2);
  });

  it("产品整体恢复使用独立文件，不覆盖阶段 0 回滚探测", async () => {
    const files = new Map<string, string>();
    const adapter = createWechatBackupFileAdapter(
      createRuntime({
        fileSystem: {
          writeFile({ filePath, data, success }) {
            files.set(filePath, data);
            success();
          },
          readFile({ filePath, success }) {
            success({ data: files.get(filePath) ?? "" });
          },
        },
      }),
    );

    await adapter.writeRollbackSnapshot('{"kind":"stage0"}');
    await adapter.writeApplicationDataRollbackSnapshot(
      '{"kind":"application-data"}',
    );

    await expect(adapter.readRollbackSnapshot()).resolves.toBe(
      '{"kind":"stage0"}',
    );
    await expect(
      adapter.readApplicationDataRollbackSnapshot(),
    ).resolves.toBe('{"kind":"application-data"}');
    expect(files.size).toBe(2);
  });

  it("清理不存在的临时文件视为成功", async () => {
    const adapter = createWechatBackupFileAdapter(
      createRuntime({
        fileSystem: {
          unlink({ fail }) {
            fail({ errMsg: "unlink:fail no such file or directory" });
          },
        },
      }),
    );

    await expect(adapter.removeRollbackSnapshot()).resolves.toBeUndefined();
  });

  it("读取不存在的回滚快照时返回 undefined", async () => {
    const adapter = createWechatBackupFileAdapter(
      createRuntime({
        fileSystem: {
          readFile({ fail }) {
            fail({ errMsg: "readFile:fail no such file or directory" });
          },
        },
      }),
    );

    await expect(adapter.readRollbackSnapshotIfExists()).resolves.toBeUndefined();
  });
});
