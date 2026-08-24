import type { ApplicationData, IsoDateTimeString } from "@/domain/data-schema";
import { isIsoDateTimeString } from "@/utils/iso-date-time";
import {
  DataMigrationError,
  migrateApplicationData,
} from "./data-migrations";

/** 产品级备份文件的固定格式标识。 */
export const BACKUP_FORMAT = "beauty-local-backup" as const;

/** envelope 的当前格式版本；它与业务数据 schema 版本分别演进。 */
export const CURRENT_BACKUP_FORMAT_VERSION = 1 as const;

/** 生成备份文件所需的完整输入。 */
export interface CreateBackupFileOptions {
  /** 已从本地仓储汇总出的完整业务数据。 */
  data: ApplicationData;
  /** 生成快照的时间，必须是有效的 ISO 8601 日期时间。 */
  createdAt: IsoDateTimeString;
  /** 生成备份的小程序版本，例如 1.2.0。 */
  appVersion: string;
}

/** 恢复确认页展示的备份内容摘要。 */
export interface BackupDataSummary {
  /** 库存物品数量。 */
  inventoryItemCount: number;
  /** 库存变动记录数量。 */
  inventoryMovementCount: number;
  /** 服务项目数量。 */
  projectCount: number;
  /** 顾客数量。 */
  customerCount: number;
  /** 预约数量。 */
  appointmentCount: number;
  /** 是否包含至少一条业务记录。 */
  hasBusinessData: boolean;
}

/** 完成格式、完整性和实体校验后的恢复预检结果。 */
export interface BackupPreflightResult {
  /** 备份生成时间。 */
  createdAt: IsoDateTimeString;
  /** 生成备份的小程序版本。 */
  appVersion: string;
  /** 已迁移到当前 schema 且可交给恢复写入流程的数据。 */
  data: ApplicationData;
  /** 用于恢复确认页的记录数量摘要。 */
  summary: BackupDataSummary;
}

/** 备份生成或恢复预检失败时的稳定错误类别。 */
export type BackupEnvelopeErrorCode =
  | "invalid-json"
  | "invalid-envelope"
  | "backup-too-large"
  | "backup-too-complex"
  | "future-format-version"
  | "unsupported-format-version"
  | "future-app-version"
  | "checksum-mismatch"
  | "future-data-version"
  | "unsupported-data-version"
  | "invalid-data";

/**
 * 备份 envelope 无法安全使用时抛出的错误。
 * `path` 指向首个失败位置，页面应阻止恢复且不得开始写入 Storage。
 */
export class BackupEnvelopeError extends Error {
  readonly code: BackupEnvelopeErrorCode;
  readonly path: string;

  constructor(code: BackupEnvelopeErrorCode, path: string, message: string) {
    super(message);
    this.name = "BackupEnvelopeError";
    this.code = code;
    this.path = path;
  }
}

type UnknownRecord = Record<string, unknown>;

interface BackupPayloadV1 {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof CURRENT_BACKUP_FORMAT_VERSION;
  createdAt: IsoDateTimeString;
  appVersion: string;
  data: unknown;
}

interface BackupEnvelopeV1 extends BackupPayloadV1 {
  payloadChecksum: string;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const APP_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
/** 产品备份允许读取或生成的最大 UTF-8 字节数。文件选择后应先按原始大小拦截。 */
export const MAX_BACKUP_FILE_BYTES = 16 * 1024 * 1024;
const MAX_CANONICAL_DEPTH = 64;
const MAX_CANONICAL_NODES = 1_000_000;

// SHA-256 前 32 位小数常量。固定写入可避免依赖 Node/Web Crypto，兼容微信基础库。
const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
  0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
  0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
  0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function invalidEnvelope(path: string, detail: string): never {
  throw new BackupEnvelopeError(
    "invalid-envelope",
    path,
    `备份字段 ${path} ${detail}`,
  );
}

function parseRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidEnvelope(path, "必须是对象");
  }
  return value as UnknownRecord;
}

function ensureOnlyFields(
  record: UnknownRecord,
  fields: readonly string[],
  path: string,
): void {
  const allowed = new Set(fields);
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      invalidEnvelope(`${path}.${field}`, "不是当前备份格式支持的字段");
    }
  }
}

function parseIsoDateTime(value: unknown, path: string): IsoDateTimeString {
  if (!isIsoDateTimeString(value)) {
    return invalidEnvelope(path, "必须是有效的 ISO 8601 日期时间");
  }
  return value;
}

function parseAppVersion(value: unknown, path: string): string {
  if (typeof value !== "string" || !APP_VERSION_PATTERN.test(value)) {
    return invalidEnvelope(path, "必须是 major.minor.patch 格式的应用版本");
  }
  if (
    value
      .split(".")
      .map(Number)
      .some((part) => !Number.isSafeInteger(part))
  ) {
    return invalidEnvelope(path, "包含超出安全整数范围的版本号");
  }
  return value;
}

function compareAppVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

function parseFormatVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    invalidEnvelope("$.formatVersion", "必须是正安全整数");
  }
  return value as number;
}

/**
 * 对 JSON 值递归按对象键排序，得到与空白和原始属性顺序无关的稳定文本。
 * 备份校验因此不会因聊天文件被重新格式化而误报损坏。
 */
function canonicalStringify(
  value: unknown,
  path = "$",
  depth = 0,
  budget: { nodes: number } = { nodes: 0 },
): string {
  budget.nodes += 1;
  if (depth > MAX_CANONICAL_DEPTH || budget.nodes > MAX_CANONICAL_NODES) {
    throw new BackupEnvelopeError(
      "backup-too-complex",
      path,
      "备份文件结构过于复杂，无法安全处理",
    );
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return invalidEnvelope(path, "包含无法序列化的数字");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value
      .map((item, index) =>
        canonicalStringify(item, `${path}[${index}]`, depth + 1, budget),
      )
      .join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as UnknownRecord;
    const entries = Object.keys(record)
      .sort()
      .map((key) => {
        const item = record[key];
        if (item === undefined) {
          return undefined;
        }
        return `${JSON.stringify(key)}:${canonicalStringify(
          item,
          `${path}.${key}`,
          depth + 1,
          budget,
        )}`;
      })
      .filter((entry): entry is string => entry !== undefined);
    return `{${entries.join(",")}}`;
  }

  return invalidEnvelope(path, "包含无法序列化的值");
}

/** 只计算 UTF-8 字节数，不分配与文件等大的临时字节数组。 */
function utf8ByteLength(
  value: string,
  stopAfter = Number.POSITIVE_INFINITY,
): number {
  let length = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) as number;
    length +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
    if (length > stopAfter) {
      return length;
    }
  }
  return length;
}

function assertBackupFileSize(contents: string): void {
  if (utf8ByteLength(contents, MAX_BACKUP_FILE_BYTES) > MAX_BACKUP_FILE_BYTES) {
    throw new BackupEnvelopeError(
      "backup-too-large",
      "$",
      "备份文件超过 16MB，无法安全处理",
    );
  }
}

/** 使用紧凑 Uint8Array 编码 UTF-8，降低大备份在真机上的内存峰值。 */
function encodeUtf8(value: string): Uint8Array {
  const bytes = new Uint8Array(utf8ByteLength(value));
  let offset = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) as number;
    if (codePoint <= 0x7f) {
      bytes[offset] = codePoint;
      offset += 1;
    } else if (codePoint <= 0x7ff) {
      bytes[offset] = 0xc0 | (codePoint >>> 6);
      bytes[offset + 1] = 0x80 | (codePoint & 0x3f);
      offset += 2;
    } else if (codePoint <= 0xffff) {
      bytes[offset] = 0xe0 | (codePoint >>> 12);
      bytes[offset + 1] = 0x80 | ((codePoint >>> 6) & 0x3f);
      bytes[offset + 2] = 0x80 | (codePoint & 0x3f);
      offset += 3;
    } else {
      bytes[offset] = 0xf0 | (codePoint >>> 18);
      bytes[offset + 1] = 0x80 | ((codePoint >>> 12) & 0x3f);
      bytes[offset + 2] = 0x80 | ((codePoint >>> 6) & 0x3f);
      bytes[offset + 3] = 0x80 | (codePoint & 0x3f);
      offset += 4;
    }
  }
  return bytes;
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/** 纯 TypeScript SHA-256，避免在微信小程序运行时依赖 Node crypto。 */
function sha256(value: string): string {
  const encoded = encodeUtf8(value);
  const bitLength = encoded.length * 8;
  const paddedLength = Math.ceil((encoded.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(encoded);
  bytes[encoded.length] = 0x80;
  const highLength = Math.floor(bitLength / 0x100000000);
  const lowLength = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) {
    bytes[paddedLength - 8 + (24 - shift) / 8] =
      (highLength >>> shift) & 0xff;
  }
  for (let shift = 24; shift >= 0; shift -= 8) {
    bytes[paddedLength - 4 + (24 - shift) / 8] =
      (lowLength >>> shift) & 0xff;
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f,
    0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Array<number>(64).fill(0);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] =
        ((bytes[start] << 24) |
          (bytes[start + 1] << 16) |
          (bytes[start + 2] << 8) |
          bytes[start + 3]) >>>
        0;
    }
    for (let index = 16; index < 64; index += 1) {
      const previous = words[index - 15];
      const beforePrevious = words[index - 2];
      const sigmaZero =
        rotateRight(previous, 7) ^
        rotateRight(previous, 18) ^
        (previous >>> 3);
      const sigmaOne =
        rotateRight(beforePrevious, 17) ^
        rotateRight(beforePrevious, 19) ^
        (beforePrevious >>> 10);
      words[index] =
        (words[index - 16] + sigmaZero + words[index - 7] + sigmaOne) >>> 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let index = 0; index < 64; index += 1) {
      const sumOne =
        rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporaryOne =
        (h +
          sumOne +
          choice +
          SHA256_ROUND_CONSTANTS[index] +
          words[index]) >>>
        0;
      const sumZero =
        rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporaryTwo = (sumZero + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporaryOne) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporaryOne + temporaryTwo) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((part) => part.toString(16).padStart(8, "0")).join("");
}

/** 为其他受版本控制的本地文件协议提供与备份 v1 相同的规范化 SHA-256。 */
export function createCanonicalPayloadChecksum(payload: unknown): string {
  return sha256(canonicalStringify(payload));
}

/** 在解析复杂结构前复用产品备份的真机内存安全上限。 */
export function assertBackupFileWithinSizeLimit(contents: string): void {
  assertBackupFileSize(contents);
}

function createPayload(options: CreateBackupFileOptions): BackupPayloadV1 {
  let data: ApplicationData;
  try {
    data = migrateApplicationData(options.data);
  } catch (error) {
    if (error instanceof DataMigrationError) {
      throw mapMigrationError(error);
    }
    throw error;
  }
  return {
    format: BACKUP_FORMAT,
    formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
    createdAt: parseIsoDateTime(options.createdAt, "$.createdAt"),
    appVersion: parseAppVersion(options.appVersion, "$.appVersion"),
    data,
  };
}

function createSummary(data: ApplicationData): BackupDataSummary {
  const summary = {
    inventoryItemCount: data.inventoryItems.length,
    inventoryMovementCount: data.inventoryMovements.length,
    projectCount: data.projects.length,
    customerCount: data.customers.length,
    appointmentCount: data.appointments.length,
  };
  return {
    ...summary,
    hasBusinessData: Object.values(summary).some((count) => count > 0),
  };
}

function mapMigrationError(error: DataMigrationError): BackupEnvelopeError {
  switch (error.code) {
    case "future-version":
      return new BackupEnvelopeError(
        "future-data-version",
        `$.data${error.path.slice(1)}`,
        error.message,
      );
    case "unsupported-version":
      return new BackupEnvelopeError(
        "unsupported-data-version",
        `$.data${error.path.slice(1)}`,
        error.message,
      );
    case "invalid-data":
      return new BackupEnvelopeError(
        "invalid-data",
        `$.data${error.path.slice(1)}`,
        error.message,
      );
  }
}

/**
 * 生成可直接交给微信文件 adapter 写入的 UTF-8 JSON 文本。
 * 返回前会重新校验完整数据，并对 envelope 除 checksum 外的全部字段计算 SHA-256。
 */
export function createBackupFileContent(
  options: CreateBackupFileOptions,
): string {
  const payload = createPayload(options);
  const canonicalPayload = canonicalStringify(payload);
  assertBackupFileSize(canonicalPayload);
  const envelope: BackupEnvelopeV1 = {
    ...payload,
    payloadChecksum: sha256(canonicalPayload),
  };
  const contents = JSON.stringify(envelope, null, 2);
  assertBackupFileSize(contents);
  return contents;
}

/**
 * 对未知 JSON 文本执行恢复预检。
 * 成功结果中的 `data` 已迁移到当前 schema；失败会抛出稳定错误且不产生任何副作用。
 * `currentAppVersion` 必须使用 major.minor.patch 格式，用于拒绝较新应用生成的备份。
 */
export function preflightBackupFileContent(
  contents: string,
  currentAppVersion: string,
): BackupPreflightResult {
  const parsedCurrentAppVersion = parseAppVersion(
    currentAppVersion,
    "$currentAppVersion",
  );
  assertBackupFileSize(contents);

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new BackupEnvelopeError(
      "invalid-json",
      "$",
      "备份文件不是有效的 JSON",
    );
  }

  const envelope = parseRecord(parsed, "$");
  if (envelope.format !== BACKUP_FORMAT) {
    invalidEnvelope("$.format", `必须为 ${BACKUP_FORMAT}`);
  }

  const formatVersion = parseFormatVersion(envelope.formatVersion);
  if (formatVersion > CURRENT_BACKUP_FORMAT_VERSION) {
    throw new BackupEnvelopeError(
      "future-format-version",
      "$.formatVersion",
      `备份格式版本 ${formatVersion} 高于当前支持版本 ${CURRENT_BACKUP_FORMAT_VERSION}，请先升级应用`,
    );
  }
  if (formatVersion < CURRENT_BACKUP_FORMAT_VERSION) {
    throw new BackupEnvelopeError(
      "unsupported-format-version",
      "$.formatVersion",
      `暂不支持备份格式版本 ${formatVersion}`,
    );
  }

  ensureOnlyFields(
    envelope,
    [
      "format",
      "formatVersion",
      "createdAt",
      "appVersion",
      "payloadChecksum",
      "data",
    ],
    "$",
  );
  const createdAt = parseIsoDateTime(envelope.createdAt, "$.createdAt");
  const appVersion = parseAppVersion(envelope.appVersion, "$.appVersion");
  if (compareAppVersions(appVersion, parsedCurrentAppVersion) > 0) {
    throw new BackupEnvelopeError(
      "future-app-version",
      "$.appVersion",
      `该备份由较新的应用版本 ${appVersion} 生成，请先升级应用`,
    );
  }
  if (
    typeof envelope.payloadChecksum !== "string" ||
    !SHA256_PATTERN.test(envelope.payloadChecksum)
  ) {
    invalidEnvelope("$.payloadChecksum", "必须是 64 位 SHA-256 十六进制字符串");
  }
  if (!Object.prototype.hasOwnProperty.call(envelope, "data")) {
    invalidEnvelope("$.data", "不能为空");
  }

  const payload: BackupPayloadV1 = {
    format: BACKUP_FORMAT,
    formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
    createdAt,
    appVersion,
    data: envelope.data,
  };
  const actualChecksum = sha256(canonicalStringify(payload));
  if (actualChecksum !== envelope.payloadChecksum.toLowerCase()) {
    throw new BackupEnvelopeError(
      "checksum-mismatch",
      "$.payloadChecksum",
      "备份文件完整性校验失败，文件可能已损坏或被修改",
    );
  }

  let data: ApplicationData;
  try {
    data = migrateApplicationData(envelope.data);
  } catch (error) {
    if (error instanceof DataMigrationError) {
      throw mapMigrationError(error);
    }
    throw error;
  }

  return {
    createdAt,
    appVersion,
    data,
    summary: createSummary(data),
  };
}
