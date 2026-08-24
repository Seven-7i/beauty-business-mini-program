import type { BusinessModuleId } from "@/domain/business-module";
import type { ApplicationData, IsoDateTimeString } from "@/domain/data-schema";
import type {
  BusinessModuleDataMap,
  SelectedBusinessModuleData,
} from "@/domain/module-data";
import { isIsoDateTimeString } from "@/utils/iso-date-time";
import {
  BackupEnvelopeError,
  assertBackupFileWithinSizeLimit,
  createCanonicalPayloadChecksum,
  preflightBackupFileContent,
  type BackupDataSummary,
} from "./backup-envelope";
import { DataMigrationError, migrateApplicationData } from "./data-migrations";
import { getBusinessModuleBackupHandler } from "./business-module-backup";

/** 用户可转发备份的新格式标识；旧 beauty-local-backup 仍按完整系统兼容读取。 */
export const PORTABLE_BACKUP_FORMAT = "zhuangyue-local-backup" as const;
export const CURRENT_PORTABLE_BACKUP_FORMAT_VERSION = 1 as const;

/** 备份文件明确声明的覆盖边界。 */
export type BackupScope =
  | { readonly kind: "system" }
  | {
      readonly kind: "modules";
      readonly moduleIds: readonly BusinessModuleId[];
    };

/** 生成可转发备份文件所需的完整输入。 */
export interface CreatePortableBackupOptions {
  data: ApplicationData;
  scope: BackupScope;
  createdAt: IsoDateTimeString;
  appVersion: string;
}

interface PortableBackupCommon {
  createdAt: IsoDateTimeString;
  appVersion: string;
  summary: BackupDataSummary;
}

/** 完整预检后的候选以 scope 区分，调用方不能误用错误的恢复接口。 */
export type PortableBackupPreflightResult = PortableBackupCommon &
  (
    | { scope: { kind: "system" }; data: ApplicationData }
    | {
        scope: { kind: "modules"; moduleIds: BusinessModuleId[] };
        data: SelectedBusinessModuleData;
      }
  );

type UnknownRecord = Record<string, unknown>;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const APP_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function invalid(path: string, message: string): never {
  throw new BackupEnvelopeError("invalid-envelope", path, message);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalid(path, `${path} 必须是对象`);
  }
  return value as UnknownRecord;
}

function onlyFields(
  value: UnknownRecord,
  allowedFields: readonly string[],
  path: string,
): void {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(value).find((field) => !allowed.has(field));
  if (unknown) {
    invalid(`${path}.${unknown}`, `${path}.${unknown} 不是当前格式支持的字段`);
  }
}

function parseAppVersion(value: unknown, path: string): string {
  if (typeof value !== "string" || !APP_VERSION_PATTERN.test(value)) {
    return invalid(path, `${path} 必须是 major.minor.patch 格式`);
  }
  if (value.split(".").map(Number).some((part) => !Number.isSafeInteger(part))) {
    return invalid(path, `${path} 包含超出安全整数范围的版本号`);
  }
  return value;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

function createSummary(data: SelectedBusinessModuleData): BackupDataSummary {
  const beauty = data.beauty;
  const counts = {
    inventoryItemCount: beauty?.inventoryItems.length ?? 0,
    inventoryMovementCount: beauty?.inventoryMovements.length ?? 0,
    projectCount: beauty?.projects.length ?? 0,
    customerCount: beauty?.customers.length ?? 0,
    appointmentCount: beauty?.appointments.length ?? 0,
  };
  return {
    ...counts,
    hasBusinessData: Object.values(counts).some((count) => count > 0),
  };
}

function applicationDataAsModules(data: ApplicationData): SelectedBusinessModuleData {
  return { beauty: getBusinessModuleBackupHandler("beauty").extract(data) };
}

function normalizeModuleIds(moduleIds: readonly BusinessModuleId[]): BusinessModuleId[] {
  if (moduleIds.length === 0) {
    return invalid("$.scope.moduleIds", "选择模块备份至少包含一个模块");
  }
  if (new Set(moduleIds).size !== moduleIds.length) {
    return invalid("$.scope.moduleIds", "选择模块备份不能包含重复模块");
  }
  return [...moduleIds];
}

function createPayload(options: CreatePortableBackupOptions): UnknownRecord {
  if (!isIsoDateTimeString(options.createdAt)) {
    invalid("$.createdAt", "$.createdAt 必须是有效的 ISO 8601 日期时间");
  }
  const appVersion = parseAppVersion(options.appVersion, "$.appVersion");
  if (options.scope.kind === "system") {
    return {
      format: PORTABLE_BACKUP_FORMAT,
      formatVersion: CURRENT_PORTABLE_BACKUP_FORMAT_VERSION,
      createdAt: options.createdAt,
      appVersion,
      scope: { kind: "system" },
      data: migrateApplicationData(options.data),
    };
  }

  const moduleIds = normalizeModuleIds(options.scope.moduleIds);
  const modules: SelectedBusinessModuleData = {};
  for (const moduleId of moduleIds) {
    if (moduleId === "beauty") {
      modules.beauty = getBusinessModuleBackupHandler(moduleId).extract(options.data);
    }
  }
  return {
    format: PORTABLE_BACKUP_FORMAT,
    formatVersion: CURRENT_PORTABLE_BACKUP_FORMAT_VERSION,
    createdAt: options.createdAt,
    appVersion,
    scope: { kind: "modules", moduleIds },
    data: modules,
  };
}

/** 生成带显式系统或模块范围的可转发 JSON 文件。 */
export function createPortableBackupFileContent(
  options: CreatePortableBackupOptions,
): string {
  const payload = createPayload(options);
  const envelope = {
    ...payload,
    payloadChecksum: createCanonicalPayloadChecksum(payload),
  };
  const contents = JSON.stringify(envelope, null, 2);
  assertBackupFileWithinSizeLimit(contents);
  return contents;
}

function parseScope(value: unknown): BackupScope {
  const scope = record(value, "$.scope");
  if (scope.kind === "system") {
    onlyFields(scope, ["kind"], "$.scope");
    return { kind: "system" };
  }
  if (scope.kind !== "modules") {
    return invalid("$.scope.kind", "备份范围必须是 system 或 modules");
  }
  onlyFields(scope, ["kind", "moduleIds"], "$.scope");
  if (!Array.isArray(scope.moduleIds)) {
    return invalid("$.scope.moduleIds", "$.scope.moduleIds 必须是数组");
  }
  const moduleIds = scope.moduleIds.map((moduleId, index) => {
    if (moduleId !== "beauty") {
      return invalid(
        `$.scope.moduleIds[${index}]`,
        `当前版本不支持模块 ${String(moduleId)}`,
      );
    }
    return moduleId;
  });
  return { kind: "modules", moduleIds: normalizeModuleIds(moduleIds) };
}

function mapModuleValidationError(error: unknown, moduleId: string): never {
  if (error instanceof DataMigrationError) {
    throw new BackupEnvelopeError(
      error.code === "future-version"
        ? "future-data-version"
        : error.code === "unsupported-version"
          ? "unsupported-data-version"
          : "invalid-data",
      `$.data.${moduleId}${error.path.slice(1)}`,
      error.message,
    );
  }
  throw new BackupEnvelopeError(
    "invalid-data",
    `$.data.${moduleId}`,
    error instanceof Error ? error.message : `${moduleId} 模块数据无效`,
  );
}

function parseModuleData(
  value: unknown,
  moduleIds: readonly BusinessModuleId[],
): SelectedBusinessModuleData {
  const data = record(value, "$.data");
  onlyFields(data, moduleIds, "$.data");
  const parsed: SelectedBusinessModuleData = {};
  for (const moduleId of moduleIds) {
    if (!Object.prototype.hasOwnProperty.call(data, moduleId)) {
      invalid(`$.data.${moduleId}`, `备份缺少 ${moduleId} 模块数据`);
    }
    try {
      if (moduleId === "beauty") {
        parsed.beauty = getBusinessModuleBackupHandler(moduleId).validate(
          data[moduleId],
        );
      }
    } catch (error) {
      mapModuleValidationError(error, moduleId);
    }
  }
  return parsed;
}

/**
 * 预检用户可转发备份。旧 v1 文件被解释为完整系统备份，保证已有文件可继续恢复。
 */
export function preflightPortableBackupFileContent(
  contents: string,
  currentAppVersion: string,
): PortableBackupPreflightResult {
  assertBackupFileWithinSizeLimit(contents);
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new BackupEnvelopeError("invalid-json", "$", "备份文件不是有效的 JSON");
  }
  const envelope = record(parsed, "$");
  if (envelope.format === "beauty-local-backup") {
    const legacy = preflightBackupFileContent(contents, currentAppVersion);
    return {
      scope: { kind: "system" },
      createdAt: legacy.createdAt,
      appVersion: legacy.appVersion,
      summary: legacy.summary,
      data: legacy.data,
    };
  }
  if (envelope.format !== PORTABLE_BACKUP_FORMAT) {
    invalid("$.format", `$.format 必须为 ${PORTABLE_BACKUP_FORMAT}`);
  }
  if (!Number.isSafeInteger(envelope.formatVersion) || (envelope.formatVersion as number) < 1) {
    invalid("$.formatVersion", "$.formatVersion 必须是正安全整数");
  }
  if ((envelope.formatVersion as number) > CURRENT_PORTABLE_BACKUP_FORMAT_VERSION) {
    throw new BackupEnvelopeError(
      "future-format-version",
      "$.formatVersion",
      "该备份格式来自较新版本，请先升级应用",
    );
  }
  if ((envelope.formatVersion as number) < CURRENT_PORTABLE_BACKUP_FORMAT_VERSION) {
    throw new BackupEnvelopeError(
      "unsupported-format-version",
      "$.formatVersion",
      "当前版本不支持该备份格式",
    );
  }
  onlyFields(
    envelope,
    ["format", "formatVersion", "createdAt", "appVersion", "scope", "data", "payloadChecksum"],
    "$",
  );
  if (!isIsoDateTimeString(envelope.createdAt)) {
    invalid("$.createdAt", "$.createdAt 必须是有效的 ISO 8601 日期时间");
  }
  const appVersion = parseAppVersion(envelope.appVersion, "$.appVersion");
  const supportedAppVersion = parseAppVersion(currentAppVersion, "$currentAppVersion");
  if (compareVersions(appVersion, supportedAppVersion) > 0) {
    throw new BackupEnvelopeError(
      "future-app-version",
      "$.appVersion",
      `该备份由较新的应用版本 ${appVersion} 生成，请先升级应用`,
    );
  }
  if (typeof envelope.payloadChecksum !== "string" || !SHA256_PATTERN.test(envelope.payloadChecksum)) {
    invalid("$.payloadChecksum", "$.payloadChecksum 必须是 SHA-256 字符串");
  }
  const { payloadChecksum: _checksum, ...payload } = envelope;
  if (createCanonicalPayloadChecksum(payload) !== envelope.payloadChecksum.toLowerCase()) {
    throw new BackupEnvelopeError(
      "checksum-mismatch",
      "$.payloadChecksum",
      "备份文件完整性校验失败，文件可能已损坏或被修改",
    );
  }

  const scope = parseScope(envelope.scope);
  if (scope.kind === "system") {
    try {
      const data = migrateApplicationData(envelope.data);
      return {
        scope,
        createdAt: envelope.createdAt,
        appVersion,
        data,
        summary: createSummary(applicationDataAsModules(data)),
      };
    } catch (error) {
      mapModuleValidationError(error, "system");
    }
  }
  const data = parseModuleData(envelope.data, scope.moduleIds);
  return {
    scope: { kind: "modules", moduleIds: [...scope.moduleIds] },
    createdAt: envelope.createdAt,
    appVersion,
    data,
    summary: createSummary(data),
  };
}
