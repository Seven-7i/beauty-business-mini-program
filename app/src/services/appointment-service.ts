import type {
  AppointmentProjectSnapshotV1,
  AppointmentUsageV1,
  AppointmentV1,
  BeautyProjectV1,
  CustomerV1,
  InventoryItemV1,
  PendingAppointmentV1,
  ServiceAddressSnapshotV1,
} from "@/domain/data-schema";
import {
  calculateAvailableQuantity,
} from "./inventory-service";
import {
  addDecimalQuantities,
  decimalQuantityToHundredths,
  hundredthsToDecimalQuantity,
  parseDecimalQuantity,
} from "@/utils/decimal-quantity";

/** 预约校验的稳定错误分类，供页面定位失败区域或转换提示。 */
export type AppointmentRuleErrorCode =
  | "unavailable-customer"
  | "empty-projects"
  | "duplicate-project"
  | "unavailable-project"
  | "invalid-usage"
  | "unavailable-inventory-item"
  | "insufficient-stock"
  | "invalid-schedule"
  | "empty-address";

/** 预约表单业务错误；code 供后续页面定位顾客、项目、库存或地址区域。 */
export class AppointmentRuleError extends Error {
  constructor(
    readonly code: AppointmentRuleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppointmentRuleError";
  }
}

export interface AppointmentUsageInput {
  /** 本次预约实际使用的库存物品。 */
  inventoryItemId: string;
  /** 用户可覆盖项目默认值的本次数量。 */
  quantityInput: string;
}

export interface PreparePendingAppointmentInput {
  customerId: string;
  /** 至少一个且互不重复；顺序按用户选择保留到快照。 */
  projectIds: readonly string[];
  /** 省略时从项目默认用量合并生成；传入时完全以本次实际用量为准。 */
  actualUsageInputs?: readonly AppointmentUsageInput[];
  scheduledAt: string;
  serviceAddress: {
    addressText: string;
    note?: string;
  };
  note?: string;
  customers: readonly CustomerV1[];
  projects: readonly BeautyProjectV1[];
  inventoryItems: readonly InventoryItemV1[];
  appointments: readonly AppointmentV1[];
  /** 编辑待执行预约时排除自身占用和冲突。 */
  editingAppointmentId?: string;
  /**
   * 编辑时的原预约快照。未改变的历史引用可以继续保留，即使对应对象后来已停用；
   * 新增引用仍必须来自启用对象。
   */
  existingAppointment?: PendingAppointmentV1;
}

/** 已按最新快照校验、可组合进待执行预约实体的业务字段。 */
export type PreparedPendingAppointmentFields = Pick<
  PendingAppointmentV1,
  | "customerId"
  | "projectSnapshots"
  | "standardAmountCents"
  | "estimatedDurationMinutes"
  | "actualUsages"
  | "scheduledAt"
  | "serviceAddressSnapshot"
  | "note"
>;

export interface AppointmentConflict {
  /** 与候选时间重叠的待执行预约标识。 */
  appointmentId: string;
  /** 供页面展示冲突开始时间，不引入新的冲突状态。 */
  scheduledAt: string;
}

function buildProjectSelection(
  projectIds: readonly string[],
  projects: readonly BeautyProjectV1[],
): {
  snapshots: AppointmentProjectSnapshotV1[];
  standardAmountCents: number;
  estimatedDurationMinutes: number;
  defaultUsageInputs: AppointmentUsageInput[];
} {
  if (!projectIds.length) {
    throw new AppointmentRuleError("empty-projects", "预约至少选择一个服务项目");
  }
  if (new Set(projectIds).size !== projectIds.length) {
    throw new AppointmentRuleError(
      "duplicate-project",
      "同一服务项目不能重复选择",
    );
  }
  let standardAmountCents = 0;
  let estimatedDurationMinutes = 0;
  const usageByItemId = new Map<string, string>();
  const snapshots = projectIds.map((projectId) => {
    const project = projects.find(
      (candidate) => candidate.id === projectId && candidate.status === "active",
    );
    if (!project) {
      throw new AppointmentRuleError(
        "unavailable-project",
        "选择的服务项目不存在或已停用",
      );
    }
    standardAmountCents += project.standardPriceCents;
    estimatedDurationMinutes += project.durationMinutes;
    if (
      !Number.isSafeInteger(standardAmountCents) ||
      !Number.isSafeInteger(estimatedDurationMinutes)
    ) {
      throw new Error("预约金额或预计总时长超出可保存范围");
    }
    for (const usage of project.defaultUsages) {
      usageByItemId.set(
        usage.inventoryItemId,
        addDecimalQuantities(
          usageByItemId.get(usage.inventoryItemId) ?? "0",
          usage.quantity,
        ),
      );
    }
    return {
      projectId: project.id,
      name: project.name,
      standardPriceCents: project.standardPriceCents,
      durationMinutes: project.durationMinutes,
    };
  });
  return {
    snapshots,
    standardAmountCents,
    estimatedDurationMinutes,
    defaultUsageInputs: [...usageByItemId].map(
      ([inventoryItemId, quantityInput]) => ({
        inventoryItemId,
        quantityInput,
      }),
    ),
  };
}

function normalizeActualUsages(
  inputs: readonly AppointmentUsageInput[],
  inventoryItems: readonly InventoryItemV1[],
  appointments: readonly AppointmentV1[],
  editingAppointmentId?: string,
  existingAppointment?: PendingAppointmentV1,
): AppointmentUsageV1[] {
  if (new Set(inputs.map((usage) => usage.inventoryItemId)).size !== inputs.length) {
    throw new AppointmentRuleError(
      "invalid-usage",
      "同一库存物品不能在预约实际用量中重复",
    );
  }
  return inputs.map((input) => {
    const item = inventoryItems.find(
      (candidate) => candidate.id === input.inventoryItemId,
    );
    const existingUsage = existingAppointment?.actualUsages.find(
      (usage) => usage.inventoryItemId === input.inventoryItemId,
    );
    if (!item || (item.status !== "active" && !existingUsage)) {
      throw new AppointmentRuleError(
        "unavailable-inventory-item",
        "实际用量引用的库存物品不存在或已停用",
      );
    }
    const quantity = parseDecimalQuantity(input.quantityInput, {
      unitKind: item.unitKind,
      positive: true,
    });
    const available = calculateAvailableQuantity(
      item,
      appointments,
      editingAppointmentId,
    );
    if (
      decimalQuantityToHundredths(quantity) >
      decimalQuantityToHundredths(available)
    ) {
      const shortage =
        decimalQuantityToHundredths(quantity) -
        decimalQuantityToHundredths(available);
      throw new AppointmentRuleError(
        "insufficient-stock",
        `${item.name}库存不足，缺少 ${hundredthsToDecimalQuantity(shortage)}${item.unit}`,
      );
    }
    return {
      inventoryItemId: item.id,
      // 原预约的物品快照属于历史事实；仅新增物品使用当前资料生成快照。
      itemNameSnapshot: existingUsage?.itemNameSnapshot ?? item.name,
      unitSnapshot: existingUsage?.unitSnapshot ?? item.unit,
      quantity,
    };
  });
}

/** 计算候选预约与其他待执行预约的时间重叠；冲突只警告，不在此阻止保存。 */
export function findAppointmentConflicts(
  scheduledAt: string,
  estimatedDurationMinutes: number,
  appointments: readonly AppointmentV1[],
  editingAppointmentId?: string,
): AppointmentConflict[] {
  const start = new Date(scheduledAt).getTime();
  const end = start + estimatedDurationMinutes * 60_000;
  return appointments
    .filter((appointment) => {
      if (
        appointment.status !== "pending" ||
        appointment.id === editingAppointmentId
      ) {
        return false;
      }
      const otherStart = new Date(appointment.scheduledAt).getTime();
      const otherEnd =
        otherStart + appointment.estimatedDurationMinutes * 60_000;
      return start < otherEnd && end > otherStart;
    })
    .map((appointment) => ({
      appointmentId: appointment.id,
      scheduledAt: appointment.scheduledAt,
    }));
}

/**
 * 生成待执行预约的全部业务字段；项目变化时重新调用即可丢弃旧用量并按默认值生成。
 */
export function preparePendingAppointment(
  input: PreparePendingAppointmentInput,
): PreparedPendingAppointmentFields {
  const customer = input.customers.find(
    (candidate) => candidate.id === input.customerId,
  );
  const retainsExistingCustomer =
    input.existingAppointment?.customerId === input.customerId;
  if (!customer || (customer.status !== "active" && !retainsExistingCustomer)) {
    throw new AppointmentRuleError(
      "unavailable-customer",
      "选择的顾客不存在或已停用",
    );
  }
  const keepsExistingProjectCombination =
    input.existingAppointment !== undefined &&
    input.projectIds.length === input.existingAppointment.projectSnapshots.length &&
    input.projectIds.every(
      (projectId, index) =>
        projectId === input.existingAppointment?.projectSnapshots[index]?.projectId,
    );
  const selection = keepsExistingProjectCombination
    ? {
        snapshots: input.existingAppointment!.projectSnapshots.map((snapshot) => ({
          ...snapshot,
        })),
        standardAmountCents: input.existingAppointment!.standardAmountCents,
        estimatedDurationMinutes:
          input.existingAppointment!.estimatedDurationMinutes,
        defaultUsageInputs: input.existingAppointment!.actualUsages.map((usage) => ({
          inventoryItemId: usage.inventoryItemId,
          quantityInput: usage.quantity,
        })),
      }
    : buildProjectSelection(input.projectIds, input.projects);
  if (
    !Number.isFinite(new Date(input.scheduledAt).getTime()) ||
    !input.scheduledAt.trim()
  ) {
    throw new AppointmentRuleError("invalid-schedule", "请填写有效的预约开始时间");
  }
  const addressText = input.serviceAddress.addressText.trim();
  if (!addressText) {
    throw new AppointmentRuleError("empty-address", "请填写预约服务地址");
  }
  const addressNote = input.serviceAddress.note?.trim();
  const serviceAddressSnapshot: ServiceAddressSnapshotV1 = {
    addressText,
    ...(addressNote ? { note: addressNote } : {}),
  };
  const actualUsages = normalizeActualUsages(
    input.actualUsageInputs ?? selection.defaultUsageInputs,
    input.inventoryItems,
    input.appointments,
    input.editingAppointmentId,
    input.existingAppointment,
  );
  const note = input.note?.trim();
  return {
    customerId: input.customerId,
    projectSnapshots: selection.snapshots,
    standardAmountCents: selection.standardAmountCents,
    estimatedDurationMinutes: selection.estimatedDurationMinutes,
    actualUsages,
    scheduledAt: new Date(input.scheduledAt).toISOString(),
    serviceAddressSnapshot,
    ...(note ? { note } : {}),
  };
}
