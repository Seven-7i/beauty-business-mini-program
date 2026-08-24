import type { BusinessModuleId } from "@/domain/business-module";
import type { StorageAdapter } from "@/infrastructure/storage/uni-storage-adapter";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";

/** “我的”页面只展示本机数据摘要，不读取或暴露具体业务记录。 */
export interface MyCenterOverview {
  /** 当前设备已经解锁且可识别的业务模块。 */
  unlockedModules: readonly BusinessModuleId[];
  /** 用户最近确认完成微信转发的导出时间。 */
  lastExportedAt?: string;
  /** 最近成功导出的产品备份文件名。 */
  lastExportFileName?: string;
  /** 微信 Storage 当前占用，单位 KB。 */
  currentSizeKb: number;
  /** 微信 Storage 配额上限，单位 KB。 */
  limitSizeKb: number;
}

export interface MyCenterServiceOptions {
  /** 提供授权和备份元数据摘要的应用数据仓储。 */
  repository: Pick<ApplicationDataRepository, "readSnapshot">;
  /** 提供当前设备 Storage 容量信息的 adapter。 */
  storage: Pick<StorageAdapter, "getCapacityInfo">;
}

export function createMyCenterService(options: MyCenterServiceOptions) {
  const { repository, storage } = options;

  async function readOverview(): Promise<MyCenterOverview> {
    const [data, capacity] = await Promise.all([
      repository.readSnapshot(),
      storage.getCapacityInfo(),
    ]);
    return {
      unlockedModules: data.unlockedModules,
      lastExportedAt: data.backupMetadata.lastExportedAt,
      lastExportFileName: data.backupMetadata.lastExportFileName,
      currentSizeKb: capacity.currentSizeKb,
      limitSizeKb: capacity.limitSizeKb,
    };
  }

  return { readOverview };
}

export type MyCenterService = ReturnType<typeof createMyCenterService>;
