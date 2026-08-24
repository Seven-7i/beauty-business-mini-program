import type { BusinessModuleId } from "@/domain/business-module";
import type { ApplicationData } from "@/domain/data-schema";
import type {
  BeautyModuleData,
  BusinessModuleDataMap,
} from "@/domain/module-data";
import { DataMigrationError, migrateApplicationData } from "./data-migrations";

/** 模块备份编排可调用的窄接口；模块自己负责数据边界和完整校验。 */
export interface BusinessModuleBackupHandler<
  ModuleId extends BusinessModuleId,
> {
  readonly moduleId: ModuleId;
  readonly displayName: string;
  extract(data: ApplicationData): BusinessModuleDataMap[ModuleId];
  validate(data: unknown): BusinessModuleDataMap[ModuleId];
  replace(
    current: ApplicationData,
    replacement: BusinessModuleDataMap[ModuleId],
  ): ApplicationData;
}

function pickBeautyData(data: ApplicationData): BeautyModuleData {
  return {
    schemaVersion: 1,
    inventoryItems: data.inventoryItems,
    inventoryMovements: data.inventoryMovements,
    projects: data.projects,
    customers: data.customers,
    appointments: data.appointments,
  };
}

/**
 * 借用完整数据 migration 校验美容模块内部的实体、精度和引用关系。
 * 临时补入的全局字段只服务于校验，不会进入模块备份结果。
 */
function validateBeautyModuleData(data: unknown): BeautyModuleData {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("美容模块备份数据必须是对象");
  }
  const record = data as Record<string, unknown>;
  const version = record.schemaVersion;
  if (typeof version === "number" && version > 1) {
    throw new DataMigrationError(
      "future-version",
      "$.schemaVersion",
      `美容模块数据版本 ${version} 高于当前支持版本 1`,
    );
  }
  if (version !== 1) {
    throw new DataMigrationError(
      "unsupported-version",
      "$.schemaVersion",
      "当前版本只支持美容模块数据版本 1",
    );
  }
  const allowedFields = new Set([
    "schemaVersion",
    "inventoryItems",
    "inventoryMovements",
    "projects",
    "customers",
    "appointments",
  ]);
  const unknownField = Object.keys(record).find(
    (field) => !allowedFields.has(field),
  );
  if (unknownField) {
    throw new DataMigrationError(
      "invalid-data",
      `$.${unknownField}`,
      `美容模块数据包含未知字段 ${unknownField}`,
    );
  }
  const normalized = migrateApplicationData({
    schemaVersion: 1,
    settings: { schemaVersion: 1 },
    unlockedModules: ["beauty"],
    backupMetadata: { schemaVersion: 1 },
    inventoryItems: record.inventoryItems,
    inventoryMovements: record.inventoryMovements,
    projects: record.projects,
    customers: record.customers,
    appointments: record.appointments,
  });
  return pickBeautyData(normalized);
}

/** 美容模块的唯一备份边界，系统备份选择与模块内数据页共同复用。 */
export const beautyModuleBackupHandler: BusinessModuleBackupHandler<"beauty"> = {
  moduleId: "beauty",
  displayName: "美容",
  extract(data) {
    return validateBeautyModuleData(pickBeautyData(data));
  },
  validate: validateBeautyModuleData,
  replace(current, replacement) {
    const normalized = validateBeautyModuleData(replacement);
    return {
      ...current,
      ...normalized,
    };
  },
};

/** 根据真实模块标识取得处理器；新增模块时必须在这里显式注册。 */
export function getBusinessModuleBackupHandler(
  moduleId: "beauty",
): BusinessModuleBackupHandler<"beauty">;
export function getBusinessModuleBackupHandler(
  moduleId: BusinessModuleId,
): BusinessModuleBackupHandler<BusinessModuleId> {
  switch (moduleId) {
    case "beauty":
      return beautyModuleBackupHandler;
  }
}
