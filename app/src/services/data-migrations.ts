import {
  CURRENT_DATA_SCHEMA_VERSION,
  type ApplicationData,
  type ApplicationSettingsV1,
  type AppointmentProjectSnapshotV1,
  type AppointmentUsageV1,
  type AppointmentV1,
  type BackupMetadataV1,
  type BeautyProjectV1,
  type BusinessRecordStatus,
  type CustomerAddressV1,
  type CustomerV1,
  type DecimalQuantity,
  type InventoryItemV1,
  type InventoryMovementType,
  type InventoryMovementV1,
  type InventoryUnitKind,
  type IsoDateTimeString,
  type ProjectDefaultUsageV1,
  type ServiceAddressSnapshotV1,
} from "@/domain/data-schema";
import {
  isBusinessModuleId,
  type BusinessModuleId,
} from "@/domain/business-module";
import { isIsoDateTimeString } from "@/utils/iso-date-time";

/** migration 失败的稳定错误类别，供恢复预检转换为用户可读提示。 */
export type DataMigrationErrorCode =
  | "invalid-data"
  | "unsupported-version"
  | "future-version";

/**
 * 数据无法安全迁移时抛出的错误。
 * `path` 指向首个无效字段；调用方不得在捕获该错误后继续写入本地数据。
 */
export class DataMigrationError extends Error {
  readonly code: DataMigrationErrorCode;
  readonly path: string;

  constructor(code: DataMigrationErrorCode, path: string, message: string) {
    super(message);
    this.name = "DataMigrationError";
    this.code = code;
    this.path = path;
  }
}

type UnknownRecord = Record<string, unknown>;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NON_NEGATIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const SIGNED_DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const MAINLAND_PHONE_PATTERN = /^1[3-9]\d{9}$/;

function invalid(path: string, detail: string): never {
  throw new DataMigrationError(
    "invalid-data",
    path,
    `数据字段 ${path} ${detail}`,
  );
}

function parseRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalid(path, "必须是对象");
  }

  return value as UnknownRecord;
}

function parseArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    return invalid(path, "必须是数组");
  }

  return value;
}

function parseString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    return invalid(path, "必须是字符串");
  }

  return value;
}

function parseNonEmptyString(value: unknown, path: string): string {
  const parsed = parseString(value, path);

  if (parsed.trim().length === 0) {
    return invalid(path, "不能为空");
  }

  return parsed;
}

function parseOptionalString(
  value: unknown,
  path: string,
): string | undefined {
  return value === undefined ? undefined : parseString(value, path);
}

function parseBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    return invalid(path, "必须是布尔值");
  }

  return value;
}

function parseInteger(
  value: unknown,
  path: string,
  minimum: number,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    return invalid(path, `必须是不小于 ${minimum} 的安全整数`);
  }

  return value as number;
}

function parseLiteralOne(value: unknown, path: string): 1 {
  if (value !== 1) {
    return invalid(path, "必须为 1");
  }

  return 1;
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return invalid(path, `必须是 ${allowed.join("、")} 之一`);
  }

  return value as T;
}

function parseIsoDateTime(value: unknown, path: string): IsoDateTimeString {
  if (!isIsoDateTimeString(value)) {
    return invalid(path, "必须是有效的 ISO 8601 日期时间");
  }
  return value;
}

function parseLocalDate(value: unknown, path: string): string {
  const parsed = parseString(value, path);

  if (!LOCAL_DATE_PATTERN.test(parsed)) {
    return invalid(path, "必须是 YYYY-MM-DD 格式的日期");
  }

  const [year, month, day] = parsed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return invalid(path, "必须是有效日期");
  }

  return parsed;
}

function parseQuantity(
  value: unknown,
  path: string,
  options: { signed?: boolean; positive?: boolean; discrete?: boolean } = {},
): DecimalQuantity {
  const parsed = parseString(value, path);
  const pattern = options.signed
    ? SIGNED_DECIMAL_PATTERN
    : NON_NEGATIVE_DECIMAL_PATTERN;

  if (!pattern.test(parsed)) {
    return invalid(path, "必须是最多两位小数的十进制数量字符串");
  }

  const hundredths = quantityToHundredths(parsed);
  if (!Number.isSafeInteger(hundredths)) {
    return invalid(path, "超出可安全计算的数量范围");
  }

  if (options.positive && hundredths <= 0) {
    return invalid(path, "必须大于零");
  }

  if (options.discrete && parsed.includes(".")) {
    return invalid(path, "使用离散单位时必须为整数");
  }

  return parsed;
}

function quantityToHundredths(quantity: DecimalQuantity): number {
  const negative = quantity.startsWith("-");
  const unsigned = negative ? quantity.slice(1) : quantity;
  const [integerPart, decimalPart = ""] = unsigned.split(".");
  const value = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, "0"));
  return negative ? -value : value;
}

function parseOptionalIsoDateTime(
  value: unknown,
  path: string,
): IsoDateTimeString | undefined {
  return value === undefined ? undefined : parseIsoDateTime(value, path);
}

function ensureUnique(
  values: readonly string[],
  path: string,
  description: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      invalid(path, `存在重复的${description}：${value}`);
    }
    seen.add(value);
  }
}

function ensureAbsent(record: UnknownRecord, fields: string[], path: string): void {
  for (const field of fields) {
    if (record[field] !== undefined) {
      invalid(`${path}.${field}`, "不适用于当前预约状态");
    }
  }
}

/** 拒绝同版本中无法识别的字段，防止恢复时静默丢弃数据。 */
function ensureOnlyFields(
  record: UnknownRecord,
  allowedFields: readonly string[],
  path: string,
): void {
  const allowed = new Set(allowedFields);
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      invalid(`${path}.${field}`, "不是当前数据版本支持的字段");
    }
  }
}

function parseSettings(value: unknown, path: string): ApplicationSettingsV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(record, ["schemaVersion", "defaultModuleId"], path);
  const defaultModuleId = record.defaultModuleId;

  if (defaultModuleId !== undefined && !isBusinessModuleId(defaultModuleId)) {
    invalid(`${path}.defaultModuleId`, "不是可识别的业务模块");
  }

  return {
    schemaVersion: parseLiteralOne(
      record.schemaVersion,
      `${path}.schemaVersion`,
    ),
    ...(defaultModuleId === undefined ? {} : { defaultModuleId }),
  };
}

function parseBackupMetadata(value: unknown, path: string): BackupMetadataV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(
    record,
    [
      "schemaVersion",
      "firstBusinessDataAt",
      "lastExportedAt",
      "lastExportFileName",
      "lastReminderDate",
    ],
    path,
  );
  const firstBusinessDataAt = parseOptionalIsoDateTime(
    record.firstBusinessDataAt,
    `${path}.firstBusinessDataAt`,
  );
  const lastExportedAt = parseOptionalIsoDateTime(
    record.lastExportedAt,
    `${path}.lastExportedAt`,
  );
  const lastExportFileName = parseOptionalString(
    record.lastExportFileName,
    `${path}.lastExportFileName`,
  );
  const lastReminderDate =
    record.lastReminderDate === undefined
      ? undefined
      : parseLocalDate(record.lastReminderDate, `${path}.lastReminderDate`);

  if ((lastExportedAt === undefined) !== (lastExportFileName === undefined)) {
    invalid(path, "最近导出时间与文件名必须同时存在或同时省略");
  }

  return {
    schemaVersion: parseLiteralOne(
      record.schemaVersion,
      `${path}.schemaVersion`,
    ),
    ...(firstBusinessDataAt === undefined ? {} : { firstBusinessDataAt }),
    ...(lastExportedAt === undefined ? {} : { lastExportedAt }),
    ...(lastExportFileName === undefined ? {} : { lastExportFileName }),
    ...(lastReminderDate === undefined ? {} : { lastReminderDate }),
  };
}

function parseInventoryItem(value: unknown, path: string): InventoryItemV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(
    record,
    [
      "id",
      "name",
      "unit",
      "unitKind",
      "currentQuantity",
      "note",
      "status",
      "createdAt",
      "updatedAt",
      "schemaVersion",
    ],
    path,
  );
  const unitKind = parseEnum<InventoryUnitKind>(
    record.unitKind,
    ["discrete", "continuous"],
    `${path}.unitKind`,
  );
  const note = parseOptionalString(record.note, `${path}.note`);

  return {
    id: parseNonEmptyString(record.id, `${path}.id`),
    name: parseNonEmptyString(record.name, `${path}.name`),
    unit: parseNonEmptyString(record.unit, `${path}.unit`),
    unitKind,
    currentQuantity: parseQuantity(
      record.currentQuantity,
      `${path}.currentQuantity`,
      { discrete: unitKind === "discrete" },
    ),
    ...(note === undefined ? {} : { note }),
    status: parseEnum<BusinessRecordStatus>(
      record.status,
      ["active", "inactive"],
      `${path}.status`,
    ),
    createdAt: parseIsoDateTime(record.createdAt, `${path}.createdAt`),
    updatedAt: parseIsoDateTime(record.updatedAt, `${path}.updatedAt`),
    schemaVersion: parseLiteralOne(
      record.schemaVersion,
      `${path}.schemaVersion`,
    ),
  };
}

function parseInventoryMovement(
  value: unknown,
  path: string,
): InventoryMovementV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(
    record,
    [
      "id",
      "inventoryItemId",
      "type",
      "beforeQuantity",
      "deltaQuantity",
      "afterQuantity",
      "note",
      "occurredAt",
      "appointmentId",
      "appointmentDeleted",
      "createdAt",
      "updatedAt",
      "schemaVersion",
    ],
    path,
  );
  const beforeQuantity = parseQuantity(
    record.beforeQuantity,
    `${path}.beforeQuantity`,
  );
  const deltaQuantity = parseQuantity(
    record.deltaQuantity,
    `${path}.deltaQuantity`,
    { signed: true },
  );
  const afterQuantity = parseQuantity(
    record.afterQuantity,
    `${path}.afterQuantity`,
  );
  const appointmentId =
    record.appointmentId === undefined
      ? undefined
      : parseNonEmptyString(record.appointmentId, `${path}.appointmentId`);
  const note = parseOptionalString(record.note, `${path}.note`);
  const type = parseEnum<InventoryMovementType>(
    record.type,
    ["initial", "restock", "stocktake", "appointment-consumption"],
    `${path}.type`,
  );

  if (
    quantityToHundredths(beforeQuantity) +
      quantityToHundredths(deltaQuantity) !==
    quantityToHundredths(afterQuantity)
  ) {
    invalid(path, "变动前数量与差额之和必须等于变动后数量");
  }
  if (type === "appointment-consumption" && appointmentId === undefined) {
    invalid(`${path}.appointmentId`, "预约消耗记录必须包含来源预约标识");
  }
  if (type !== "appointment-consumption" && appointmentId !== undefined) {
    invalid(`${path}.appointmentId`, "仅预约消耗记录可以包含来源预约标识");
  }

  return {
    id: parseNonEmptyString(record.id, `${path}.id`),
    inventoryItemId: parseNonEmptyString(
      record.inventoryItemId,
      `${path}.inventoryItemId`,
    ),
    type,
    beforeQuantity,
    deltaQuantity,
    afterQuantity,
    ...(note === undefined ? {} : { note }),
    occurredAt: parseIsoDateTime(record.occurredAt, `${path}.occurredAt`),
    ...(appointmentId === undefined ? {} : { appointmentId }),
    appointmentDeleted: parseBoolean(
      record.appointmentDeleted,
      `${path}.appointmentDeleted`,
    ),
    createdAt: parseIsoDateTime(record.createdAt, `${path}.createdAt`),
    updatedAt: parseIsoDateTime(record.updatedAt, `${path}.updatedAt`),
    schemaVersion: parseLiteralOne(
      record.schemaVersion,
      `${path}.schemaVersion`,
    ),
  };
}

function parseProjectUsage(
  value: unknown,
  path: string,
): ProjectDefaultUsageV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(record, ["inventoryItemId", "quantity"], path);
  return {
    inventoryItemId: parseNonEmptyString(
      record.inventoryItemId,
      `${path}.inventoryItemId`,
    ),
    quantity: parseQuantity(record.quantity, `${path}.quantity`, {
      positive: true,
    }),
  };
}

function parseProject(value: unknown, path: string): BeautyProjectV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(
    record,
    [
      "id",
      "name",
      "standardPriceCents",
      "durationMinutes",
      "defaultUsages",
      "status",
      "createdAt",
      "updatedAt",
      "schemaVersion",
    ],
    path,
  );
  const defaultUsages = parseArray(
    record.defaultUsages,
    `${path}.defaultUsages`,
  ).map((usage, index) =>
    parseProjectUsage(usage, `${path}.defaultUsages[${index}]`),
  );
  ensureUnique(
    defaultUsages.map((usage) => usage.inventoryItemId),
    `${path}.defaultUsages`,
    "库存物品",
  );

  return {
    id: parseNonEmptyString(record.id, `${path}.id`),
    name: parseNonEmptyString(record.name, `${path}.name`),
    standardPriceCents: parseInteger(
      record.standardPriceCents,
      `${path}.standardPriceCents`,
      0,
    ),
    durationMinutes: parseInteger(
      record.durationMinutes,
      `${path}.durationMinutes`,
      1,
    ),
    defaultUsages,
    status: parseEnum<BusinessRecordStatus>(
      record.status,
      ["active", "inactive"],
      `${path}.status`,
    ),
    createdAt: parseIsoDateTime(record.createdAt, `${path}.createdAt`),
    updatedAt: parseIsoDateTime(record.updatedAt, `${path}.updatedAt`),
    schemaVersion: parseLiteralOne(
      record.schemaVersion,
      `${path}.schemaVersion`,
    ),
  };
}

function parseCustomerAddress(
  value: unknown,
  path: string,
): CustomerAddressV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(record, ["id", "addressText", "note"], path);
  const note = parseOptionalString(record.note, `${path}.note`);
  return {
    id: parseNonEmptyString(record.id, `${path}.id`),
    addressText: parseNonEmptyString(
      record.addressText,
      `${path}.addressText`,
    ),
    ...(note === undefined ? {} : { note }),
  };
}

function parseCustomer(value: unknown, path: string): CustomerV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(
    record,
    [
      "id",
      "nickname",
      "phone",
      "addresses",
      "status",
      "createdAt",
      "updatedAt",
      "schemaVersion",
    ],
    path,
  );
  const addresses = parseArray(record.addresses, `${path}.addresses`).map(
    (address, index) =>
      parseCustomerAddress(address, `${path}.addresses[${index}]`),
  );
  ensureUnique(
    addresses.map((address) => address.id),
    `${path}.addresses`,
    "地址标识",
  );
  const phone = parseString(record.phone, `${path}.phone`);
  if (!MAINLAND_PHONE_PATTERN.test(phone)) {
    invalid(`${path}.phone`, "必须是有效的中国大陆 11 位手机号");
  }

  return {
    id: parseNonEmptyString(record.id, `${path}.id`),
    nickname: parseNonEmptyString(record.nickname, `${path}.nickname`),
    phone,
    addresses,
    status: parseEnum<BusinessRecordStatus>(
      record.status,
      ["active", "inactive"],
      `${path}.status`,
    ),
    createdAt: parseIsoDateTime(record.createdAt, `${path}.createdAt`),
    updatedAt: parseIsoDateTime(record.updatedAt, `${path}.updatedAt`),
    schemaVersion: parseLiteralOne(
      record.schemaVersion,
      `${path}.schemaVersion`,
    ),
  };
}

function parseProjectSnapshot(
  value: unknown,
  path: string,
): AppointmentProjectSnapshotV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(
    record,
    ["projectId", "name", "standardPriceCents", "durationMinutes"],
    path,
  );
  return {
    projectId: parseNonEmptyString(record.projectId, `${path}.projectId`),
    name: parseNonEmptyString(record.name, `${path}.name`),
    standardPriceCents: parseInteger(
      record.standardPriceCents,
      `${path}.standardPriceCents`,
      0,
    ),
    durationMinutes: parseInteger(
      record.durationMinutes,
      `${path}.durationMinutes`,
      1,
    ),
  };
}

function parseAppointmentUsage(
  value: unknown,
  path: string,
): AppointmentUsageV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(
    record,
    ["inventoryItemId", "itemNameSnapshot", "unitSnapshot", "quantity"],
    path,
  );
  return {
    inventoryItemId: parseNonEmptyString(
      record.inventoryItemId,
      `${path}.inventoryItemId`,
    ),
    itemNameSnapshot: parseNonEmptyString(
      record.itemNameSnapshot,
      `${path}.itemNameSnapshot`,
    ),
    unitSnapshot: parseNonEmptyString(
      record.unitSnapshot,
      `${path}.unitSnapshot`,
    ),
    quantity: parseQuantity(record.quantity, `${path}.quantity`, {
      positive: true,
    }),
  };
}

function parseServiceAddressSnapshot(
  value: unknown,
  path: string,
): ServiceAddressSnapshotV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(record, ["addressText", "note"], path);
  const note = parseOptionalString(record.note, `${path}.note`);
  return {
    addressText: parseNonEmptyString(
      record.addressText,
      `${path}.addressText`,
    ),
    ...(note === undefined ? {} : { note }),
  };
}

function parseAppointment(value: unknown, path: string): AppointmentV1 {
  const record = parseRecord(value, path);
  ensureOnlyFields(
    record,
    [
      "id",
      "customerId",
      "projectSnapshots",
      "standardAmountCents",
      "estimatedDurationMinutes",
      "actualUsages",
      "scheduledAt",
      "serviceAddressSnapshot",
      "note",
      "status",
      "transactionAmountCents",
      "completedAt",
      "cancelReason",
      "cancelledAt",
      "createdAt",
      "updatedAt",
      "schemaVersion",
    ],
    path,
  );
  const projectSnapshots = parseArray(
    record.projectSnapshots,
    `${path}.projectSnapshots`,
  ).map((snapshot, index) =>
    parseProjectSnapshot(snapshot, `${path}.projectSnapshots[${index}]`),
  );
  if (projectSnapshots.length === 0) {
    invalid(`${path}.projectSnapshots`, "至少需要一个服务项目");
  }
  ensureUnique(
    projectSnapshots.map((snapshot) => snapshot.projectId),
    `${path}.projectSnapshots`,
    "服务项目",
  );

  const actualUsages = parseArray(
    record.actualUsages,
    `${path}.actualUsages`,
  ).map((usage, index) =>
    parseAppointmentUsage(usage, `${path}.actualUsages[${index}]`),
  );
  ensureUnique(
    actualUsages.map((usage) => usage.inventoryItemId),
    `${path}.actualUsages`,
    "库存物品",
  );

  const standardAmountCents = parseInteger(
    record.standardAmountCents,
    `${path}.standardAmountCents`,
    0,
  );
  const estimatedDurationMinutes = parseInteger(
    record.estimatedDurationMinutes,
    `${path}.estimatedDurationMinutes`,
    1,
  );
  if (
    projectSnapshots.reduce(
      (total, project) => total + project.standardPriceCents,
      0,
    ) !== standardAmountCents
  ) {
    invalid(`${path}.standardAmountCents`, "必须等于预约项目组合的标准价格之和");
  }
  if (
    projectSnapshots.reduce(
      (total, project) => total + project.durationMinutes,
      0,
    ) !== estimatedDurationMinutes
  ) {
    invalid(
      `${path}.estimatedDurationMinutes`,
      "必须等于预约项目组合的预计时长之和",
    );
  }

  const note = parseOptionalString(record.note, `${path}.note`);
  const base = {
    id: parseNonEmptyString(record.id, `${path}.id`),
    customerId: parseNonEmptyString(record.customerId, `${path}.customerId`),
    projectSnapshots,
    standardAmountCents,
    estimatedDurationMinutes,
    actualUsages,
    scheduledAt: parseIsoDateTime(record.scheduledAt, `${path}.scheduledAt`),
    serviceAddressSnapshot: parseServiceAddressSnapshot(
      record.serviceAddressSnapshot,
      `${path}.serviceAddressSnapshot`,
    ),
    ...(note === undefined ? {} : { note }),
    createdAt: parseIsoDateTime(record.createdAt, `${path}.createdAt`),
    updatedAt: parseIsoDateTime(record.updatedAt, `${path}.updatedAt`),
    schemaVersion: parseLiteralOne(
      record.schemaVersion,
      `${path}.schemaVersion`,
    ),
  };

  switch (record.status) {
    case "pending":
      ensureAbsent(
        record,
        ["transactionAmountCents", "completedAt", "cancelReason", "cancelledAt"],
        path,
      );
      return { ...base, status: "pending" };
    case "completed":
      ensureAbsent(record, ["cancelReason", "cancelledAt"], path);
      return {
        ...base,
        status: "completed",
        transactionAmountCents: parseInteger(
          record.transactionAmountCents,
          `${path}.transactionAmountCents`,
          0,
        ),
        completedAt: parseIsoDateTime(
          record.completedAt,
          `${path}.completedAt`,
        ),
      };
    case "cancelled": {
      ensureAbsent(record, ["transactionAmountCents", "completedAt"], path);
      const cancelReason = parseOptionalString(
        record.cancelReason,
        `${path}.cancelReason`,
      );
      return {
        ...base,
        status: "cancelled",
        ...(cancelReason === undefined ? {} : { cancelReason }),
        cancelledAt: parseIsoDateTime(
          record.cancelledAt,
          `${path}.cancelledAt`,
        ),
      };
    }
    default:
      return invalid(`${path}.status`, "必须是 pending、completed、cancelled 之一");
  }
}

function parseModules(value: unknown, path: string): BusinessModuleId[] {
  const modules = parseArray(value, path).map((moduleId, index) => {
    if (!isBusinessModuleId(moduleId)) {
      return invalid(`${path}[${index}]`, "不是可识别的业务模块");
    }
    return moduleId;
  });
  ensureUnique(modules, path, "业务模块");
  return modules;
}

function validateCrossReferences(data: ApplicationData): void {
  const inventoryItems = new Map(data.inventoryItems.map((item) => [item.id, item]));
  const projectIds = new Set(data.projects.map((project) => project.id));
  const customerIds = new Set(data.customers.map((customer) => customer.id));
  const appointmentIds = new Set(data.appointments.map((appointment) => appointment.id));

  ensureUnique(data.inventoryItems.map((item) => item.id), "$.inventoryItems", "物品标识");
  ensureUnique(
    data.inventoryItems
      .filter((item) => item.status === "active")
      .map((item) => `${item.name}\u0000${item.unit}`),
    "$.inventoryItems",
    "启用物品名称与计量单位组合",
  );
  ensureUnique(data.inventoryMovements.map((movement) => movement.id), "$.inventoryMovements", "库存变动标识");
  ensureUnique(data.projects.map((project) => project.id), "$.projects", "项目标识");
  ensureUnique(
    data.projects
      .filter((project) => project.status === "active")
      .map((project) => project.name),
    "$.projects",
    "启用项目名称",
  );
  ensureUnique(data.customers.map((customer) => customer.id), "$.customers", "顾客标识");
  ensureUnique(data.customers.map((customer) => customer.nickname), "$.customers", "顾客昵称");
  ensureUnique(data.customers.map((customer) => customer.phone), "$.customers", "顾客手机号");
  ensureUnique(data.appointments.map((appointment) => appointment.id), "$.appointments", "预约标识");

  for (const [index, project] of data.projects.entries()) {
    for (const [usageIndex, usage] of project.defaultUsages.entries()) {
      const item = inventoryItems.get(usage.inventoryItemId);
      if (item === undefined) {
        invalid(`$.projects[${index}].defaultUsages[${usageIndex}].inventoryItemId`, "引用的库存物品不存在");
      }
      if (item.unitKind === "discrete" && usage.quantity.includes(".")) {
        invalid(`$.projects[${index}].defaultUsages[${usageIndex}].quantity`, "引用离散单位物品时必须为整数");
      }
    }
  }

  for (const [index, movement] of data.inventoryMovements.entries()) {
    const item = inventoryItems.get(movement.inventoryItemId);
    if (item === undefined) {
      invalid(`$.inventoryMovements[${index}].inventoryItemId`, "引用的库存物品不存在");
    }
    if (
      item.unitKind === "discrete" &&
      [movement.beforeQuantity, movement.deltaQuantity, movement.afterQuantity].some(
        (quantity) => quantity.includes("."),
      )
    ) {
      invalid(`$.inventoryMovements[${index}]`, "离散单位物品的库存变动必须全部为整数");
    }
    if (
      movement.type === "appointment-consumption" &&
      !movement.appointmentDeleted &&
      !appointmentIds.has(movement.appointmentId as string)
    ) {
      invalid(`$.inventoryMovements[${index}].appointmentId`, "引用的预约不存在且未标记为已删除");
    }
  }

  for (const [index, appointment] of data.appointments.entries()) {
    if (!customerIds.has(appointment.customerId)) {
      invalid(`$.appointments[${index}].customerId`, "引用的顾客不存在");
    }
    for (const [snapshotIndex, snapshot] of appointment.projectSnapshots.entries()) {
      if (!projectIds.has(snapshot.projectId)) {
        invalid(`$.appointments[${index}].projectSnapshots[${snapshotIndex}].projectId`, "引用的服务项目不存在");
      }
    }
    for (const [usageIndex, usage] of appointment.actualUsages.entries()) {
      const item = inventoryItems.get(usage.inventoryItemId);
      if (item === undefined) {
        invalid(`$.appointments[${index}].actualUsages[${usageIndex}].inventoryItemId`, "引用的库存物品不存在");
      }
      if (item.unitKind === "discrete" && usage.quantity.includes(".")) {
        invalid(`$.appointments[${index}].actualUsages[${usageIndex}].quantity`, "引用离散单位物品时必须为整数");
      }
    }
  }

  if (
    data.settings.defaultModuleId !== undefined &&
    !data.unlockedModules.includes(data.settings.defaultModuleId)
  ) {
    invalid("$.settings.defaultModuleId", "必须是已解锁模块");
  }
}

function parseVersionOne(source: unknown): ApplicationData {
  const record = parseRecord(source, "$");
  ensureOnlyFields(
    record,
    [
      "schemaVersion",
      "settings",
      "unlockedModules",
      "backupMetadata",
      "inventoryItems",
      "inventoryMovements",
      "projects",
      "customers",
      "appointments",
    ],
    "$",
  );
  const data: ApplicationData = {
    schemaVersion: parseLiteralOne(record.schemaVersion, "$.schemaVersion"),
    settings: parseSettings(record.settings, "$.settings"),
    unlockedModules: parseModules(record.unlockedModules, "$.unlockedModules"),
    backupMetadata: parseBackupMetadata(record.backupMetadata, "$.backupMetadata"),
    inventoryItems: parseArray(record.inventoryItems, "$.inventoryItems").map(
      (item, index) => parseInventoryItem(item, `$.inventoryItems[${index}]`),
    ),
    inventoryMovements: parseArray(
      record.inventoryMovements,
      "$.inventoryMovements",
    ).map((movement, index) =>
      parseInventoryMovement(movement, `$.inventoryMovements[${index}]`),
    ),
    projects: parseArray(record.projects, "$.projects").map((project, index) =>
      parseProject(project, `$.projects[${index}]`),
    ),
    customers: parseArray(record.customers, "$.customers").map((customer, index) =>
      parseCustomer(customer, `$.customers[${index}]`),
    ),
    appointments: parseArray(record.appointments, "$.appointments").map(
      (appointment, index) =>
        parseAppointment(appointment, `$.appointments[${index}]`),
    ),
  };

  validateCrossReferences(data);
  return data;
}

/**
 * 将阶段 0 产生的未版本化设置迁移为空业务数据的 v1 快照。
 * 阶段 0 尚未写入顾客、项目、预约或库存，因此这里不会臆测或丢弃业务记录。
 */
function migrateVersionZero(source: UnknownRecord): ApplicationData {
  ensureOnlyFields(
    source,
    ["schemaVersion", "unlockedModules", "defaultModuleId"],
    "$",
  );
  const unlockedModules =
    source.unlockedModules === undefined
      ? []
      : parseModules(source.unlockedModules, "$.unlockedModules");
  const defaultModuleCandidate = source.defaultModuleId;
  if (
    defaultModuleCandidate !== undefined &&
    !isBusinessModuleId(defaultModuleCandidate)
  ) {
    invalid("$.defaultModuleId", "不是可识别的业务模块");
  }
  if (
    defaultModuleCandidate !== undefined &&
    !unlockedModules.includes(defaultModuleCandidate)
  ) {
    invalid("$.defaultModuleId", "必须是已解锁模块");
  }

  return {
    schemaVersion: 1,
    settings: {
      schemaVersion: 1,
      ...(defaultModuleCandidate === undefined
        ? {}
        : { defaultModuleId: defaultModuleCandidate }),
    },
    unlockedModules,
    backupMetadata: { schemaVersion: 1 },
    inventoryItems: [],
    inventoryMovements: [],
    projects: [],
    customers: [],
    appointments: [],
  };
}

/**
 * 把未知来源的数据迁移并校验为当前版本完整快照。
 *
 * 接口约束：
 * - 不修改传入对象，成功时返回一份新对象；
 * - 缺少 `schemaVersion` 视为阶段 0 数据，只允许迁移当时已有的模块设置；
 * - 任一字段或跨记录引用无效时抛出 `DataMigrationError`，调用方不得写入；
 * - 高于当前版本的数据会明确拒绝，防止旧应用覆盖新版本数据。
 */
export function migrateApplicationData(source: unknown): ApplicationData {
  const record = parseRecord(source, "$");
  const rawVersion = record.schemaVersion;

  if (rawVersion === undefined || rawVersion === 0) {
    return migrateVersionZero(record);
  }
  if (!Number.isSafeInteger(rawVersion) || (rawVersion as number) < 0) {
    invalid("$.schemaVersion", "必须是非负安全整数");
  }
  if ((rawVersion as number) > CURRENT_DATA_SCHEMA_VERSION) {
    throw new DataMigrationError(
      "future-version",
      "$.schemaVersion",
      `数据版本 ${rawVersion as number} 高于当前支持版本 ${CURRENT_DATA_SCHEMA_VERSION}，请先升级应用`,
    );
  }
  if (rawVersion !== CURRENT_DATA_SCHEMA_VERSION) {
    throw new DataMigrationError(
      "unsupported-version",
      "$.schemaVersion",
      `暂不支持从数据版本 ${rawVersion as number} 迁移`,
    );
  }

  return parseVersionOne(record);
}
