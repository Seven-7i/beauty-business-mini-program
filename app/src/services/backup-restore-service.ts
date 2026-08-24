import type {
  ApplicationData,
  IsoDateTimeString,
} from "@/domain/data-schema";
import type { BusinessModuleId } from "@/domain/business-module";
import type { SelectedBusinessModuleData } from "@/domain/module-data";
import type {
  BackupFileAdapter,
  ChosenJsonFile,
  LocalJsonFile,
} from "@/infrastructure/wechat/backup-file-adapter";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";
import {
  BackupEnvelopeError,
  MAX_BACKUP_FILE_BYTES,
  type BackupDataSummary,
} from "@/services/backup-envelope";
import {
  createPortableBackupFileContent,
  preflightPortableBackupFileContent,
  type BackupScope,
} from "@/services/portable-backup-envelope";
import { createBackupFileName } from "@/utils/backup-file-name";

const ACTIVE_SHARE_SAFETY_MILLISECONDS = 15 * 60 * 1000;

/** 已生成且可由下一次用户点击直接转发的产品备份文件。 */
export interface PreparedBackupExport {
  /** 备份生成时间；确认实际发送后用它记录最近导出时间。 */
  createdAt: IsoDateTimeString;
  /** 文件声明的导出范围；只有完整系统导出会更新七天提醒基准。 */
  scope: BackupScope;
  /** 位于微信用户文件目录、必须保留到转发流程结束的文件。 */
  file: LocalJsonFile;
}

/** 完成只读预检、尚未获准写入 Storage 的恢复候选。 */
interface SelectedBackupRestoreCommon {
  /** 用户从微信聊天选择的原始文件信息。 */
  file: ChosenJsonFile;
  /** 备份生成时间。 */
  createdAt: IsoDateTimeString;
  /** 生成备份时的小程序版本。 */
  appVersion: string;
  /** 恢复确认页展示的记录数量。 */
  summary: BackupDataSummary;
}

/** 预检候选以范围区分，恢复时只能调用匹配的仓储接口。 */
export type SelectedBackupRestore = SelectedBackupRestoreCommon &
  (
    | { scope: { kind: "system" }; data: ApplicationData }
    | {
        scope: { kind: "modules"; moduleIds: readonly ("beauty")[] };
        data: SelectedBusinessModuleData;
      }
  );

/** 数据保护页首次展示所需的轻量信息。 */
export interface BackupRestoreOverview {
  /** 最近一次由用户确认实际发送的导出时间。 */
  lastExportedAt?: IsoDateTimeString;
  /** 最近一次由用户确认实际发送的文件名。 */
  lastExportFileName?: string;
}

/** 备份恢复编排只依赖的应用数据仓储能力。 */
export type BackupRestoreRepository = Pick<
  ApplicationDataRepository,
  | "readSnapshot"
  | "replaceSnapshot"
  | "replaceSelectedModules"
  | "recordSuccessfulExport"
>;

/** 创建产品备份恢复服务所需的可替换依赖。 */
export interface BackupRestoreServiceOptions {
  repository: BackupRestoreRepository;
  files: BackupFileAdapter;
  /** 当前小程序版本，必须使用 major.minor.patch 格式。 */
  appVersion: string;
  /** 注入时钟便于测试文件名和元数据。 */
  now?: () => Date;
  /** 模块内数据页设置后，只允许导出和恢复该模块，防止越过页面语义。 */
  moduleContext?: BusinessModuleId;
}

/** 判断快照中是否存在需要覆盖确认的业务记录。 */
export function hasBusinessData(data: ApplicationData): boolean {
  return (
    data.inventoryItems.length > 0 ||
    data.inventoryMovements.length > 0 ||
    data.projects.length > 0 ||
    data.customers.length > 0 ||
    data.appointments.length > 0
  );
}

/**
 * 编排产品级备份生成、分享确认、恢复预检和整体替换。
 * 本服务不持有 UI 状态，也不会在预检阶段写入任何 Storage key。
 */
export function createBackupRestoreService(
  options: BackupRestoreServiceOptions,
) {
  const {
    repository,
    files,
    appVersion,
    moduleContext,
    now = () => new Date(),
  } = options;

  /** 清理上次进程被终止后遗留的未加密产品备份文件。 */
  function cleanupStaleExportFiles(): Promise<void> {
    return files.removeGeneratedBackupFiles({
      createdBefore: new Date(now().getTime() - ACTIVE_SHARE_SAFETY_MILLISECONDS),
    });
  }

  async function readOverview(): Promise<BackupRestoreOverview> {
    const data = await repository.readSnapshot();
    return {
      lastExportedAt: data.backupMetadata.lastExportedAt,
      lastExportFileName: data.backupMetadata.lastExportFileName,
    };
  }

  async function prepareExport(
    scope: BackupScope = moduleContext
      ? { kind: "modules", moduleIds: [moduleContext] }
      : { kind: "system" },
  ): Promise<PreparedBackupExport> {
    if (
      moduleContext &&
      (scope.kind !== "modules" ||
        scope.moduleIds.length !== 1 ||
        scope.moduleIds[0] !== moduleContext)
    ) {
      throw new Error(`当前页面只允许备份${moduleContext}模块`);
    }
    const createdAt = now();
    const data = await repository.readSnapshot();
    const contents = createPortableBackupFileContent({
      data,
      scope,
      createdAt: createdAt.toISOString(),
      appVersion,
    });
    const fileNameScope =
      scope.kind === "system" ? "system" : scope.moduleIds[0];
    const file = await files.createJsonFile(
      createBackupFileName(createdAt, fileNameScope),
      contents,
    );

    return { createdAt: createdAt.toISOString(), scope, file };
  }

  /**
   * 必须直接由用户点击调用，函数进入后立即触发 wx.shareFileMessage。
   * 不在这里生成或读取文件，避免 await 使调用脱离微信要求的 TAP 手势。
   */
  function sharePreparedExport(
    prepared: PreparedBackupExport,
  ): Promise<void> {
    return files.shareFile(prepared.file);
  }

  /** 微信回调不能证明实际发送；仅在用户明确确认后记录最近导出信息。 */
  async function recordConfirmedExport(
    prepared: PreparedBackupExport,
  ): Promise<void> {
    if (prepared.scope.kind !== "system") {
      // 模块文件不能冒充完整系统备份并推迟七天保护提醒。
      return;
    }
    await repository.recordSuccessfulExport(
      prepared.createdAt,
      prepared.file.name,
    );
  }

  function removePreparedExport(
    prepared: PreparedBackupExport,
  ): Promise<void> {
    return files.removeFile(prepared.file.path);
  }

  async function selectRestoreFile(): Promise<SelectedBackupRestore> {
    // chooseJsonFile 在函数进入后立即调用，保留微信文件选择所需的点击调用链。
    const selectionPromise = files.chooseJsonFile();
    const file = await selectionPromise;

    if (file.sizeBytes > MAX_BACKUP_FILE_BYTES) {
      throw new BackupEnvelopeError(
        "backup-too-large",
        "$",
        "备份文件超过 16MB，无法安全处理",
      );
    }

    const contents = await files.readTextFile(file.path);
    const preflight = preflightPortableBackupFileContent(contents, appVersion);
    if (
      moduleContext &&
      (preflight.scope.kind !== "modules" ||
        preflight.scope.moduleIds.length !== 1 ||
        preflight.scope.moduleIds[0] !== moduleContext)
    ) {
      throw new BackupEnvelopeError(
        "invalid-data",
        "$.scope",
        `当前页面只允许恢复${moduleContext}模块备份，请到系统数据保护页恢复其他范围`,
      );
    }
    return {
      file,
      createdAt: preflight.createdAt,
      appVersion: preflight.appVersion,
      summary: preflight.summary,
      scope: preflight.scope,
      data: preflight.data,
    } as SelectedBackupRestore;
  }

  /**
   * 文件完整预检成功后，再单独读取当前快照判断是否需要覆盖警告。
   * 与 selectRestoreFile 分离，确保备份文件校验阶段不会触碰 Storage。
   */
  async function inspectCurrentDataForRestore(
    selected: SelectedBackupRestore,
  ): Promise<boolean> {
    const current = await repository.readSnapshot();
    if (selected.scope.kind === "system") {
      return hasBusinessData(current);
    }
    return selected.scope.moduleIds.includes("beauty") && hasBusinessData(current);
  }

  /** 候选已完成预检；调用方仍必须先取得用户的整体覆盖确认。 */
  function restoreSelectedBackup(
    selected: SelectedBackupRestore,
  ): Promise<void> {
    if (selected.scope.kind === "system") {
      return repository.replaceSnapshot(selected.data as ApplicationData);
    }
    return repository.replaceSelectedModules(
      selected.data as SelectedBusinessModuleData,
    );
  }

  return {
    cleanupStaleExportFiles,
    readOverview,
    prepareExport,
    sharePreparedExport,
    recordConfirmedExport,
    removePreparedExport,
    selectRestoreFile,
    inspectCurrentDataForRestore,
    restoreSelectedBackup,
  };
}

export type BackupRestoreService = ReturnType<
  typeof createBackupRestoreService
>;
