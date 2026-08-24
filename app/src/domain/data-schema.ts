import type { BusinessModuleId } from "./business-module";

/** 当前应用数据 schema 版本。升级持久化结构时必须同步增加 migration。 */
export const CURRENT_DATA_SCHEMA_VERSION = 1 as const;

/** ISO 8601 日期时间字符串；运行时由 migration 模块校验。 */
export type IsoDateTimeString = string;

/**
 * 十进制定点数量字符串，最多保留两位小数。
 * 数量计算不得直接使用 JavaScript 二进制浮点数。
 */
export type DecimalQuantity = string;

/** 业务对象的启用状态；停用对象仍为历史记录保留。 */
export type BusinessRecordStatus = "active" | "inactive";

/** 库存物品计量方式：离散单位只允许整数，连续单位允许最多两位小数。 */
export type InventoryUnitKind = "discrete" | "continuous";

/** 库存变动的业务来源。 */
export type InventoryMovementType =
  | "initial"
  | "restock"
  | "stocktake"
  | "appointment-consumption";

/** 预约当前所处的业务状态。 */
export type AppointmentStatus = "pending" | "completed" | "cancelled";

/** 应用级设置。 */
export interface ApplicationSettingsV1 {
  /** 独立记录的 schema 版本，便于按 key 读取时校验。 */
  schemaVersion: 1;
  /** 多模块场景下启动时优先进入的模块；未设置时省略。 */
  defaultModuleId?: BusinessModuleId;
}

/** 备份提醒与最近一次导出信息。 */
export interface BackupMetadataV1 {
  /** 独立记录的 schema 版本。 */
  schemaVersion: 1;
  /** 首次产生业务数据的时间；尚无业务数据时省略。 */
  firstBusinessDataAt?: IsoDateTimeString;
  /** 最近一次成功导出的时间。 */
  lastExportedAt?: IsoDateTimeString;
  /** 最近一次成功导出的文件名。 */
  lastExportFileName?: string;
  /** 最近一次展示备份提醒的本地日期，格式为 YYYY-MM-DD。 */
  lastReminderDate?: string;
}

/** 库存物品。 */
export interface InventoryItemV1 {
  /** 稳定且唯一的物品标识。 */
  id: string;
  /** 物品名称。 */
  name: string;
  /** 计量单位，例如“瓶”或“毫升”。 */
  unit: string;
  /** 计量方式，决定数量允许的精度。 */
  unitKind: InventoryUnitKind;
  /** 当前实际持有数量。 */
  currentQuantity: DecimalQuantity;
  /** 可选补充说明。 */
  note?: string;
  /** 是否仍可用于新业务。 */
  status: BusinessRecordStatus;
  /** 创建时间。 */
  createdAt: IsoDateTimeString;
  /** 最后更新时间。 */
  updatedAt: IsoDateTimeString;
  /** 记录自身的 schema 版本。 */
  schemaVersion: 1;
}

/** 库存变动记录。 */
export interface InventoryMovementV1 {
  /** 稳定且唯一的变动标识。 */
  id: string;
  /** 被变动物品的标识。 */
  inventoryItemId: string;
  /** 本次变动的业务来源。 */
  type: InventoryMovementType;
  /** 变动前数量。 */
  beforeQuantity: DecimalQuantity;
  /** 有符号变动量，减少时为负数。 */
  deltaQuantity: DecimalQuantity;
  /** 变动后数量。 */
  afterQuantity: DecimalQuantity;
  /** 可选补充说明。 */
  note?: string;
  /** 业务变动实际发生时间。 */
  occurredAt: IsoDateTimeString;
  /** 来源预约标识；仅预约消耗记录使用。 */
  appointmentId?: string;
  /** 来源预约是否已被彻底删除。 */
  appointmentDeleted: boolean;
  /** 记录创建时间。 */
  createdAt: IsoDateTimeString;
  /** 记录最后更新时间。 */
  updatedAt: IsoDateTimeString;
  /** 记录自身的 schema 版本。 */
  schemaVersion: 1;
}

/** 服务项目的一项默认物品用量。 */
export interface ProjectDefaultUsageV1 {
  /** 被使用的库存物品标识。 */
  inventoryItemId: string;
  /** 建议使用数量，必须大于零。 */
  quantity: DecimalQuantity;
}

/** 服务项目。 */
export interface BeautyProjectV1 {
  /** 稳定且唯一的项目标识。 */
  id: string;
  /** 启用状态下唯一的项目名称。 */
  name: string;
  /** 项目标准价格，单位为人民币分。 */
  standardPriceCents: number;
  /** 预计服务时长，单位为分钟。 */
  durationMinutes: number;
  /** 项目默认用量，可为空数组。 */
  defaultUsages: ProjectDefaultUsageV1[];
  /** 是否仍可用于新预约。 */
  status: BusinessRecordStatus;
  /** 创建时间。 */
  createdAt: IsoDateTimeString;
  /** 最后更新时间。 */
  updatedAt: IsoDateTimeString;
  /** 记录自身的 schema 版本。 */
  schemaVersion: 1;
}

/** 顾客服务地址。 */
export interface CustomerAddressV1 {
  /** 顾客范围内唯一的地址标识。 */
  id: string;
  /** 上门服务地址正文。 */
  addressText: string;
  /** 可选地址说明。 */
  note?: string;
}

/** 顾客。 */
export interface CustomerV1 {
  /** 稳定且唯一的顾客标识。 */
  id: string;
  /** 未删除顾客中唯一的昵称。 */
  nickname: string;
  /** 通过校验的中国大陆 11 位手机号。 */
  phone: string;
  /** 顾客维护的服务地址列表。 */
  addresses: CustomerAddressV1[];
  /** 是否仍可用于新预约。 */
  status: BusinessRecordStatus;
  /** 创建时间。 */
  createdAt: IsoDateTimeString;
  /** 最后更新时间。 */
  updatedAt: IsoDateTimeString;
  /** 记录自身的 schema 版本。 */
  schemaVersion: 1;
}

/** 预约保存时的服务项目快照。 */
export interface AppointmentProjectSnapshotV1 {
  /** 原服务项目标识。 */
  projectId: string;
  /** 保存预约时的项目名称。 */
  name: string;
  /** 保存预约时的项目标准价格，单位为分。 */
  standardPriceCents: number;
  /** 保存预约时的预计服务时长，单位为分钟。 */
  durationMinutes: number;
}

/** 预约实际使用的一项库存物品。 */
export interface AppointmentUsageV1 {
  /** 库存物品标识。 */
  inventoryItemId: string;
  /** 保存预约时的物品名称。 */
  itemNameSnapshot: string;
  /** 保存预约时的计量单位。 */
  unitSnapshot: string;
  /** 本次预约使用数量，必须大于零。 */
  quantity: DecimalQuantity;
}

/** 预约保存时的服务地址快照。 */
export interface ServiceAddressSnapshotV1 {
  /** 上门服务地址正文。 */
  addressText: string;
  /** 可选地址说明。 */
  note?: string;
}

/** 所有预约状态共有的数据。 */
interface AppointmentBaseV1 {
  /** 稳定且唯一的预约标识。 */
  id: string;
  /** 当前关联的顾客标识。 */
  customerId: string;
  /** 至少包含一项且互不重复的预约项目组合快照。 */
  projectSnapshots: AppointmentProjectSnapshotV1[];
  /** 项目快照价格之和，单位为分。 */
  standardAmountCents: number;
  /** 项目快照时长之和，单位为分钟。 */
  estimatedDurationMinutes: number;
  /** 本次预约最终保存的实际用量。 */
  actualUsages: AppointmentUsageV1[];
  /** 计划开始服务的时间。 */
  scheduledAt: IsoDateTimeString;
  /** 本次预约的服务地址快照。 */
  serviceAddressSnapshot: ServiceAddressSnapshotV1;
  /** 可选补充说明。 */
  note?: string;
  /** 创建时间。 */
  createdAt: IsoDateTimeString;
  /** 最后更新时间。 */
  updatedAt: IsoDateTimeString;
  /** 记录自身的 schema 版本。 */
  schemaVersion: 1;
}

/** 待执行预约。 */
export interface PendingAppointmentV1 extends AppointmentBaseV1 {
  status: "pending";
  transactionAmountCents?: never;
  completedAt?: never;
  cancelReason?: never;
  cancelledAt?: never;
}

/** 已完成预约。 */
export interface CompletedAppointmentV1 extends AppointmentBaseV1 {
  status: "completed";
  /** 实际成交金额，单位为分。 */
  transactionAmountCents: number;
  /** 实际完成时间。 */
  completedAt: IsoDateTimeString;
  cancelReason?: never;
  cancelledAt?: never;
}

/** 已取消预约。 */
export interface CancelledAppointmentV1 extends AppointmentBaseV1 {
  status: "cancelled";
  transactionAmountCents?: never;
  completedAt?: never;
  /** 可选取消原因。 */
  cancelReason?: string;
  /** 取消时间。 */
  cancelledAt: IsoDateTimeString;
}

/** 任一有效状态的预约。 */
export type AppointmentV1 =
  | PendingAppointmentV1
  | CompletedAppointmentV1
  | CancelledAppointmentV1;

/**
 * 当前版本完整业务数据快照。
 * 它是备份、恢复预检和 migrations 之间共享的逻辑数据契约，不要求以单个 Storage key 保存。
 */
export interface ApplicationDataV1 {
  /** 完整快照的 schema 版本。 */
  schemaVersion: 1;
  /** 应用级设置。 */
  settings: ApplicationSettingsV1;
  /** 已解锁业务模块。 */
  unlockedModules: BusinessModuleId[];
  /** 备份提醒和最近导出信息。 */
  backupMetadata: BackupMetadataV1;
  /** 全部库存物品。 */
  inventoryItems: InventoryItemV1[];
  /** 全部库存变动记录。 */
  inventoryMovements: InventoryMovementV1[];
  /** 全部服务项目。 */
  projects: BeautyProjectV1[];
  /** 全部顾客。 */
  customers: CustomerV1[];
  /** 全部预约。 */
  appointments: AppointmentV1[];
}

/** 当前应用版本能够读取和写出的完整数据快照。 */
export type ApplicationData = ApplicationDataV1;
