/** 微信回调的通用失败信息；不同基础库版本可能返回不同错误码字段。 */
interface WechatFailure {
  errMsg: string;
  errno?: number;
  errCode?: number | string;
  code?: number | string;
}

/** 微信文件系统写入 UTF-8 文本时使用的最小参数集合。 */
interface WriteFileOptions {
  filePath: string;
  data: string;
  encoding: "utf8";
  success: () => void;
  fail: (error: WechatFailure) => void;
}

/** 微信文件系统读取 UTF-8 文本时使用的最小参数集合。 */
interface ReadFileOptions {
  filePath: string;
  encoding: "utf8";
  success: (result: { data: string | ArrayBuffer }) => void;
  fail: (error: WechatFailure) => void;
}

/** 微信文件系统删除单个文件时使用的最小参数集合。 */
interface UnlinkOptions {
  filePath: string;
  success: () => void;
  fail: (error: WechatFailure) => void;
}

/** 枚举微信用户文件目录所需的最小参数集合。 */
interface ReadDirectoryOptions {
  dirPath: string;
  success: (result: { files: string[] }) => void;
  fail: (error: WechatFailure) => void;
}

/** 从聊天会话选择一个 JSON 文件所需的微信 API 参数。 */
interface ChooseMessageFileOptions {
  count: 1;
  type: "file";
  extension: ["json"];
  success: (result: {
    tempFiles: Array<{
      name: string;
      path: string;
      size: number;
    }>;
  }) => void;
  fail: (error: WechatFailure) => void;
}

/** 把本地文件转发到微信聊天所需的微信 API 参数。 */
interface ShareFileMessageOptions {
  filePath: string;
  fileName: string;
  success: () => void;
  fail: (error: WechatFailure) => void;
}

export interface WechatFileSystemManager {
  /** 写入微信用户文件目录中的 UTF-8 文件。 */
  writeFile(options: WriteFileOptions): void;
  /** 从微信本地或临时路径读取 UTF-8 文件。 */
  readFile(options: ReadFileOptions): void;
  /** 删除微信用户文件目录中的文件。 */
  unlink(options: UnlinkOptions): void;
  /** 枚举微信用户文件目录，用于启动时清理中断遗留的产品备份。 */
  readdir(options: ReadDirectoryOptions): void;
}

/** 备份文件适配器实际依赖的最小微信运行时接口，便于真机 API 与单元测试替身共用。 */
export interface WechatBackupFileRuntime {
  env: {
    USER_DATA_PATH: string;
  };
  getFileSystemManager(): WechatFileSystemManager;
  chooseMessageFile(options: ChooseMessageFileOptions): void;
  shareFileMessage(options: ShareFileMessageOptions): void;
}

/** 已生成在微信本地文件系统中的 JSON 文件引用。 */
export interface LocalJsonFile {
  name: string;
  path: string;
}

/** 用户从微信聊天中选中的临时 JSON 文件及其原始大小。 */
export interface ChosenJsonFile extends LocalJsonFile {
  sizeBytes: number;
}

/** 批量清理产品备份时用于保护仍可能被微信读取的新文件。 */
export interface GeneratedBackupCleanupOptions {
  /** 只删除生成时间早于该时刻的文件；省略时删除全部匹配文件。 */
  createdBefore?: Date;
}

/** 产品整体恢复专用的独立回滚文件能力。 */
export interface ApplicationDataRollbackFileAdapter {
  /** 写入产品整体恢复专用快照，不与阶段 0 探测共用文件。 */
  writeApplicationDataRollbackSnapshot(
    contents: string,
  ): Promise<LocalJsonFile>;
  /** 读取必须存在的产品整体恢复快照。 */
  readApplicationDataRollbackSnapshot(): Promise<string>;
  /** 读取可选产品整体恢复快照；文件不存在时返回 undefined。 */
  readApplicationDataRollbackSnapshotIfExists(): Promise<string | undefined>;
  /** 删除产品整体恢复专用快照。 */
  removeApplicationDataRollbackSnapshot(): Promise<void>;
}

/** 隔离业务层与微信文件系统、聊天选择及文件转发 API 的统一边界。 */
export interface BackupFileAdapter {
  /** 在微信用户文件目录生成可转发的 JSON 文件。 */
  createJsonFile(fileName: string, contents: string): Promise<LocalJsonFile>;
  /** 读取微信本地或聊天临时文件中的 UTF-8 文本。 */
  readTextFile(filePath: string): Promise<string>;
  /** 从微信聊天会话选择一个 JSON 文件。 */
  chooseJsonFile(): Promise<ChosenJsonFile>;
  /** 调起微信文件转发；Promise 成功不代表用户已实际发送，结果需由上层确认。 */
  shareFile(file: LocalJsonFile): Promise<void>;
  /** 删除指定的微信用户文件。 */
  removeFile(filePath: string): Promise<void>;
  /** 清理上次异常退出遗留的产品备份文件，不触碰回滚和能力探测文件。 */
  removeGeneratedBackupFiles(
    options?: GeneratedBackupCleanupOptions,
  ): Promise<void>;
  /** 写入恢复流程专用的回滚快照。 */
  writeRollbackSnapshot(contents: string): Promise<LocalJsonFile>;
  /** 读取必须存在的回滚快照。 */
  readRollbackSnapshot(): Promise<string>;
  /** 读取可选回滚快照；文件不存在时返回 undefined。 */
  readRollbackSnapshotIfExists(): Promise<string | undefined>;
  /** 删除恢复流程专用的回滚快照。 */
  removeRollbackSnapshot(): Promise<void>;
  /** 写入容量压力检查专用快照，不与产品恢复快照共用文件。 */
  writeCapacityProbeSnapshot(contents: string): Promise<LocalJsonFile>;
  /** 读取容量压力检查专用快照。 */
  readCapacityProbeSnapshot(): Promise<string>;
  /** 读取可选容量压力检查快照；文件不存在时返回 undefined。 */
  readCapacityProbeSnapshotIfExists(): Promise<string | undefined>;
  /** 删除容量压力检查专用快照。 */
  removeCapacityProbeSnapshot(): Promise<void>;
}

/** 用于错误归类和页面提示的微信文件操作名称。 */
export type WechatFileOperation =
  | "write"
  | "read"
  | "choose"
  | "share"
  | "remove";

/** 统一包装微信文件 API 错误，并保留操作类型、取消状态和原始错误码。 */
export class WechatFileOperationError extends Error {
  /** 失败发生在哪一种微信文件操作。 */
  readonly operation: WechatFileOperation;
  /** 微信 errMsg 是否表示用户主动取消。 */
  readonly cancelled: boolean;
  /** 微信基础库返回的 errno。 */
  readonly errno?: number;
  /** 部分基础库版本返回的 errCode 或 code。 */
  readonly errCode?: number | string;

  constructor(operation: WechatFileOperation, error: WechatFailure) {
    super(error.errMsg);
    this.name = "WechatFileOperationError";
    this.operation = operation;
    this.cancelled = error.errMsg.toLowerCase().includes("cancel");
    this.errno = error.errno;
    this.errCode = error.errCode ?? error.code;
  }
}

const ROLLBACK_FILE_NAME = "bm-recovery-rollback.json";
const APPLICATION_DATA_ROLLBACK_FILE_NAME = "bm-application-data-rollback.json";
const CAPACITY_PROBE_FILE_NAME = "bm-stage0-capacity-probe.json";
const GENERATED_BACKUP_FILE_PATTERN =
  /^(?:美容管家备份|庄月空间系统备份|庄月空间美容备份)_\d{8}_\d{4}\.json$/;

function generatedBackupCreatedAt(fileName: string): Date | undefined {
  const match =
    /^(?:美容管家备份|庄月空间系统备份|庄月空间美容备份)_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})\.json$/.exec(
      fileName,
    );
  if (!match) {
    return undefined;
  }
  const [, year, month, day, hour, minute] = match;
  const numericParts = [year, month, day, hour, minute].map(Number);
  const createdAt = new Date(
    numericParts[0],
    numericParts[1] - 1,
    numericParts[2],
    numericParts[3],
    numericParts[4],
  );
  if (
    Number.isNaN(createdAt.getTime()) ||
    createdAt.getFullYear() !== numericParts[0] ||
    createdAt.getMonth() !== numericParts[1] - 1 ||
    createdAt.getDate() !== numericParts[2] ||
    createdAt.getHours() !== numericParts[3] ||
    createdAt.getMinutes() !== numericParts[4]
  ) {
    return undefined;
  }
  return createdAt;
}

function assertJsonFileName(fileName: string): void {
  const containsPathSeparator =
    fileName.includes("/") || fileName.includes("\\");

  if (!fileName.endsWith(".json") || containsPathSeparator) {
    throw new Error("JSON 文件名无效");
  }
}

function isMissingFileError(error: {
  errMsg?: string;
  message?: string;
}): boolean {
  const message = (error.errMsg ?? error.message ?? "").toLowerCase();
  return message.includes("no such file") || message.includes("not found");
}

/**
 * 创建微信备份文件适配器。
 *
 * 这里集中封装所有微信专有文件 API，业务与页面只依赖 Promise 风格的
 * BackupFileAdapter，避免把回调式 wx API 散落到功能代码中。
 */
export function createWechatBackupFileAdapter(
  runtime: WechatBackupFileRuntime,
): BackupFileAdapter & ApplicationDataRollbackFileAdapter {
  const fileSystem = runtime.getFileSystemManager();
  const rollbackPath = `${runtime.env.USER_DATA_PATH}/${ROLLBACK_FILE_NAME}`;
  const applicationDataRollbackPath = `${runtime.env.USER_DATA_PATH}/${APPLICATION_DATA_ROLLBACK_FILE_NAME}`;
  const capacityProbePath = `${runtime.env.USER_DATA_PATH}/${CAPACITY_PROBE_FILE_NAME}`;

  function writeTextFile(filePath: string, contents: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fileSystem.writeFile({
        filePath,
        data: contents,
        encoding: "utf8",
        success: resolve,
        fail(error) {
          reject(new WechatFileOperationError("write", error));
        },
      });
    });
  }

  function readTextFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fileSystem.readFile({
        filePath,
        encoding: "utf8",
        success(result) {
          if (typeof result.data !== "string") {
            reject(new Error("读取到的文件不是 UTF-8 文本"));
            return;
          }

          resolve(result.data);
        },
        fail(error) {
          reject(new WechatFileOperationError("read", error));
        },
      });
    });
  }

  function removeFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fileSystem.unlink({
        filePath,
        success: resolve,
        fail(error) {
          if (isMissingFileError(error)) {
            resolve();
            return;
          }

          reject(new WechatFileOperationError("remove", error));
        },
      });
    });
  }

  function readUserDataFileNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fileSystem.readdir({
        dirPath: runtime.env.USER_DATA_PATH,
        success(result) {
          resolve(result.files);
        },
        fail(error) {
          reject(new WechatFileOperationError("read", error));
        },
      });
    });
  }

  /** 缺失文件按 undefined 返回，其他读取错误保留操作类型并向上抛出。 */
  async function readTextFileIfExists(
    filePath: string,
  ): Promise<string | undefined> {
    try {
      return await readTextFile(filePath);
    } catch (error) {
      if (
        error instanceof WechatFileOperationError &&
        isMissingFileError(error)
      ) {
        return undefined;
      }

      throw error;
    }
  }

  return {
    async createJsonFile(fileName, contents) {
      assertJsonFileName(fileName);
      const path = `${runtime.env.USER_DATA_PATH}/${fileName}`;
      await writeTextFile(path, contents);
      return { name: fileName, path };
    },
    readTextFile,
    chooseJsonFile() {
      return new Promise((resolve, reject) => {
        runtime.chooseMessageFile({
          count: 1,
          type: "file",
          extension: ["json"],
          success(result) {
            const selected = result.tempFiles[0];

            if (!selected) {
              reject(new Error("未选择备份文件"));
              return;
            }

            resolve({
              name: selected.name,
              path: selected.path,
              sizeBytes: selected.size,
            });
          },
          fail(error) {
            reject(new WechatFileOperationError("choose", error));
          },
        });
      });
    },
    shareFile(file) {
      return new Promise((resolve, reject) => {
        runtime.shareFileMessage({
          filePath: file.path,
          fileName: file.name,
          success: resolve,
          fail(error) {
            reject(new WechatFileOperationError("share", error));
          },
        });
      });
    },
    removeFile,
    async removeGeneratedBackupFiles(options = {}) {
      const fileNames = await readUserDataFileNames();
      await Promise.all(
        fileNames
          .filter((fileName) => {
            if (!GENERATED_BACKUP_FILE_PATTERN.test(fileName)) {
              return false;
            }
            const createdAt = generatedBackupCreatedAt(fileName);
            return (
              createdAt !== undefined &&
              (options.createdBefore === undefined ||
                // 文件名没有秒数；以该分钟结束作为最晚生成时间，保证完整安全年龄。
                createdAt.getTime() + 60_000 <= options.createdBefore.getTime())
            );
          })
          .map((fileName) =>
            removeFile(`${runtime.env.USER_DATA_PATH}/${fileName}`),
          ),
      );
    },
    async writeRollbackSnapshot(contents) {
      await writeTextFile(rollbackPath, contents);
      return { name: ROLLBACK_FILE_NAME, path: rollbackPath };
    },
    readRollbackSnapshot() {
      return readTextFile(rollbackPath);
    },
    readRollbackSnapshotIfExists() {
      return readTextFileIfExists(rollbackPath);
    },
    removeRollbackSnapshot() {
      return removeFile(rollbackPath);
    },
    async writeApplicationDataRollbackSnapshot(contents) {
      await writeTextFile(applicationDataRollbackPath, contents);
      return {
        name: APPLICATION_DATA_ROLLBACK_FILE_NAME,
        path: applicationDataRollbackPath,
      };
    },
    readApplicationDataRollbackSnapshot() {
      return readTextFile(applicationDataRollbackPath);
    },
    readApplicationDataRollbackSnapshotIfExists() {
      return readTextFileIfExists(applicationDataRollbackPath);
    },
    removeApplicationDataRollbackSnapshot() {
      return removeFile(applicationDataRollbackPath);
    },
    async writeCapacityProbeSnapshot(contents) {
      await writeTextFile(capacityProbePath, contents);
      return { name: CAPACITY_PROBE_FILE_NAME, path: capacityProbePath };
    },
    readCapacityProbeSnapshot() {
      return readTextFile(capacityProbePath);
    },
    readCapacityProbeSnapshotIfExists() {
      return readTextFileIfExists(capacityProbePath);
    },
    removeCapacityProbeSnapshot() {
      return removeFile(capacityProbePath);
    },
  };
}

declare const wx: WechatBackupFileRuntime;

/** 使用全局 wx 运行时创建生产环境的微信备份文件适配器。 */
export function createDefaultWechatBackupFileAdapter(): BackupFileAdapter &
  ApplicationDataRollbackFileAdapter {
  return createWechatBackupFileAdapter(wx);
}
