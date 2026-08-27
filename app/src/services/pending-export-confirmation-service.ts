import type { IsoDateTimeString } from "@/domain/data-schema";
import type { KeyValueStorage } from "@/infrastructure/storage/uni-storage-adapter";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";

const PENDING_EXPORT_CONFIRMATION_KEY = "bm:backup:pending-export-confirmation";
let previousPendingOperation = Promise.resolve();

async function runExclusivePendingOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const waitForPrevious = previousPendingOperation;
  let release: () => void = () => undefined;
  previousPendingOperation = new Promise<void>((resolve) => {
    release = resolve;
  });
  await waitForPrevious;
  try {
    return await operation();
  } finally {
    release();
  }
}

export type PendingExportScopeKind = "system" | "beauty";

/** 仅保存在当前设备、不会写入备份文件的待确认导出状态。 */
export interface PendingExportConfirmation {
  schemaVersion: 1;
  confirmationId: string;
  decision: "awaiting" | "sent";
  createdAt: IsoDateTimeString;
  fileName: string;
  scopeKind: PendingExportScopeKind;
}

export interface MarkPendingExportConfirmationInput {
  createdAt: IsoDateTimeString;
  fileName: string;
  scopeKind: PendingExportScopeKind;
}

export interface PendingExportConfirmationServiceOptions {
  storage: Pick<KeyValueStorage, "get" | "set" | "remove">;
  repository: Pick<ApplicationDataRepository, "recordSuccessfulExport">;
}

export class PendingExportConfirmationConflictError extends Error {
  constructor() {
    super("已有一份导出等待确认，请先处理上次发送结果");
    this.name = "PendingExportConfirmationConflictError";
  }
}

/** 用户已确定“已发送”；后续只能重试完成记录和清理，不能改选“未发送”。 */
export class PendingExportSentDecisionCommittedError extends Error {
  constructor(cause?: unknown) {
    super(cause instanceof Error ? cause.message : "已确认发送，正在完成导出记录");
    this.name = "PendingExportSentDecisionCommittedError";
  }
}

function getConfirmationId(
  input: MarkPendingExportConfirmationInput,
): string {
  return `${input.createdAt}:${input.fileName}`;
}

function isPendingExportConfirmation(
  value: unknown,
): value is PendingExportConfirmation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.confirmationId === "string" &&
    candidate.confirmationId.length > 0 &&
    (candidate.decision === "awaiting" || candidate.decision === "sent") &&
    typeof candidate.createdAt === "string" &&
    Number.isFinite(Date.parse(candidate.createdAt)) &&
    typeof candidate.fileName === "string" &&
    candidate.fileName.trim().length > 0 &&
    (candidate.scopeKind === "system" || candidate.scopeKind === "beauty")
  );
}

interface LegacyPendingExportConfirmation {
  schemaVersion: 1;
  confirmationId?: string;
  createdAt: IsoDateTimeString;
  fileName: string;
  scopeKind: PendingExportScopeKind;
}

function isLegacyPendingExportConfirmation(
  value: unknown,
): value is LegacyPendingExportConfirmation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    (candidate.confirmationId === undefined ||
      typeof candidate.confirmationId === "string") &&
    candidate.decision === undefined &&
    typeof candidate.createdAt === "string" &&
    Number.isFinite(Date.parse(candidate.createdAt)) &&
    typeof candidate.fileName === "string" &&
    candidate.fileName.trim().length > 0 &&
    (candidate.scopeKind === "system" || candidate.scopeKind === "beauty")
  );
}

/**
 * 管理微信转发结果的跨启动确认状态。
 * 该状态属于本机交互流程，不进入 ApplicationData，也不会随备份迁移。
 */
export function createPendingExportConfirmationService(
  options: PendingExportConfirmationServiceOptions,
) {
  const { storage, repository } = options;

  async function readUnlocked(): Promise<PendingExportConfirmation | undefined> {
    const stored = await storage.get<unknown>(PENDING_EXPORT_CONFIRMATION_KEY);
    if (stored === undefined) {
      return undefined;
    }
    if (isLegacyPendingExportConfirmation(stored)) {
      const migrated: PendingExportConfirmation = {
        ...stored,
        confirmationId:
          stored.confirmationId ?? getConfirmationId(stored),
        decision: "awaiting",
      };
      await storage.set(PENDING_EXPORT_CONFIRMATION_KEY, migrated);
      return migrated;
    }
    if (!isPendingExportConfirmation(stored)) {
      // 损坏的流程状态不应阻塞程序启动；业务数据不受影响。
      await storage.remove(PENDING_EXPORT_CONFIRMATION_KEY);
      return undefined;
    }
    return stored;
  }

  function read(): Promise<PendingExportConfirmation | undefined> {
    return runExclusivePendingOperation(readUnlocked);
  }

  async function assertAvailable(): Promise<void> {
    const current = await read();
    if (current) {
      throw new PendingExportConfirmationConflictError();
    }
  }

  async function mark(
    input: MarkPendingExportConfirmationInput,
  ): Promise<void> {
    await runExclusivePendingOperation(async () => {
      const confirmationId = getConfirmationId(input);
      const current = await readUnlocked();
      if (current && current.confirmationId !== confirmationId) {
        throw new PendingExportConfirmationConflictError();
      }
      if (current?.decision === "sent") {
        throw new PendingExportSentDecisionCommittedError();
      }
      await storage.set<PendingExportConfirmation>(
        PENDING_EXPORT_CONFIRMATION_KEY,
        {
          schemaVersion: 1,
          confirmationId,
          decision: "awaiting",
          ...input,
        },
      );
    });
  }

  async function confirmSent(
    pending: MarkPendingExportConfirmationInput,
  ): Promise<void> {
    await runExclusivePendingOperation(async () => {
      let current = await readUnlocked();
      if (current && current.confirmationId !== getConfirmationId(pending)) {
        throw new PendingExportConfirmationConflictError();
      }
      let sentDecisionCommitted = current?.decision === "sent";
      try {
        if (!current) {
          current = {
            schemaVersion: 1,
            confirmationId: getConfirmationId(pending),
            decision: "sent",
            ...pending,
          };
          await storage.set<PendingExportConfirmation>(
            PENDING_EXPORT_CONFIRMATION_KEY,
            current,
          );
          sentDecisionCommitted = true;
        } else if (current.decision === "awaiting") {
          await storage.set<PendingExportConfirmation>(
            PENDING_EXPORT_CONFIRMATION_KEY,
            { ...current, decision: "sent" },
          );
          sentDecisionCommitted = true;
        }
        if (pending.scopeKind === "system") {
          await repository.recordSuccessfulExport(
            pending.createdAt,
            pending.fileName,
          );
        }
        if (current) {
          await storage.remove(PENDING_EXPORT_CONFIRMATION_KEY);
        }
      } catch (error) {
        if (sentDecisionCommitted) {
          throw new PendingExportSentDecisionCommittedError(error);
        }
        throw error;
      }
    });
  }

  async function confirmNotSent(
    pending: MarkPendingExportConfirmationInput,
  ): Promise<void> {
    await runExclusivePendingOperation(async () => {
      const current = await readUnlocked();
      if (!current) {
        return;
      }
      if (current.confirmationId !== getConfirmationId(pending)) {
        throw new PendingExportConfirmationConflictError();
      }
      if (current.decision === "sent") {
        throw new PendingExportSentDecisionCommittedError();
      }
      await storage.remove(PENDING_EXPORT_CONFIRMATION_KEY);
    });
  }

  return { read, assertAvailable, mark, confirmSent, confirmNotSent };
}

export type PendingExportConfirmationService = ReturnType<
  typeof createPendingExportConfirmationService
>;
