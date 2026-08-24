import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import type { BackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createBackupFileContent } from "./backup-envelope";
import {
  createBackupRestoreService,
  type BackupRestoreRepository,
} from "./backup-restore-service";

const NOW = new Date(2026, 7, 8, 14, 30, 0, 0);

function createData(name = "当前数据"): ApplicationData {
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1, defaultModuleId: "beauty" },
    unlockedModules: ["beauty"],
    backupMetadata: { schemaVersion: 1 },
    inventoryItems: [
      {
        id: "item-1",
        name,
        unit: "瓶",
        unitKind: "discrete",
        currentQuantity: "2",
        status: "active",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    ],
    inventoryMovements: [],
    projects: [],
    customers: [],
    appointments: [],
  };
}

function createRepository(initial = createData()) {
  let snapshot = structuredClone(initial);
  let reads = 0;
  const replacements: ApplicationData[] = [];
  const repository: BackupRestoreRepository = {
    async readSnapshot() {
      reads += 1;
      return structuredClone(snapshot);
    },
    async replaceSnapshot(data) {
      snapshot = structuredClone(data);
      replacements.push(structuredClone(data));
    },
    async replaceSelectedModules(data) {
      if (data.beauty) {
        snapshot = {
          ...snapshot,
          ...structuredClone(data.beauty),
        };
      }
    },
    async recordSuccessfulExport(exportedAt, fileName) {
      snapshot.backupMetadata = {
        ...snapshot.backupMetadata,
        lastExportedAt: exportedAt,
        lastExportFileName: fileName,
      };
    },
  };
  return {
    repository,
    replacements,
    readCount: () => reads,
    current: () => structuredClone(snapshot),
    setCurrent(data: ApplicationData) {
      snapshot = structuredClone(data);
    },
  };
}

function createFiles() {
  const contents = new Map<string, string>();
  let chosen = {
    name: "selected.json",
    path: "wxfile://tmp/selected.json",
    sizeBytes: 2,
  };
  const sharedPaths: string[] = [];
  const removedPaths: string[] = [];
  const files: BackupFileAdapter = {
    async createJsonFile(name, text) {
      const path = `wxfile://usr/${name}`;
      contents.set(path, text);
      return { name, path };
    },
    async readTextFile(path) {
      const text = contents.get(path);
      if (text === undefined) {
        throw new Error("file not found");
      }
      return text;
    },
    async chooseJsonFile() {
      return chosen;
    },
    async shareFile(file) {
      sharedPaths.push(file.path);
    },
    async removeFile(path) {
      removedPaths.push(path);
      contents.delete(path);
    },
    async removeGeneratedBackupFiles() {
      for (const path of [...contents.keys()]) {
        if (path.includes("美容管家备份_")) {
          contents.delete(path);
        }
      }
    },
    async writeRollbackSnapshot(text) {
      contents.set("rollback", text);
      return { name: "rollback.json", path: "rollback" };
    },
    async readRollbackSnapshot() {
      return contents.get("rollback") ?? "";
    },
    async readRollbackSnapshotIfExists() {
      return contents.get("rollback");
    },
    async removeRollbackSnapshot() {
      contents.delete("rollback");
    },
    async writeCapacityProbeSnapshot(text) {
      contents.set("capacity", text);
      return { name: "capacity.json", path: "capacity" };
    },
    async readCapacityProbeSnapshot() {
      return contents.get("capacity") ?? "";
    },
    async readCapacityProbeSnapshotIfExists() {
      return contents.get("capacity");
    },
    async removeCapacityProbeSnapshot() {
      contents.delete("capacity");
    },
  };
  return {
    files,
    contents,
    sharedPaths,
    removedPaths,
    setChosen(next: typeof chosen) {
      chosen = next;
    },
  };
}

describe("产品备份恢复服务", () => {
  it("生成可预检的完整备份，并使用本地时间命名文件", async () => {
    const { repository } = createRepository();
    const local = createFiles();
    const service = createBackupRestoreService({
      repository,
      files: local.files,
      appVersion: "1.0.0",
      now: () => NOW,
    });

    const prepared = await service.prepareExport();

    expect(prepared.file.name).toBe("庄月空间系统备份_20260808_1430.json");
    expect(local.contents.get(prepared.file.path)).toContain(
      '"format": "zhuangyue-local-backup"',
    );
  });

  it("选择美容模块时生成不含全局字段的模块文件", async () => {
    const { repository } = createRepository();
    const local = createFiles();
    const service = createBackupRestoreService({
      repository,
      files: local.files,
      appVersion: "1.0.0",
      now: () => NOW,
    });

    const prepared = await service.prepareExport({
      kind: "modules",
      moduleIds: ["beauty"],
    });
    const envelope = JSON.parse(
      local.contents.get(prepared.file.path) as string,
    ) as { data: { beauty: Record<string, unknown> } };

    expect(prepared.file.name).toBe("庄月空间美容备份_20260808_1430.json");
    expect(envelope.data.beauty).not.toHaveProperty("settings");
    expect(envelope.data.beauty).not.toHaveProperty("backupMetadata");
  });

  it("分享已准备文件时同步进入文件适配器调用", async () => {
    const { repository } = createRepository();
    const local = createFiles();
    let userGestureActive = false;
    local.files.shareFile = async () => {
      if (!userGestureActive) {
        throw new Error("share must run inside user gesture");
      }
    };
    const service = createBackupRestoreService({
      repository,
      files: local.files,
      appVersion: "1.0.0",
      now: () => NOW,
    });
    const prepared = await service.prepareExport();

    userGestureActive = true;
    const sharing = service.sharePreparedExport(prepared);
    userGestureActive = false;

    await expect(sharing).resolves.toBeUndefined();
  });

  it("仅在用户确认实际发送后，把最近导出信息写入最新快照", async () => {
    const data = createRepository();
    const local = createFiles();
    const service = createBackupRestoreService({
      repository: data.repository,
      files: local.files,
      appVersion: "1.0.0",
      now: () => NOW,
    });
    const prepared = await service.prepareExport();
    data.setCurrent(createData("确认前新增数据"));

    await service.recordConfirmedExport(prepared);

    expect(data.current().inventoryItems[0].name).toBe("确认前新增数据");
    expect(data.current().backupMetadata).toMatchObject({
      lastExportedAt: NOW.toISOString(),
      lastExportFileName: prepared.file.name,
    });
  });

  it("模块备份确认发送不会更新完整系统备份提醒基准", async () => {
    const data = createRepository();
    const local = createFiles();
    const service = createBackupRestoreService({
      repository: data.repository,
      files: local.files,
      appVersion: "1.0.0",
      now: () => NOW,
    });
    const prepared = await service.prepareExport({
      kind: "modules",
      moduleIds: ["beauty"],
    });

    await service.recordConfirmedExport(prepared);

    expect(data.current().backupMetadata.lastExportedAt).toBeUndefined();
    expect(data.current().backupMetadata.lastExportFileName).toBeUndefined();
  });

  it("有效文件只完成预检，用户确认前不替换当前数据", async () => {
    const current = createRepository(createData("旧数据"));
    const local = createFiles();
    const candidate = createData("备份数据");
    const backup = createBackupFileContent({
      data: candidate,
      createdAt: NOW.toISOString(),
      appVersion: "1.0.0",
    });
    local.contents.set("wxfile://tmp/selected.json", backup);
    local.setChosen({
      name: "selected.json",
      path: "wxfile://tmp/selected.json",
      sizeBytes: backup.length,
    });
    const service = createBackupRestoreService({
      repository: current.repository,
      files: local.files,
      appVersion: "1.0.0",
    });

    const selected = await service.selectRestoreFile();

    expect(selected.summary.inventoryItemCount).toBe(1);
    expect(current.readCount()).toBe(0);
    expect(current.replacements).toHaveLength(0);
    expect(current.current().inventoryItems[0].name).toBe("旧数据");

    await expect(service.inspectCurrentDataForRestore(selected)).resolves.toBe(true);
    expect(current.readCount()).toBe(1);

    await service.restoreSelectedBackup(selected);
    expect(current.current().inventoryItems[0].name).toBe("备份数据");
  });

  it("美容模块恢复保留当前系统设置、授权和备份元数据", async () => {
    const currentData = createData("当前美容数据");
    currentData.backupMetadata.lastReminderDate = "2026-08-09";
    const current = createRepository(currentData);
    const local = createFiles();
    const backupData = createData("模块备份数据");
    backupData.settings = { schemaVersion: 1 };
    // 通过同一服务生成模块文件，再放入文件选择结果模拟聊天恢复。
    const exportRepository = createRepository(backupData);
    const exporter = createBackupRestoreService({
      repository: exportRepository.repository,
      files: local.files,
      appVersion: "1.0.0",
      now: () => NOW,
    });
    const prepared = await exporter.prepareExport({
      kind: "modules",
      moduleIds: ["beauty"],
    });
    const moduleContents = local.contents.get(prepared.file.path) as string;
    local.contents.set("wxfile://tmp/selected.json", moduleContents);
    local.setChosen({
      name: "selected.json",
      path: "wxfile://tmp/selected.json",
      sizeBytes: moduleContents.length,
    });
    const service = createBackupRestoreService({
      repository: current.repository,
      files: local.files,
      appVersion: "1.0.0",
    });

    const selected = await service.selectRestoreFile();
    await service.restoreSelectedBackup(selected);

    expect(current.current()).toMatchObject({
      settings: { schemaVersion: 1, defaultModuleId: "beauty" },
      unlockedModules: ["beauty"],
      backupMetadata: { lastReminderDate: "2026-08-09" },
      inventoryItems: [{ name: "模块备份数据" }],
    });
  });

  it("美容模块上下文拒绝完整系统文件，防止越过模块数据页边界", async () => {
    const current = createRepository();
    const local = createFiles();
    const systemBackup = createBackupFileContent({
      data: createData("系统备份"),
      createdAt: NOW.toISOString(),
      appVersion: "1.0.0",
    });
    local.contents.set("wxfile://tmp/selected.json", systemBackup);
    local.setChosen({
      name: "selected.json",
      path: "wxfile://tmp/selected.json",
      sizeBytes: systemBackup.length,
    });
    const service = createBackupRestoreService({
      repository: current.repository,
      files: local.files,
      appVersion: "1.0.0",
      moduleContext: "beauty",
    });

    await expect(service.selectRestoreFile()).rejects.toMatchObject({
      code: "invalid-data",
      path: "$.scope",
    });
  });

  it("文件原始大小超限时在读取内容前拒绝恢复", async () => {
    const current = createRepository();
    const local = createFiles();
    let readCount = 0;
    local.files.readTextFile = async () => {
      readCount += 1;
      return "{}";
    };
    local.setChosen({
      name: "too-large.json",
      path: "wxfile://tmp/too-large.json",
      sizeBytes: 16 * 1024 * 1024 + 1,
    });
    const service = createBackupRestoreService({
      repository: current.repository,
      files: local.files,
      appVersion: "1.0.0",
    });

    await expect(service.selectRestoreFile()).rejects.toMatchObject({
      code: "backup-too-large",
    });
    expect(readCount).toBe(0);
    expect(current.replacements).toHaveLength(0);
  });

  it("损坏备份预检失败时不替换当前数据", async () => {
    const current = createRepository();
    const local = createFiles();
    const backup = createBackupFileContent({
      data: createData("候选数据"),
      createdAt: NOW.toISOString(),
      appVersion: "1.0.0",
    }).replace("候选数据", "已篡改数据");
    local.contents.set("wxfile://tmp/selected.json", backup);
    local.setChosen({
      name: "selected.json",
      path: "wxfile://tmp/selected.json",
      sizeBytes: backup.length,
    });
    const service = createBackupRestoreService({
      repository: current.repository,
      files: local.files,
      appVersion: "1.0.0",
    });

    await expect(service.selectRestoreFile()).rejects.toMatchObject({
      code: "checksum-mismatch",
    });
    expect(current.replacements).toHaveLength(0);
  });
});
