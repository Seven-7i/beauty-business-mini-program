import { effectScope } from "vue";
import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import { WechatFileOperationError } from "@/infrastructure/wechat/backup-file-adapter";
import type {
  BackupRestoreService,
  PreparedBackupExport,
  SelectedBackupRestore,
} from "@/services/backup-restore-service";
import { useBackupRestoreFlow } from "./useBackupRestoreFlow";

const NOW = "2026-08-08T06:30:00.000Z";

function createEmptyData(): ApplicationData {
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1 },
    unlockedModules: ["beauty"],
    backupMetadata: { schemaVersion: 1 },
    inventoryItems: [],
    inventoryMovements: [],
    projects: [],
    customers: [],
    appointments: [],
  };
}

function createPrepared(): PreparedBackupExport {
  return {
    createdAt: NOW,
    scope: { kind: "system" },
    file: {
      name: "美容管家备份_20260808_1430.json",
      path: "wxfile://usr/backup.json",
    },
  };
}

function createSelected(): SelectedBackupRestore {
  return {
    file: {
      name: "selected.json",
      path: "wxfile://tmp/selected.json",
      sizeBytes: 1024,
    },
    createdAt: NOW,
    appVersion: "1.0.0",
    summary: {
      inventoryItemCount: 0,
      inventoryMovementCount: 0,
      projectCount: 0,
      customerCount: 0,
      appointmentCount: 0,
      hasBusinessData: false,
    },
    scope: { kind: "system" },
    data: createEmptyData(),
  };
}

function createService(
  overrides: Partial<BackupRestoreService> = {},
): BackupRestoreService {
  return {
    async cleanupStaleExportFiles() {},
    async readOverview() {
      return {};
    },
    async prepareExport() {
      return createPrepared();
    },
    async sharePreparedExport() {},
    async recordConfirmedExport() {},
    async removePreparedExport() {},
    async selectRestoreFile() {
      return createSelected();
    },
    async inspectCurrentDataForRestore() {
      return true;
    },
    async restoreSelectedBackup() {},
    ...overrides,
  };
}

describe("产品备份恢复 composable", () => {
  it("由独立点击同步触发转发，并只在用户确认后记录导出", async () => {
    let userGestureActive = false;
    let recordCount = 0;
    const service = createService({
      sharePreparedExport() {
        if (!userGestureActive) {
          return Promise.reject(new Error("share requires TAP gesture"));
        }
        return Promise.resolve();
      },
      async recordConfirmedExport() {
        recordCount += 1;
      },
    });
    const scope = effectScope();
    const flow = scope.run(() => useBackupRestoreFlow({ service }));

    await flow?.prepareExport();
    expect(flow?.exportState.status).toBe("ready");

    userGestureActive = true;
    const sharing = flow?.sharePreparedExport();
    userGestureActive = false;
    await sharing;

    expect(flow?.exportState.status).toBe("awaiting-confirmation");
    expect(recordCount).toBe(0);
    await flow?.confirmExportSent();
    expect(recordCount).toBe(1);
    expect(flow?.exportState.status).toBe("completed");
    expect(flow?.lastExportedAt.value).toBe(NOW);
    scope.stop();
  });

  it("用户确认取消时不记录最近导出时间", async () => {
    let recordCount = 0;
    const service = createService({
      async recordConfirmedExport() {
        recordCount += 1;
      },
    });
    const scope = effectScope();
    const flow = scope.run(() => useBackupRestoreFlow({ service }));

    await flow?.prepareExport();
    await flow?.sharePreparedExport();
    await flow?.confirmExportCancelled();

    expect(flow?.exportState.status).toBe("cancelled");
    expect(flow?.exportState.detail).toContain("不会更新最近导出时间");
    expect(recordCount).toBe(0);
    scope.stop();
  });

  it("微信明确返回取消时直接显示取消状态", async () => {
    const service = createService({
      sharePreparedExport() {
        return Promise.reject(
          new WechatFileOperationError("share", {
            errMsg: "shareFileMessage:fail cancel",
          }),
        );
      },
    });
    const scope = effectScope();
    const flow = scope.run(() => useBackupRestoreFlow({ service }));

    await flow?.prepareExport();
    await flow?.sharePreparedExport();

    expect(flow?.exportState.status).toBe("cancelled");
    scope.stop();
  });

  it("恢复预检只公开摘要，确认后才执行整体替换", async () => {
    let restoreCount = 0;
    const service = createService({
      async restoreSelectedBackup() {
        restoreCount += 1;
      },
    });
    const scope = effectScope();
    const flow = scope.run(() => useBackupRestoreFlow({ service }));

    await flow?.selectRestoreFile();

    expect(flow?.restoreState.status).toBe("ready");
    expect(flow?.restoreState.candidate).toMatchObject({
      fileName: "selected.json",
      currentHasBusinessData: true,
    });
    expect(restoreCount).toBe(0);

    await flow?.confirmRestore();
    expect(restoreCount).toBe(1);
    expect(flow?.restoreState.status).toBe("completed");
    scope.stop();
  });

  it("恢复完成后可重置候选状态并再次选择备份文件", async () => {
    let selectCount = 0;
    const service = createService({
      async selectRestoreFile() {
        selectCount += 1;
        return createSelected();
      },
    });
    const scope = effectScope();
    const flow = scope.run(() => useBackupRestoreFlow({ service }));

    await flow?.selectRestoreFile();
    await flow?.confirmRestore();
    expect(flow?.restoreState.status).toBe("completed");

    flow?.resetRestore();
    expect(flow?.restoreState).toMatchObject({
      status: "idle",
      candidate: undefined,
      currentDataExportStatus: "idle",
    });

    await flow?.selectRestoreFile();
    expect(selectCount).toBe(2);
    expect(flow?.restoreState.status).toBe("ready");
    scope.stop();
  });

  it("整体替换失败后阻止继续选择文件，要求重启处理未决事务", async () => {
    let selectCount = 0;
    const service = createService({
      async selectRestoreFile() {
        selectCount += 1;
        return createSelected();
      },
      async restoreSelectedBackup() {
        throw new Error("写入失败且回滚暂时受阻");
      },
    });
    const scope = effectScope();
    const flow = scope.run(() => useBackupRestoreFlow({ service }));

    await flow?.selectRestoreFile();
    await flow?.confirmRestore();
    await flow?.selectRestoreFile();

    expect(flow?.restoreState.status).toBe("interrupted");
    expect(flow?.restoreState.detail).toContain("重新进入应用");
    expect(selectCount).toBe(1);
    scope.stop();
  });

  it("进入页面先清理上次异常退出遗留的产品备份", async () => {
    let cleanupCount = 0;
    const service = createService({
      async cleanupStaleExportFiles() {
        cleanupCount += 1;
      },
    });
    const scope = effectScope();
    const flow = scope.run(() => useBackupRestoreFlow({ service }));

    await flow?.initialize();

    expect(cleanupCount).toBe(1);
    scope.stop();
  });

  it("确认发送后立即清理生成文件", async () => {
    const removed: PreparedBackupExport[] = [];
    const service = createService({
      async removePreparedExport(prepared) {
        removed.push(prepared);
      },
    });
    const scope = effectScope();
    const flow = scope.run(() => useBackupRestoreFlow({ service }));

    await flow?.prepareExport();
    await flow?.sharePreparedExport();
    expect(removed).toHaveLength(0);

    await flow?.confirmExportSent();
    expect(removed).toHaveLength(1);

    scope.stop();
    await Promise.resolve();
    expect(removed).toHaveLength(1);
  });

  it("等待确认转发结果时离开页面，不提前删除微信仍可能读取的文件", async () => {
    const removed: PreparedBackupExport[] = [];
    const service = createService({
      async removePreparedExport(prepared) {
        removed.push(prepared);
      },
    });
    const scope = effectScope();
    const flow = scope.run(() => useBackupRestoreFlow({ service }));

    await flow?.prepareExport();
    await flow?.sharePreparedExport();
    scope.stop();
    await Promise.resolve();

    expect(removed).toHaveLength(0);
  });

  it("恢复前导出只有确认实际发送后才标记完成", async () => {
    const scope = effectScope();
    const flow = scope.run(() =>
      useBackupRestoreFlow({ service: createService() }),
    );

    await flow?.selectRestoreFile();
    await flow?.prepareCurrentDataBeforeRestore();
    expect(flow?.restoreState.currentDataExportStatus).toBe("in-progress");

    await flow?.sharePreparedExport();
    await flow?.confirmExportSent();
    expect(flow?.restoreState.currentDataExportStatus).toBe("completed");
    scope.stop();
  });
});
