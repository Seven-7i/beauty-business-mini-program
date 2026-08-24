/** 当前版本支持的业务模块标识。 */
export type BusinessModuleId = "beauty";

/**
 * 判断外部数据中的值是否为当前版本可识别的业务模块标识。
 * 该守卫由仓储读取和数据迁移共同复用，避免各层重复维护模块白名单。
 */
export function isBusinessModuleId(value: unknown): value is BusinessModuleId {
  return value === "beauty";
}
