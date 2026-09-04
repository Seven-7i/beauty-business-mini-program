import type {
  ApplicationData,
  IsoDateTimeString,
} from "@/domain/data-schema";
import type { SelectedBusinessModuleData } from "@/domain/module-data";
import { isBusinessModuleId } from "@/domain/business-module";
import type { StorageAdapter } from "@/infrastructure/storage/uni-storage-adapter";
import { publishStorageCapacityChanged } from "@/infrastructure/storage/storage-capacity-events";
import { runExclusiveStorageOperation } from "@/infrastructure/storage/storage-operation-lock";
import type { ApplicationDataRollbackFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import {
  createBackupFileContent,
  preflightBackupFileContent,
} from "@/services/backup-envelope";
import { migrateApplicationData } from "@/services/data-migrations";
import {
  applyBusinessDataMutation,
  type BusinessDataMutation,
} from "./business-data-mutation";

const SCHEMA_KEY = "bm:meta:schema";
const SETTINGS_KEY = "bm:settings";
const UNLOCKED_MODULES_KEY = "bm:modules:unlocked";
const BACKUP_METADATA_KEY = "bm:backup:metadata";
const RECOVERY_TRANSACTION_KEY = "bm:txn:recovery";
const INDEX_SHARD_SIZE = 100;
const MAX_ENTITY_RECORDS = 100_000;

type EntityCollectionName =
  | "inventoryItems"
  | "inventoryMovements"
  | "projects"
  | "customers"
  | "appointments";

type StorageEntityName =
  | "inventory-item"
  | "inventory-movement"
  | "project"
  | "customer"
  | "appointment";

interface EntityLayout {
  collection: EntityCollectionName;
  entity: StorageEntityName;
}

/** 当前版本全部实体集合与 Storage key 名称的唯一映射。 */
const ENTITY_LAYOUTS: readonly EntityLayout[] = [
  { collection: "inventoryItems", entity: "inventory-item" },
  { collection: "inventoryMovements", entity: "inventory-movement" },
  { collection: "projects", entity: "project" },
  { collection: "customers", entity: "customer" },
  { collection: "appointments", entity: "appointment" },
];

interface EntityIndexManifest {
  schemaVersion: 1;
  entity: StorageEntityName;
  shardCount: number;
  itemCount: number;
}

interface EntityIndexShard {
  schemaVersion: 1;
  entity: StorageEntityName;
  position: number;
  ids: string[];
}

type RecoveryTransactionState = "writing" | "committed" | "rolled-back";

interface RecoveryTransaction {
  kind: "application-data-recovery";
  formatVersion: 1;
  runId: string;
  state: RecoveryTransactionState;
}

interface FullRollbackSnapshot {
  kind: "application-data-rollback";
  formatVersion: 1;
  runId: string;
  /** 本轮候选写入可能创建的全部 key，回滚时据此清除延迟可见的残留。 */
  candidateKeys: string[];
  /** 内层使用产品备份 envelope，自带 SHA-256 和 schema 校验。 */
  backupContents: string;
}

/** 高频日常命令只保存本次涉及的集合旧值，避免每次序列化整库。 */
interface MutationRollbackSnapshot {
  kind: "application-data-mutation-rollback";
  formatVersion: 1;
  runId: string;
  /** 本轮局部写入可能创建或替换的业务 key。 */
  candidateKeys: string[];
  /** 便于验证回滚 key 只属于命令声明的集合。 */
  affectedCollections: EntityCollectionName[];
  /** 仅记录实际变化 key 的旧值；不存在的 key 用 existed=false 表示。 */
  previousEntries: PreviousStorageEntry[];
  /** 首次业务时间可能随任一业务命令设置，因此与集合一同回滚。 */
  previousBackupMetadata: ApplicationData["backupMetadata"];
}

type RollbackSnapshot = FullRollbackSnapshot | MutationRollbackSnapshot;

interface PreviousStorageEntry {
  key: string;
  existed: boolean;
  value?: unknown;
}

interface MutationStoragePlan {
  affectedCollections: readonly EntityCollectionName[];
  entriesToSet: StorageEntry[];
  keysToRemove: string[];
  previousEntries: PreviousStorageEntry[];
}

/** 启动时处理中断的整库恢复或日常业务写入后得到的可观察结果。 */
export type InterruptedRecoveryResult =
  | "none"
  | "rolled-back"
  | "rolled-back-cleanup"
  | "committed-cleanup";

/** 应用完整数据仓储对上层暴露的窄接口。 */
export interface ApplicationDataRepository {
  /** 汇总所有设置、授权和实体 key，返回当前版本完整快照。 */
  readSnapshot(): Promise<ApplicationData>;
  /**
   * 使用文件快照保护，把当前数据整体替换为候选快照。
   * 调用方必须先完成备份预检和用户的恢复覆盖确认，本接口不执行合并。
   */
  replaceSnapshot(data: ApplicationData): Promise<void>;
  /**
   * 在共享队列内基于最新快照只替换出现的模块，未选择模块和全局字段保持不变。
   * 调用方必须已完成模块备份预检和用户覆盖确认。
   */
  replaceSelectedModules(data: SelectedBusinessModuleData): Promise<void>;
  /** 原子提交一条封闭业务命令，只重写命令涉及的实体集合和索引。 */
  applyBusinessMutation(mutation: BusinessDataMutation): Promise<void>;
  /** 在共享写入队列内只更新最近导出元数据，不重写全部业务实体。 */
  recordSuccessfulExport(
    exportedAt: IsoDateTimeString,
    fileName: string,
  ): Promise<void>;
  /** 记录本地自然日内已经展示过备份提醒，避免每次返回首页重复打扰。 */
  recordBackupReminderShown(localDate: string): Promise<void>;
  /** 恢复上次被关闭或异常中断的数据写入；名称保留以兼容现有调用方。 */
  recoverInterruptedReplace(): Promise<InterruptedRecoveryResult>;
}

/** 产品恢复仅依赖的微信文件能力，避免暴露选择和分享操作。 */
type RollbackFilePort = ApplicationDataRollbackFileAdapter;

/** 创建本地数据仓储所需的可替换依赖。 */
export interface ApplicationDataRepositoryOptions {
  storage: StorageAdapter;
  rollbackFiles: RollbackFilePort;
  /** 当前运行的小程序版本，使用 major.minor.patch 格式。 */
  appVersion: string;
  /** 注入时钟便于稳定测试，生产默认使用当前时间。 */
  now?: () => Date;
}

type UnknownRecord = Record<string, unknown>;
type StorageEntry = readonly [key: string, value: unknown];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyFields(
  record: UnknownRecord,
  allowedFields: readonly string[],
): boolean {
  const allowed = new Set(allowedFields);
  return Object.keys(record).every((field) => allowed.has(field));
}

function entityManifestKey(entity: StorageEntityName): string {
  return `bm:index:${entity}:manifest`;
}

function entityShardKey(entity: StorageEntityName, position: number): string {
  return `bm:index:${entity}:${position}`;
}

function entityRecordKey(entity: StorageEntityName, id: string): string {
  return `bm:entity:${entity}:${encodeURIComponent(id)}`;
}

function isManagedDataKey(key: string): boolean {
  if (
    key === SCHEMA_KEY ||
    key === SETTINGS_KEY ||
    key === UNLOCKED_MODULES_KEY ||
    key === BACKUP_METADATA_KEY
  ) {
    return true;
  }
  return ENTITY_LAYOUTS.some(
    ({ entity }) =>
      key.startsWith(`bm:entity:${entity}:`) ||
      key.startsWith(`bm:index:${entity}:`),
  );
}

function isCollectionDataKey(
  key: string,
  collections: readonly EntityCollectionName[],
): boolean {
  return ENTITY_LAYOUTS.some(
    ({ collection, entity }) =>
      collections.includes(collection) &&
      (key.startsWith(`bm:entity:${entity}:`) ||
        key.startsWith(`bm:index:${entity}:`)),
  );
}

function parseManifest(
  value: unknown,
  expectedEntity: StorageEntityName,
): EntityIndexManifest {
  if (
    !isRecord(value) ||
    !hasOnlyFields(value, [
      "schemaVersion",
      "entity",
      "shardCount",
      "itemCount",
    ]) ||
    value.schemaVersion !== 1 ||
    value.entity !== expectedEntity ||
    !Number.isSafeInteger(value.shardCount) ||
    (value.shardCount as number) < 0 ||
    !Number.isSafeInteger(value.itemCount) ||
    (value.itemCount as number) < 0 ||
    (value.itemCount as number) > MAX_ENTITY_RECORDS ||
    (value.shardCount as number) !==
      Math.ceil((value.itemCount as number) / INDEX_SHARD_SIZE)
  ) {
    throw new Error(`${expectedEntity} 索引清单无效`);
  }
  return value as unknown as EntityIndexManifest;
}

function parseShard(
  value: unknown,
  expectedEntity: StorageEntityName,
  expectedPosition: number,
): EntityIndexShard {
  if (
    !isRecord(value) ||
    !hasOnlyFields(value, ["schemaVersion", "entity", "position", "ids"]) ||
    value.schemaVersion !== 1 ||
    value.entity !== expectedEntity ||
    value.position !== expectedPosition ||
    !Array.isArray(value.ids) ||
    value.ids.length === 0 ||
    value.ids.length > INDEX_SHARD_SIZE ||
    !value.ids.every((id) => typeof id === "string" && id.length > 0)
  ) {
    throw new Error(`${expectedEntity} 第 ${expectedPosition + 1} 个索引分片无效`);
  }
  return value as unknown as EntityIndexShard;
}

function parseTransaction(value: unknown): RecoveryTransaction {
  if (
    !isRecord(value) ||
    !hasOnlyFields(value, ["kind", "formatVersion", "runId", "state"]) ||
    value.kind !== "application-data-recovery" ||
    value.formatVersion !== 1 ||
    typeof value.runId !== "string" ||
    value.runId.length === 0 ||
    !["writing", "committed", "rolled-back"].includes(value.state as string)
  ) {
    throw new Error("产品恢复事务状态无效");
  }
  return value as unknown as RecoveryTransaction;
}

function parseRollbackSnapshot(contents: string): RollbackSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error("产品恢复回滚快照不是有效 JSON");
  }
  if (!isRecord(value)) {
    throw new Error("产品恢复回滚快照格式无效");
  }
  const hasValidCommonFields =
    value.formatVersion === 1 &&
    typeof value.runId === "string" &&
    value.runId.length > 0 &&
    Array.isArray(value.candidateKeys) &&
    value.candidateKeys.length > 0 &&
    value.candidateKeys.every(
      (key) => typeof key === "string" && isManagedDataKey(key),
    ) &&
    new Set(value.candidateKeys).size === value.candidateKeys.length;
  if (!hasValidCommonFields) {
    throw new Error("产品恢复回滚快照格式无效");
  }
  if (
    value.kind === "application-data-rollback" &&
    hasOnlyFields(value, [
      "kind",
      "formatVersion",
      "runId",
      "candidateKeys",
      "backupContents",
    ]) &&
    typeof value.backupContents === "string"
  ) {
    return value as unknown as FullRollbackSnapshot;
  }
  if (
    value.kind === "application-data-mutation-rollback" &&
    hasOnlyFields(value, [
      "kind",
      "formatVersion",
      "runId",
      "candidateKeys",
      "affectedCollections",
      "previousEntries",
      "previousBackupMetadata",
    ]) &&
    Array.isArray(value.affectedCollections) &&
    value.affectedCollections.length > 0 &&
    value.affectedCollections.every(
      (collection) =>
        typeof collection === "string" &&
        ENTITY_LAYOUTS.some((layout) => layout.collection === collection),
    ) &&
    new Set(value.affectedCollections).size ===
      value.affectedCollections.length &&
    (value.candidateKeys as unknown[]).every(
      (key: unknown) =>
        typeof key === "string" &&
        key === BACKUP_METADATA_KEY ||
        (typeof key === "string" &&
          isCollectionDataKey(
            key,
            (value as UnknownRecord)
              .affectedCollections as EntityCollectionName[],
          )),
    ) &&
    Array.isArray(value.previousEntries) &&
    value.previousEntries.length ===
      ((value as UnknownRecord).candidateKeys as unknown[]).length &&
    value.previousEntries.every(
      (entry) =>
        isRecord(entry) &&
        hasOnlyFields(entry, ["key", "existed", "value"]) &&
        typeof entry.key === "string" &&
        ((value as UnknownRecord).candidateKeys as unknown[]).includes(
          entry.key,
        ) &&
        typeof entry.existed === "boolean" &&
        (entry.existed ? Object.hasOwn(entry, "value") : !Object.hasOwn(entry, "value")),
    ) &&
    new Set(
      value.previousEntries.map((entry) =>
        isRecord(entry) ? entry.key : undefined,
      ),
    ).size === value.previousEntries.length &&
    isRecord(value.previousBackupMetadata)
  ) {
    return value as unknown as MutationRollbackSnapshot;
  }
  throw new Error("产品恢复回滚快照格式无效");
}

function normalizedData(data: ApplicationData): ApplicationData {
  const migrated = migrateApplicationData(data);
  return {
    ...migrated,
    inventoryItems: [...migrated.inventoryItems].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    inventoryMovements: [...migrated.inventoryMovements].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    projects: [...migrated.projects].sort((a, b) => a.id.localeCompare(b.id)),
    customers: [...migrated.customers].sort((a, b) => a.id.localeCompare(b.id)),
    appointments: [...migrated.appointments].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };
}

function dataEqual(left: ApplicationData, right: ApplicationData): boolean {
  return JSON.stringify(normalizedData(left)) === JSON.stringify(normalizedData(right));
}

function createEntityEntries(
  entity: StorageEntityName,
  records: readonly { id: string }[],
): StorageEntry[] {
  const sortedRecords = [...records].sort((a, b) => a.id.localeCompare(b.id));
  const entries: StorageEntry[] = sortedRecords.map((record) => [
    entityRecordKey(entity, record.id),
    record,
  ]);
  const shardCount = Math.ceil(sortedRecords.length / INDEX_SHARD_SIZE);

  for (let position = 0; position < shardCount; position += 1) {
    const start = position * INDEX_SHARD_SIZE;
    const shard: EntityIndexShard = {
      schemaVersion: 1,
      entity,
      position,
      ids: sortedRecords
        .slice(start, start + INDEX_SHARD_SIZE)
        .map((record) => record.id),
    };
    entries.push([entityShardKey(entity, position), shard]);
  }

  const manifest: EntityIndexManifest = {
    schemaVersion: 1,
    entity,
    shardCount,
    itemCount: sortedRecords.length,
  };
  entries.push([entityManifestKey(entity), manifest]);
  return entries;
}

function createStorageEntries(data: ApplicationData): StorageEntry[] {
  const normalized = normalizedData(data);
  const entries: StorageEntry[] = [];
  for (const layout of ENTITY_LAYOUTS) {
    entries.push(
      ...createEntityEntries(
        layout.entity,
        normalized[layout.collection] as readonly { id: string }[],
      ),
    );
  }
  // 元数据最后写入；读取到 schemaVersion=1 时，各实体索引必须已经完整存在。
  entries.push(
    [SETTINGS_KEY, normalized.settings],
    [UNLOCKED_MODULES_KEY, normalized.unlockedModules],
    [BACKUP_METADATA_KEY, normalized.backupMetadata],
    [SCHEMA_KEY, normalized.schemaVersion],
  );
  return entries;
}

function storageValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** 计算日常命令实际改变的实体/索引 key，未变化的同集合记录不会进入 I/O。 */
function createMutationStoragePlan(
  previous: ApplicationData,
  candidate: ApplicationData,
  affectedCollections: readonly EntityCollectionName[],
): MutationStoragePlan {
  const previousByKey = new Map<string, unknown>();
  const candidateByKey = new Map<string, unknown>();
  for (const collection of affectedCollections) {
    const layout = ENTITY_LAYOUTS.find(
      (candidateLayout) => candidateLayout.collection === collection,
    );
    if (!layout) {
      throw new Error(`未知业务实体集合：${collection}`);
    }
    for (const [key, value] of createEntityEntries(
      layout.entity,
      previous[collection] as readonly { id: string }[],
    )) {
      previousByKey.set(key, value);
    }
    for (const [key, value] of createEntityEntries(
      layout.entity,
      candidate[collection] as readonly { id: string }[],
    )) {
      candidateByKey.set(key, value);
    }
  }
  previousByKey.set(BACKUP_METADATA_KEY, previous.backupMetadata);
  candidateByKey.set(BACKUP_METADATA_KEY, candidate.backupMetadata);

  const entriesToSet: StorageEntry[] = [];
  const keysToRemove: string[] = [];
  const previousEntries: PreviousStorageEntry[] = [];
  const allKeys = new Set([...previousByKey.keys(), ...candidateByKey.keys()]);
  for (const key of allKeys) {
    const existed = previousByKey.has(key);
    const nextExists = candidateByKey.has(key);
    const oldValue = previousByKey.get(key);
    const nextValue = candidateByKey.get(key);
    if (existed === nextExists && storageValuesEqual(oldValue, nextValue)) {
      continue;
    }
    previousEntries.push(
      existed ? { key, existed: true, value: oldValue } : { key, existed: false },
    );
    if (nextExists) {
      entriesToSet.push([key, nextValue]);
    } else {
      keysToRemove.push(key);
    }
  }
  return {
    affectedCollections,
    entriesToSet,
    keysToRemove,
    previousEntries,
  };
}

function createRunId(now: Date): string {
  return `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function combineErrors(primary: unknown, secondary: unknown, label: string): Error {
  const primaryMessage =
    primary instanceof Error ? primary.message : String(primary);
  const secondaryMessage =
    secondary instanceof Error ? secondary.message : String(secondary);
  return new Error(`${primaryMessage}；${label}也失败：${secondaryMessage}`);
}

/**
 * 创建应用完整数据仓储。
 * key 布局、分片索引、回滚文件和中断事务均隐藏在该 module 内部。
 */
export function createApplicationDataRepository(
  options: ApplicationDataRepositoryOptions,
): ApplicationDataRepository {
  const { storage, rollbackFiles, appVersion } = options;
  const now = options.now ?? (() => new Date());

  async function readEntityRecords(layout: EntityLayout): Promise<unknown[]> {
    const rawManifest = await storage.get<unknown>(
      entityManifestKey(layout.entity),
    );
    if (rawManifest === undefined) {
      throw new Error(`${layout.entity} 索引清单缺失`);
    }
    const manifest = parseManifest(rawManifest, layout.entity);
    const ids: string[] = [];
    for (let position = 0; position < manifest.shardCount; position += 1) {
      const rawShard = await storage.get<unknown>(
        entityShardKey(layout.entity, position),
      );
      const shard = parseShard(rawShard, layout.entity, position);
      ids.push(...shard.ids);
    }
    if (ids.length !== manifest.itemCount || new Set(ids).size !== ids.length) {
      throw new Error(`${layout.entity} 索引数量或唯一性校验失败`);
    }

    const records: unknown[] = [];
    for (const id of ids) {
      const record = await storage.get<unknown>(entityRecordKey(layout.entity, id));
      if (!isRecord(record) || record.id !== id) {
        throw new Error(`${layout.entity} 记录 ${id} 缺失或标识不一致`);
      }
      records.push(record);
    }
    return records;
  }

  async function readWithoutRecovery(): Promise<ApplicationData> {
    const schemaVersion = await storage.get<unknown>(SCHEMA_KEY);
    if (schemaVersion === undefined) {
      const rawModules = await storage.get<unknown>(UNLOCKED_MODULES_KEY);
      const unlockedModules = Array.isArray(rawModules)
        ? [...new Set(rawModules.filter(isBusinessModuleId))]
        : [];
      const rawSettings = await storage.get<unknown>(SETTINGS_KEY);
      const defaultModuleId =
        isRecord(rawSettings) &&
        isBusinessModuleId(rawSettings.defaultModuleId) &&
        unlockedModules.includes(rawSettings.defaultModuleId)
          ? rawSettings.defaultModuleId
          : undefined;
      return normalizedData(
        migrateApplicationData({
          unlockedModules,
          ...(defaultModuleId === undefined ? {} : { defaultModuleId }),
        }),
      );
    }

    if (schemaVersion !== 1) {
      return migrateApplicationData({ schemaVersion }) as ApplicationData;
    }

    const [settings, unlockedModules, backupMetadata, ...collections] =
      await Promise.all([
        storage.get<unknown>(SETTINGS_KEY),
        storage.get<unknown>(UNLOCKED_MODULES_KEY),
        storage.get<unknown>(BACKUP_METADATA_KEY),
        ...ENTITY_LAYOUTS.map((layout) => readEntityRecords(layout)),
      ]);
    const data: Record<string, unknown> = {
      schemaVersion,
      settings,
      unlockedModules,
      backupMetadata,
    };
    ENTITY_LAYOUTS.forEach((layout, index) => {
      data[layout.collection] = collections[index];
    });
    return normalizedData(migrateApplicationData(data));
  }

  async function clearManagedData(
    additionalKeys: readonly string[] = [],
  ): Promise<void> {
    const { keys } = await storage.getCapacityInfo();
    const managedKeys = new Set([
      ...keys.filter(isManagedDataKey),
      ...additionalKeys.filter(isManagedDataKey),
    ]);
    let failure: unknown;
    for (const key of managedKeys) {
      try {
        await storage.remove(key);
      } catch (error) {
        failure =
          failure === undefined
            ? error
            : combineErrors(failure, error, `删除 ${key}`);
      }
    }
    if (failure !== undefined) {
      throw failure;
    }
  }

  async function writeWithoutRollback(
    data: ApplicationData,
    additionalKeysToClear: readonly string[] = [],
  ): Promise<void> {
    const normalized = normalizedData(data);
    await clearManagedData(additionalKeysToClear);
    for (const [key, value] of createStorageEntries(normalized)) {
      await storage.set(key, value);
    }
    const persisted = await readWithoutRecovery();
    if (!dataEqual(persisted, normalized)) {
      throw new Error("整体写入后数据校验失败");
    }
  }

  async function writeMutationWithoutRollback(
    previous: ApplicationData,
    candidate: ApplicationData,
    affectedCollections: readonly EntityCollectionName[],
    plan?: MutationStoragePlan,
  ): Promise<void> {
    const hasCurrentSchema = (await storage.get<unknown>(SCHEMA_KEY)) === 1;
    if (hasCurrentSchema && plan) {
      for (const key of plan.keysToRemove) {
        await storage.remove(key);
      }
      for (const [key, value] of plan.entriesToSet) {
        await storage.set(key, value);
      }
      const persisted = await readWithoutRecovery();
      if (!dataEqual(persisted, candidate)) {
        throw new Error("业务变更写入后数据校验失败");
      }
      return;
    }
    const collectionsToWrite = hasCurrentSchema
      ? affectedCollections
      : ENTITY_LAYOUTS.map(({ collection }) => collection);
    for (const collection of collectionsToWrite) {
      const layout = ENTITY_LAYOUTS.find(
        (candidateLayout) => candidateLayout.collection === collection,
      );
      if (!layout) {
        throw new Error(`未知业务实体集合：${collection}`);
      }
      const previousEntries = createEntityEntries(
        layout.entity,
        previous[collection] as readonly { id: string }[],
      );
      const candidateEntries = createEntityEntries(
        layout.entity,
        candidate[collection] as readonly { id: string }[],
      );
      const keysToReplace = new Set([
        ...previousEntries.map(([key]) => key),
        ...candidateEntries.map(([key]) => key),
      ]);
      for (const key of keysToReplace) {
        await storage.remove(key);
      }
      for (const [key, value] of candidateEntries) {
        await storage.set(key, value);
      }
    }

    // 日常命令只更新可能变化的备份提醒元数据；已存在的核心设置不重复写。
    await storage.set(BACKUP_METADATA_KEY, candidate.backupMetadata);
    if (!hasCurrentSchema) {
      // 首次业务写入必须补齐核心 key；schema 最后写入表示实体索引已完整。
      await storage.set(SETTINGS_KEY, candidate.settings);
      await storage.set(UNLOCKED_MODULES_KEY, candidate.unlockedModules);
      await storage.set(SCHEMA_KEY, candidate.schemaVersion);
    }
    const persisted = await readWithoutRecovery();
    if (!dataEqual(persisted, candidate)) {
      throw new Error("业务变更写入后数据校验失败");
    }
  }

  async function restoreMutationRollback(
    rollback: MutationRollbackSnapshot,
  ): Promise<void> {
    for (const entry of rollback.previousEntries) {
      if (entry.existed) {
        await storage.set(entry.key, entry.value);
      } else {
        await storage.remove(entry.key);
      }
    }
    // 完整读取会复核所有实体引用，也证明局部 key 已恢复为有效快照。
    await readWithoutRecovery();
  }

  async function cleanupTransaction(): Promise<void> {
    await rollbackFiles.removeApplicationDataRollbackSnapshot();
    await storage.remove(RECOVERY_TRANSACTION_KEY);
  }

  async function recoverInternal(): Promise<InterruptedRecoveryResult> {
    const rawTransaction = await storage.get<unknown>(RECOVERY_TRANSACTION_KEY);
    const rollbackContents =
      await rollbackFiles.readApplicationDataRollbackSnapshotIfExists();

    if (rawTransaction === undefined) {
      if (rollbackContents === undefined) {
        return "none";
      }
      // 独立产品事务尚未开始，业务 key 未变化；残缺文件也可直接幂等清理。
      await rollbackFiles.removeApplicationDataRollbackSnapshot();
      return "committed-cleanup";
    }

    const transaction = parseTransaction(rawTransaction);
    if (transaction.state === "committed" || transaction.state === "rolled-back") {
      if (rollbackContents !== undefined) {
        const rollback = parseRollbackSnapshot(rollbackContents);
        if (rollback.runId !== transaction.runId) {
          throw new Error("产品恢复事务与回滚快照不匹配");
        }
      }
      await cleanupTransaction();
      return transaction.state === "committed"
        ? "committed-cleanup"
        : "rolled-back-cleanup";
    }
    if (rollbackContents === undefined) {
      throw new Error("产品恢复事务已开始，但回滚快照缺失");
    }

    const rollback = parseRollbackSnapshot(rollbackContents);
    if (rollback.runId !== transaction.runId) {
      throw new Error("产品恢复事务与回滚快照不匹配");
    }
    if (rollback.kind === "application-data-rollback") {
      const previous = preflightBackupFileContent(
        rollback.backupContents,
        appVersion,
      ).data;
      await writeWithoutRollback(previous, rollback.candidateKeys);
    } else {
      await restoreMutationRollback(rollback);
    }
    await storage.set(RECOVERY_TRANSACTION_KEY, {
      ...transaction,
      state: "rolled-back",
    } satisfies RecoveryTransaction);
    await cleanupTransaction();
    return "rolled-back";
  }

  async function executeSnapshotTransaction(
    previous: ApplicationData,
    candidate: ApplicationData,
    startedAt: Date,
    writeCandidate: () => Promise<void>,
    mutationPlan?: MutationStoragePlan,
  ): Promise<void> {
    const normalizedCandidate = normalizedData(candidate);
    const useMutationRollback = mutationPlan !== undefined;
    const candidateKeys = useMutationRollback
      ? mutationPlan.previousEntries.map(({ key }) => key)
      : createStorageEntries(normalizedCandidate).map(([key]) => key);
    const runId = createRunId(startedAt);
    const rollback: RollbackSnapshot = useMutationRollback
      ? {
          kind: "application-data-mutation-rollback",
          formatVersion: 1,
          runId,
          candidateKeys,
          affectedCollections: [...mutationPlan.affectedCollections],
          previousEntries: mutationPlan.previousEntries,
          previousBackupMetadata: previous.backupMetadata,
        }
      : {
          kind: "application-data-rollback",
          formatVersion: 1,
          runId,
          candidateKeys,
          backupContents: createBackupFileContent({
            data: previous,
            createdAt: startedAt.toISOString(),
            appVersion,
          }),
        };
    let snapshotMayExist = true;
    let transactionMayExist = false;
    let candidateWriteCompleted = false;

    try {
      await rollbackFiles.writeApplicationDataRollbackSnapshot(
        JSON.stringify(rollback),
      );
      const persistedRollback = parseRollbackSnapshot(
        await rollbackFiles.readApplicationDataRollbackSnapshot(),
      );
      if (persistedRollback.runId !== runId) {
        throw new Error("应用数据回滚快照读回校验失败");
      }
      if (persistedRollback.kind === "application-data-rollback") {
        const persistedPrevious = preflightBackupFileContent(
          persistedRollback.backupContents,
          appVersion,
        ).data;
        if (!dataEqual(persistedPrevious, previous)) {
          throw new Error("应用数据回滚数据读回校验失败");
        }
      } else if (
        JSON.stringify(persistedRollback.previousEntries) !==
          JSON.stringify(
            (rollback as MutationRollbackSnapshot).previousEntries,
          ) ||
        JSON.stringify(persistedRollback.previousBackupMetadata) !==
          JSON.stringify(previous.backupMetadata)
      ) {
        throw new Error("业务变更局部回滚数据读回校验失败");
      }

      const transaction: RecoveryTransaction = {
        kind: "application-data-recovery",
        formatVersion: 1,
        runId,
        state: "writing",
      };
      transactionMayExist = true;
      await storage.set(RECOVERY_TRANSACTION_KEY, transaction);
      await writeCandidate();
      candidateWriteCompleted = true;
      await storage.set(RECOVERY_TRANSACTION_KEY, {
        ...transaction,
        state: "committed",
      } satisfies RecoveryTransaction);

      // 提交已生效；清理失败由下次启动处理，不把成功写入误报为失败。
      try {
        await cleanupTransaction();
      } catch {
        // recoverInterruptedReplace/readSnapshot 会识别 committed 并继续清理。
      }
      snapshotMayExist = false;
      transactionMayExist = false;
    } catch (error) {
      let failure: unknown = error;
      if (snapshotMayExist && !transactionMayExist) {
        try {
          await rollbackFiles.removeApplicationDataRollbackSnapshot();
          snapshotMayExist = false;
        } catch (cleanupError) {
          failure = combineErrors(failure, cleanupError, "清理无效回滚快照");
        }
      } else if (snapshotMayExist || transactionMayExist) {
        try {
          const recoveryResult = await recoverInternal();
          snapshotMayExist = false;
          transactionMayExist = false;
          // 只有候选数据已经完整写入时，committed 才能把丢失的成功回调视作成功。
          // 起始事务标记写入前失败只会留下孤儿快照，不能误报业务保存成功。
          if (
            recoveryResult === "committed-cleanup" &&
            candidateWriteCompleted
          ) {
            return;
          }
        } catch (rollbackError) {
          failure = combineErrors(failure, rollbackError, "恢复原数据");
        }
      }
      throw failure;
    }
  }

  async function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    return runExclusiveStorageOperation(operation);
  }

  return {
    readSnapshot() {
      return runExclusive(async () => {
        await recoverInternal();
        return readWithoutRecovery();
      });
    },

    replaceSnapshot(candidate) {
      return runExclusive(async () => {
        await recoverInternal();
        const normalizedCandidate = normalizedData(candidate);
        const previous = await readWithoutRecovery();
        const previousKeys = createStorageEntries(previous).map(([key]) => key);
        const startedAt = now();
        await executeSnapshotTransaction(
          previous,
          normalizedCandidate,
          startedAt,
          () => writeWithoutRollback(normalizedCandidate, previousKeys),
        );
      });
    },

    replaceSelectedModules(selectedModules) {
      return runExclusive(async () => {
        await recoverInternal();
        if (selectedModules.beauty === undefined) {
          throw new Error("选择模块恢复至少需要一个已支持模块");
        }
        const previous = await readWithoutRecovery();
        // 合并发生在共享 FIFO 内，确保预检后新增的全局元数据不会被旧快照覆盖。
        const candidate = normalizedData({
          ...previous,
          ...selectedModules.beauty,
        });
        const affectedCollections = ENTITY_LAYOUTS.map(
          ({ collection }) => collection,
        );
        const mutationPlan = createMutationStoragePlan(
          previous,
          candidate,
          affectedCollections,
        );
        if (mutationPlan.previousEntries.length === 0) {
          return;
        }
        await executeSnapshotTransaction(
          previous,
          candidate,
          now(),
          () =>
            writeMutationWithoutRollback(
              previous,
              candidate,
              affectedCollections,
              mutationPlan,
            ),
          mutationPlan,
        );
      });
    },

    async applyBusinessMutation(mutation) {
      await runExclusive(async () => {
        await recoverInternal();
        const previous = await readWithoutRecovery();
        const startedAt = now();
        const candidate = applyBusinessDataMutation(
          previous,
          mutation,
          startedAt.toISOString(),
        );
        const affectedCollections: EntityCollectionName[] = (() => {
          switch (mutation.kind) {
            case "commit-inventory-adjustment":
            case "delete-unreferenced-inventory-item":
              return ["inventoryItems", "inventoryMovements"];
            case "upsert-inventory-item":
              return ["inventoryItems"];
            case "upsert-beauty-project":
            case "delete-unreferenced-beauty-project":
              return ["projects"];
            case "upsert-customer":
            case "delete-unreferenced-customer":
              return ["customers"];
            case "upsert-pending-appointment":
            case "cancel-pending-appointment":
            case "restore-cancelled-appointment":
              return ["appointments"];
            case "delete-appointment":
              return mutation.expectedStatus === "completed"
                ? ["inventoryMovements", "appointments"]
                : ["appointments"];
            case "complete-pending-appointment":
            case "correct-completed-appointment":
            case "revert-completed-appointment":
              return [
                "inventoryItems",
                "inventoryMovements",
                "appointments",
              ];
          }
        })();
        const mutationPlan =
          (await storage.get<unknown>(SCHEMA_KEY)) === 1
            ? createMutationStoragePlan(
                previous,
                candidate,
                affectedCollections,
              )
            : undefined;
        if (mutationPlan && mutationPlan.previousEntries.length === 0) {
          return;
        }
        await executeSnapshotTransaction(
          previous,
          candidate,
          startedAt,
          () =>
            writeMutationWithoutRollback(
              previous,
              candidate,
              affectedCollections,
              mutationPlan,
            ),
          mutationPlan,
        );
      });
      // 容量查询失败不能把已经提交成功的业务命令伪装成保存失败。
      try {
        publishStorageCapacityChanged(await storage.getCapacityInfo());
      } catch {
        // 下次启动或回到首页仍会重新检查容量。
      }
    },

    recordSuccessfulExport(exportedAt, fileName) {
      return runExclusive(async () => {
        await recoverInternal();
        const current = await readWithoutRecovery();
        const normalized = normalizedData({
          ...current,
          backupMetadata: {
            ...current.backupMetadata,
            lastExportedAt: exportedAt,
            lastExportFileName: fileName,
          },
        });
        // 只写一个独立元数据 key；失败可安全重试，不需要整库回滚事务。
        await storage.set(BACKUP_METADATA_KEY, normalized.backupMetadata);
      });
    },

    recordBackupReminderShown(localDate) {
      return runExclusive(async () => {
        await recoverInternal();
        const current = await readWithoutRecovery();
        const normalized = normalizedData({
          ...current,
          backupMetadata: {
            ...current.backupMetadata,
            lastReminderDate: localDate,
          },
        });
        // 提醒属于可重试元数据，单 key 写入不会触碰业务实体。
        await storage.set(BACKUP_METADATA_KEY, normalized.backupMetadata);
      });
    },

    recoverInterruptedReplace() {
      return runExclusive(recoverInternal);
    },
  };
}
