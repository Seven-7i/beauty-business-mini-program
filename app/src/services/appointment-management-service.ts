import type {
  AppointmentUsageV1,
  CancelledAppointmentV1,
  CompletedAppointmentV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";
import {
  findAppointmentConflicts,
  preparePendingAppointment,
  type AppointmentConflict,
  type AppointmentUsageInput,
} from "./appointment-service";
import { parseDecimalQuantity } from "@/utils/decimal-quantity";

/** 预约用例依赖的窄仓储接口，状态写入统一通过封闭命令。 */
export type AppointmentManagementRepository = Pick<
  ApplicationDataRepository,
  "readSnapshot" | "applyBusinessMutation"
>;

/** 预约管理用例的基础设施依赖；可注入时钟和标识生成器做稳定测试。 */
export interface AppointmentManagementServiceOptions {
  /** 提供完整快照读取和封闭业务命令提交。 */
  repository: AppointmentManagementRepository;
  /** 注入业务时钟，确保创建和更新时间可稳定测试。 */
  now?: () => Date;
  /** 注入预约标识生成器，便于重试和稳定测试。 */
  createId?: () => string;
  /** 注入预约消耗标识生成器，保证多物品完成事务可稳定测试。 */
  createMovementId?: () => string;
}

export interface SavePendingAppointmentInput {
  /** 省略表示新增；传入时只能编辑待执行预约。 */
  appointmentId?: string;
  /** 必须引用一位启用顾客。 */
  customerId: string;
  /** 至少一个且互不重复的启用服务项目。 */
  projectIds: readonly string[];
  /** 省略时按所选项目重新生成默认用量。 */
  actualUsageInputs?: readonly AppointmentUsageInput[];
  /** 计划开始时间，保存为 ISO 8601。 */
  scheduledAt: string;
  /** 本次服务地址快照，不随顾客地址后续修改。 */
  serviceAddress: { addressText: string; note?: string };
  /** 本次预约的可选多行备注。 */
  note?: string;
  /** 有时间冲突时必须由页面明确确认后再次提交。 */
  confirmTimeConflict?: boolean;
}

export interface CancelAppointmentInput {
  /** 必须仍处于待执行状态的预约标识。 */
  appointmentId: string;
  /** 选填取消原因；空白原因不会写入数据。 */
  cancelReason?: string;
}

export interface CompleteAppointmentInput {
  /** 必须仍处于待执行状态的预约标识。 */
  appointmentId: string;
  /** 以人民币元填写、最多两位小数的实际成交金额。 */
  transactionAmountInput: string;
  /** 实际完成时间；经营统计按此时间归属。 */
  completedAt: string;
  /** 完成前最终确认的实际库存用量。 */
  actualUsageInputs: readonly AppointmentUsageInput[];
  /** 完成时可同步修正预约备注。 */
  note?: string;
}

/** 时间冲突不属于保存失败，页面应展示冲突并允许用户确认继续。 */
export class AppointmentTimeConflictError extends Error {
  constructor(readonly conflicts: readonly AppointmentConflict[]) {
    super("预约时间与其他待执行预约重叠，请确认是否继续保存");
    this.name = "AppointmentTimeConflictError";
  }
}

function defaultCreateId(): string {
  return `appointment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultCreateMovementId(): string {
  return `appointment-consumption-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseTransactionAmountCents(input: string): number {
  const value = input.trim();
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) {
    throw new Error("成交金额必须为大于等于零、最多两位小数的金额");
  }
  const [yuan, fraction = ""] = value.split(".");
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) {
    throw new Error("成交金额超出可保存范围");
  }
  return cents;
}

/** 提供待执行预约的读取、新增和编辑用例，库存占用由预约数据派生。 */
export function createAppointmentManagementService(
  options: AppointmentManagementServiceOptions,
) {
  const {
    repository,
    now = () => new Date(),
    createId = defaultCreateId,
    createMovementId = defaultCreateMovementId,
  } = options;

  async function readData() {
    return repository.readSnapshot();
  }

  async function savePendingAppointment(
    input: SavePendingAppointmentInput,
  ): Promise<PendingAppointmentV1> {
    const data = await readData();
    const current = input.appointmentId
      ? data.appointments.find(
          (appointment) => appointment.id === input.appointmentId,
        )
      : undefined;
    if (current && current.status !== "pending") {
      throw new Error("只有待执行预约可以直接编辑");
    }
    if (input.appointmentId && !current) {
      throw new Error("预约不存在");
    }
    const fields = preparePendingAppointment({
      ...input,
      customers: data.customers,
      projects: data.projects,
      inventoryItems: data.inventoryItems,
      appointments: data.appointments,
      editingAppointmentId: current?.id,
      existingAppointment: current,
    });
    const conflicts = findAppointmentConflicts(
      fields.scheduledAt,
      fields.estimatedDurationMinutes,
      data.appointments,
      current?.id,
    );
    if (conflicts.length && !input.confirmTimeConflict) {
      throw new AppointmentTimeConflictError(conflicts);
    }
    const occurredAt = now().toISOString();
    const appointmentId = current?.id ?? createId();
    if (
      !current &&
      data.appointments.some(
        (appointment) => appointment.id === appointmentId,
      )
    ) {
      throw new Error("预约标识冲突，请重试");
    }
    const appointment: PendingAppointmentV1 = {
      id: appointmentId,
      ...fields,
      status: "pending",
      createdAt: current?.createdAt ?? occurredAt,
      updatedAt: occurredAt,
      schemaVersion: 1,
    };
    const customer = data.customers.find(
      (candidate) => candidate.id === appointment.customerId,
    )!;
    const projectIds = new Set(
      appointment.projectSnapshots.map(({ projectId }) => projectId),
    );
    const inventoryItemIds = new Set(
      appointment.actualUsages.map(({ inventoryItemId }) => inventoryItemId),
    );
    await repository.applyBusinessMutation({
      kind: "upsert-pending-appointment",
      appointment,
      expectedUpdatedAt: current?.updatedAt,
      expectedReferences: {
        customerUpdatedAt: customer.updatedAt,
        projects: data.projects
          .filter((project) => projectIds.has(project.id))
          .map(({ id, updatedAt }) => ({ id, updatedAt })),
        inventoryItems: data.inventoryItems
          .filter((item) => inventoryItemIds.has(item.id))
          .map(({ id, updatedAt }) => ({ id, updatedAt })),
      },
    });
    const persisted = (await readData()).appointments.find(
      (candidate) => candidate.id === appointment.id,
    );
    if (!persisted || persisted.status !== "pending") {
      throw new Error("预约保存后读回校验失败");
    }
    return persisted;
  }

  async function cancelAppointment(
    input: CancelAppointmentInput,
  ): Promise<CancelledAppointmentV1> {
    const data = await readData();
    const current = data.appointments.find(
      (appointment) => appointment.id === input.appointmentId,
    );
    if (!current || current.status !== "pending") {
      throw new Error("只有待执行预约可以取消");
    }
    const occurredAt = now().toISOString();
    await repository.applyBusinessMutation({
      kind: "cancel-pending-appointment",
      appointmentId: current.id,
      expectedUpdatedAt: current.updatedAt,
      cancelledAt: occurredAt,
      cancelReason: input.cancelReason,
      updatedAt: occurredAt,
    });
    const persisted = (await readData()).appointments.find(
      (appointment) => appointment.id === current.id,
    );
    if (!persisted || persisted.status !== "cancelled") {
      throw new Error("预约取消后读回校验失败");
    }
    return persisted;
  }

  async function restoreCancelledAppointment(
    appointmentId: string,
  ): Promise<PendingAppointmentV1> {
    const data = await readData();
    const current = data.appointments.find(
      (appointment) => appointment.id === appointmentId,
    );
    if (!current || current.status !== "cancelled") {
      throw new Error("只有已取消预约可以恢复取消");
    }
    const occurredAt = now().toISOString();
    await repository.applyBusinessMutation({
      kind: "restore-cancelled-appointment",
      appointmentId: current.id,
      expectedUpdatedAt: current.updatedAt,
      updatedAt: occurredAt,
    });
    const persisted = (await readData()).appointments.find(
      (appointment) => appointment.id === current.id,
    );
    if (!persisted || persisted.status !== "pending") {
      throw new Error("恢复取消后读回校验失败");
    }
    return persisted;
  }

  async function completeAppointment(
    input: CompleteAppointmentInput,
  ): Promise<CompletedAppointmentV1> {
    const data = await readData();
    const current = data.appointments.find(
      (appointment) => appointment.id === input.appointmentId,
    );
    if (!current || current.status !== "pending") {
      throw new Error("只有待执行预约可以完成");
    }
    if (
      new Set(input.actualUsageInputs.map((usage) => usage.inventoryItemId))
        .size !== input.actualUsageInputs.length
    ) {
      throw new Error("同一库存物品不能在预约实际用量中重复");
    }
    const actualUsages: AppointmentUsageV1[] = input.actualUsageInputs.map(
      (usageInput) => {
        const item = data.inventoryItems.find(
          (candidate) => candidate.id === usageInput.inventoryItemId,
        );
        const existingUsage = current.actualUsages.find(
          (usage) => usage.inventoryItemId === usageInput.inventoryItemId,
        );
        if (!item || (!existingUsage && item.status !== "active")) {
          throw new Error("完成用量引用的库存物品不存在或已停用");
        }
        return {
          inventoryItemId: item.id,
          itemNameSnapshot: existingUsage?.itemNameSnapshot ?? item.name,
          unitSnapshot: existingUsage?.unitSnapshot ?? item.unit,
          quantity: parseDecimalQuantity(usageInput.quantityInput, {
            unitKind: item.unitKind,
            positive: true,
          }),
        };
      },
    );
    const completedAt = new Date(input.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      throw new Error("请选择有效的实际完成时间");
    }
    const occurredAt = now().toISOString();
    await repository.applyBusinessMutation({
      kind: "complete-pending-appointment",
      appointmentId: current.id,
      expectedUpdatedAt: current.updatedAt,
      actualUsages,
      transactionAmountCents: parseTransactionAmountCents(
        input.transactionAmountInput,
      ),
      completedAt: completedAt.toISOString(),
      note: input.note,
      updatedAt: occurredAt,
      movementIds: actualUsages.map((usage) => ({
        inventoryItemId: usage.inventoryItemId,
        movementId: createMovementId(),
      })),
    });
    const persisted = (await readData()).appointments.find(
      (appointment) => appointment.id === current.id,
    );
    if (!persisted || persisted.status !== "completed") {
      throw new Error("预约完成后读回校验失败");
    }
    return persisted;
  }

  async function correctCompletedAppointment(
    input: CompleteAppointmentInput,
  ): Promise<CompletedAppointmentV1> {
    const data = await readData();
    const current = data.appointments.find(
      (appointment) => appointment.id === input.appointmentId,
    );
    if (!current || current.status !== "completed") {
      throw new Error("只有已完成预约可以更正完成信息");
    }
    if (
      new Set(input.actualUsageInputs.map((usage) => usage.inventoryItemId))
        .size !== input.actualUsageInputs.length
    ) {
      throw new Error("同一库存物品不能在预约实际用量中重复");
    }
    const actualUsages: AppointmentUsageV1[] = input.actualUsageInputs.map(
      (usageInput) => {
        const item = data.inventoryItems.find(
          (candidate) => candidate.id === usageInput.inventoryItemId,
        );
        const previousUsage = current.actualUsages.find(
          (usage) => usage.inventoryItemId === usageInput.inventoryItemId,
        );
        if (!item || (!previousUsage && item.status !== "active")) {
          throw new Error("更正用量引用的库存物品不存在或已停用");
        }
        return {
          inventoryItemId: item.id,
          itemNameSnapshot: previousUsage?.itemNameSnapshot ?? item.name,
          unitSnapshot: previousUsage?.unitSnapshot ?? item.unit,
          quantity: parseDecimalQuantity(usageInput.quantityInput, {
            unitKind: item.unitKind,
            positive: true,
          }),
        };
      },
    );
    const completedAt = new Date(input.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      throw new Error("请选择有效的实际完成时间");
    }
    const previousMovementByItemId = new Map(
      data.inventoryMovements
        .filter(
          (movement) =>
            movement.type === "appointment-consumption" &&
            !movement.appointmentDeleted &&
            movement.appointmentId === current.id,
        )
        .map((movement) => [movement.inventoryItemId, movement.id]),
    );
    const occurredAt = now().toISOString();
    await repository.applyBusinessMutation({
      kind: "correct-completed-appointment",
      appointmentId: current.id,
      expectedUpdatedAt: current.updatedAt,
      actualUsages,
      transactionAmountCents: parseTransactionAmountCents(
        input.transactionAmountInput,
      ),
      completedAt: completedAt.toISOString(),
      note: input.note,
      updatedAt: occurredAt,
      movementIds: actualUsages.map((usage) => ({
        inventoryItemId: usage.inventoryItemId,
        movementId:
          previousMovementByItemId.get(usage.inventoryItemId) ??
          createMovementId(),
      })),
    });
    const persisted = (await readData()).appointments.find(
      (appointment) => appointment.id === current.id,
    );
    if (!persisted || persisted.status !== "completed") {
      throw new Error("完成信息更正后读回校验失败");
    }
    return persisted;
  }

  async function revertCompletedAppointment(
    appointmentId: string,
  ): Promise<PendingAppointmentV1> {
    const data = await readData();
    const current = data.appointments.find(
      (appointment) => appointment.id === appointmentId,
    );
    if (!current || current.status !== "completed") {
      throw new Error("只有已完成预约可以撤销完成");
    }
    const occurredAt = now().toISOString();
    await repository.applyBusinessMutation({
      kind: "revert-completed-appointment",
      appointmentId: current.id,
      expectedUpdatedAt: current.updatedAt,
      updatedAt: occurredAt,
    });
    const persisted = (await readData()).appointments.find(
      (appointment) => appointment.id === current.id,
    );
    if (!persisted || persisted.status !== "pending") {
      throw new Error("撤销完成后读回校验失败");
    }
    return persisted;
  }

  async function deleteAppointment(appointmentId: string): Promise<void> {
    const data = await readData();
    const current = data.appointments.find(
      (appointment) => appointment.id === appointmentId,
    );
    if (!current) {
      throw new Error("预约不存在");
    }
    await repository.applyBusinessMutation({
      kind: "delete-appointment",
      appointmentId: current.id,
      expectedStatus: current.status,
      expectedUpdatedAt: current.updatedAt,
      updatedAt: now().toISOString(),
    });
    if (
      (await readData()).appointments.some(
        (appointment) => appointment.id === current.id,
      )
    ) {
      throw new Error("预约删除后读回校验失败");
    }
  }

  return {
    readData,
    savePendingAppointment,
    cancelAppointment,
    restoreCancelledAppointment,
    completeAppointment,
    correctCompletedAppointment,
    revertCompletedAppointment,
    deleteAppointment,
  };
}

/** 预约页面可调用的窄用例接口，不暴露仓储内部能力。 */
export type AppointmentManagementService = ReturnType<
  typeof createAppointmentManagementService
>;
