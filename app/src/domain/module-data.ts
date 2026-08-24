import type {
  AppointmentV1,
  BeautyProjectV1,
  CustomerV1,
  InventoryItemV1,
  InventoryMovementV1,
} from "./data-schema";

/** 美容模块独占的数据集合；不包含应用设置、授权状态或系统备份元数据。 */
export interface BeautyModuleData {
  /** 美容模块数据自身的结构版本，独立于完整应用数据演进。 */
  schemaVersion: 1;
  inventoryItems: InventoryItemV1[];
  inventoryMovements: InventoryMovementV1[];
  projects: BeautyProjectV1[];
  customers: CustomerV1[];
  appointments: AppointmentV1[];
}

/** 所有已实现业务模块与其备份数据契约的映射。 */
export interface BusinessModuleDataMap {
  beauty: BeautyModuleData;
}

/** 一次选择模块恢复所携带的数据；未出现的模块必须保持原样。 */
export type SelectedBusinessModuleData = Partial<BusinessModuleDataMap>;
