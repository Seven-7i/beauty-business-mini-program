import type { StorageAdapter } from "@/infrastructure/storage/uni-storage-adapter";

const PROBE_PREFIX = "bm:stage0:index-probe";
const INTENT_KEY = `${PROBE_PREFIX}:intent`;
const MANIFEST_KEY = `${PROBE_PREFIX}:manifest`;
const SHARD_SIZE = 40;
const MAX_PROBE_SHARD_COUNT = 4;
const ALLOWED_SNAPSHOT_KEYS = new Set([
  MANIFEST_KEY,
  ...Array.from({ length: MAX_PROBE_SHARD_COUNT }, (_, index) => shardKey(index)),
]);

/** 分片索引探测完成后返回给能力检查页的摘要。 */
export interface SegmentedIndexProbeResult {
  itemCount: number;
  shardCount: number;
  recoveredFromInterruptedWrite: boolean;
}

/** 记录索引包含哪些分片，读取时据此校验数量和顺序。 */
interface ProbeIndexManifest {
  kind: "stage0-segmented-index-manifest";
  itemCount: number;
  shardKeys: string[];
}

/** 单个固定大小索引分片。 */
interface ProbeIndexShard {
  kind: "stage0-segmented-index-shard";
  position: number;
  ids: string[];
}

/** 写入前保存单个 key 的旧状态，缺失 key 也必须被显式记录。 */
interface ProbeKeySnapshot {
  key: string;
  existed: boolean;
  value?: unknown;
}

/** 跨 key 写入意图；启动发现它时按快照恢复旧索引。 */
interface ProbeWriteIntent {
  kind: "stage0-segmented-index-intent";
  snapshots: ProbeKeySnapshot[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function combineErrors(
  current: unknown,
  next: unknown,
  operation: string,
): Error {
  if (current === undefined) {
    return next instanceof Error ? next : new Error(String(next));
  }

  return new Error(
    `${errorMessage(current)}；${operation}也失败：${errorMessage(next)}`,
  );
}

function shardKey(position: number): string {
  return `${PROBE_PREFIX}:shard:${position}`;
}

function createIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    `${prefix}-${String(index + 1).padStart(4, "0")}`,
  );
}

function createIndex(ids: readonly string[]): {
  manifest: ProbeIndexManifest;
  shards: ProbeIndexShard[];
} {
  const shards: ProbeIndexShard[] = [];

  for (let offset = 0; offset < ids.length; offset += SHARD_SIZE) {
    shards.push({
      kind: "stage0-segmented-index-shard",
      position: shards.length,
      ids: ids.slice(offset, offset + SHARD_SIZE),
    });
  }

  return {
    manifest: {
      kind: "stage0-segmented-index-manifest",
      itemCount: ids.length,
      shardKeys: shards.map((shard) => shardKey(shard.position)),
    },
    shards,
  };
}

function parseManifest(value: unknown): ProbeIndexManifest {
  const manifest = value as Partial<ProbeIndexManifest> | undefined;

  if (
    manifest?.kind !== "stage0-segmented-index-manifest" ||
    !Number.isInteger(manifest.itemCount) ||
    !Array.isArray(manifest.shardKeys) ||
    !manifest.shardKeys.every((key) => typeof key === "string")
  ) {
    throw new Error("分片索引清单无效");
  }

  return manifest as ProbeIndexManifest;
}

function parseShard(value: unknown, position: number): ProbeIndexShard {
  const shard = value as Partial<ProbeIndexShard> | undefined;

  if (
    shard?.kind !== "stage0-segmented-index-shard" ||
    shard.position !== position ||
    !Array.isArray(shard.ids) ||
    !shard.ids.every((id) => typeof id === "string") ||
    shard.ids.length > SHARD_SIZE
  ) {
    throw new Error(`分片索引第 ${position + 1} 片无效`);
  }

  return shard as ProbeIndexShard;
}

function parseIntent(value: unknown): ProbeWriteIntent {
  const intent = value as Partial<ProbeWriteIntent> | undefined;
  const snapshots = intent?.snapshots;

  if (
    intent?.kind !== "stage0-segmented-index-intent" ||
    !Array.isArray(snapshots) ||
    snapshots.length > ALLOWED_SNAPSHOT_KEYS.size ||
    !snapshots.every(
      (snapshot) =>
        typeof snapshot === "object" &&
        snapshot !== null &&
        typeof (snapshot as ProbeKeySnapshot).key === "string" &&
        ALLOWED_SNAPSHOT_KEYS.has((snapshot as ProbeKeySnapshot).key) &&
        typeof (snapshot as ProbeKeySnapshot).existed === "boolean",
    )
  ) {
    throw new Error("分片索引恢复意图无效");
  }

  const uniqueKeys = new Set(snapshots.map((snapshot) => snapshot.key));
  if (uniqueKeys.size !== snapshots.length) {
    throw new Error("分片索引恢复意图包含重复 key");
  }

  return intent as ProbeWriteIntent;
}

async function removeProbeKeys(storage: StorageAdapter): Promise<void> {
  const info = await storage.getCapacityInfo();
  const probeKeys = info.keys.filter((key) => key.startsWith(PROBE_PREFIX));
  let failure: unknown;

  for (const key of probeKeys) {
    try {
      await storage.remove(key);
    } catch (error) {
      failure = combineErrors(failure, error, `隔离 key ${key} 清理`);
    }
  }

  if (failure !== undefined) {
    throw failure;
  }
}

async function writeIndex(
  storage: StorageAdapter,
  ids: readonly string[],
): Promise<ProbeIndexManifest> {
  const index = createIndex(ids);

  for (const shard of index.shards) {
    await storage.set(shardKey(shard.position), shard);
  }

  await storage.set(MANIFEST_KEY, index.manifest);
  return index.manifest;
}

async function readIndex(storage: StorageAdapter): Promise<string[]> {
  const manifest = parseManifest(await storage.get<unknown>(MANIFEST_KEY));
  const ids: string[] = [];

  for (let position = 0; position < manifest.shardKeys.length; position += 1) {
    const key = manifest.shardKeys[position];
    const shard = parseShard(await storage.get<unknown>(key), position);
    ids.push(...shard.ids);
  }

  if (ids.length !== manifest.itemCount) {
    throw new Error("分片索引数量与清单不一致");
  }

  return ids;
}

async function captureSnapshots(
  storage: StorageAdapter,
  keys: readonly string[],
): Promise<ProbeKeySnapshot[]> {
  const snapshots: ProbeKeySnapshot[] = [];

  for (const key of keys) {
    const value = await storage.get<unknown>(key);
    snapshots.push({ key, existed: value !== undefined, value });
  }

  return snapshots;
}

async function recoverInterruptedWrite(storage: StorageAdapter): Promise<boolean> {
  const rawIntent = await storage.get<unknown>(INTENT_KEY);

  if (rawIntent === undefined) {
    return false;
  }

  const intent = parseIntent(rawIntent);

  for (const snapshot of intent.snapshots) {
    if (snapshot.existed) {
      await storage.set(snapshot.key, snapshot.value);
    } else {
      await storage.remove(snapshot.key);
    }
  }

  await storage.remove(INTENT_KEY);
  return true;
}

/**
 * 真正写入隔离 key，验证固定大小分片、异常检测和事务意图恢复。
 * 探测结束后无论成功失败都会删除 `bm:stage0:index-probe:*`，不接触业务 key。
 */
export async function runSegmentedIndexProbe(
  storage: StorageAdapter,
): Promise<SegmentedIndexProbeResult> {
  const baselineIds = createIds("baseline", 95);
  const candidateIds = createIds("candidate", 121);
  let result: SegmentedIndexProbeResult | undefined;
  let failure: unknown;

  try {
    await recoverInterruptedWrite(storage);
    await removeProbeKeys(storage);

    const baselineManifest = await writeIndex(storage, baselineIds);
    const candidateIndex = createIndex(candidateIds);
    const affectedKeys = [
      MANIFEST_KEY,
      ...new Set([...baselineManifest.shardKeys, ...candidateIndex.manifest.shardKeys]),
    ];
    const intent: ProbeWriteIntent = {
      kind: "stage0-segmented-index-intent",
      snapshots: await captureSnapshots(storage, affectedKeys),
    };

    await storage.set(INTENT_KEY, intent);
    await storage.set(shardKey(0), candidateIndex.shards[0]);
    await storage.set(MANIFEST_KEY, candidateIndex.manifest);

    let interruptedWriteDetected = false;
    try {
      await readIndex(storage);
    } catch {
      interruptedWriteDetected = true;
    }

    if (!interruptedWriteDetected) {
      throw new Error("未识别到分片索引异常写入");
    }

    const recovered = await recoverInterruptedWrite(storage);
    const restoredIds = await readIndex(storage);

    if (!recovered || JSON.stringify(restoredIds) !== JSON.stringify(baselineIds)) {
      throw new Error("异常写入后未恢复原分片索引");
    }

    result = {
      itemCount: restoredIds.length,
      shardCount: baselineManifest.shardKeys.length,
      recoveredFromInterruptedWrite: true,
    };
  } catch (error) {
    failure = error;
  } finally {
    try {
      await recoverInterruptedWrite(storage);
    } catch (error) {
      failure = combineErrors(failure, error, "分片索引恢复");
    }

    try {
      await removeProbeKeys(storage);
    } catch (error) {
      failure = combineErrors(failure, error, "分片索引清理");
    }
  }

  if (failure !== undefined) {
    throw failure;
  }

  if (!result) {
    throw new Error("分片索引检查未生成结果");
  }

  return result;
}
