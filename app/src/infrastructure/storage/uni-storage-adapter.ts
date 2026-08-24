/** uni Storage API 的通用失败信息。 */
interface StorageFailure {
  /** 包含 API 名称和失败原因的原始错误消息。 */
  errMsg: string;
}

/** 异步读取一个 Storage key 所需的 uni API 参数。 */
interface GetStorageOptions {
  /** 要读取的 Storage key。 */
  key: string;
  /** key 存在时返回其原始数据。 */
  success: (result: { data: unknown }) => void;
  /** key 不存在或读取异常时返回失败信息。 */
  fail: (error: StorageFailure) => void;
}

/** 异步写入一个 Storage key 所需的 uni API 参数。 */
interface SetStorageOptions {
  /** 要写入的 Storage key。 */
  key: string;
  /** 可被 uni Storage 序列化保存的数据。 */
  data: unknown;
  /** 数据持久化成功后的回调。 */
  success: () => void;
  /** 数据序列化或持久化失败后的回调。 */
  fail: (error: StorageFailure) => void;
}

/** 异步删除一个 Storage key 所需的 uni API 参数。 */
interface RemoveStorageOptions {
  /** 要删除的 Storage key。 */
  key: string;
  /** key 删除成功后的回调。 */
  success: () => void;
  /** 删除失败后的回调。 */
  fail: (error: StorageFailure) => void;
}

/** 查询 Storage 容量和 key 列表所需的 uni API 参数。 */
interface GetStorageInfoOptions {
  /** 容量信息读取成功后的回调；容量单位由 uni API 定义为 KB。 */
  success: (result: {
    /** 当前 Storage 中的全部 key。 */
    keys: string[];
    /** 当前已使用容量，单位为 KB。 */
    currentSize: number;
    /** Storage 容量上限，单位为 KB。 */
    limitSize: number;
  }) => void;
  /** 容量信息读取失败后的回调。 */
  fail: (error: StorageFailure) => void;
}

/** 页面容量提示使用的只读 Storage 容量快照，容量单位均为 KB。 */
export interface StorageCapacityInfo {
  /** 生成快照时存在的全部 Storage key。 */
  keys: readonly string[];
  /** 当前已使用容量，单位为 KB。 */
  currentSizeKb: number;
  /** 当前运行环境允许的容量上限，单位为 KB。 */
  limitSizeKb: number;
}

/** Storage 适配器实际依赖的最小 uni 运行时接口。 */
export interface UniStorageRuntime {
  /** 异步读取一个 key。 */
  getStorage(options: GetStorageOptions): void;
  /** 异步写入一个 key。 */
  setStorage(options: SetStorageOptions): void;
  /** 异步删除一个 key。 */
  removeStorage(options: RemoveStorageOptions): void;
  /** 异步读取容量和 key 列表。 */
  getStorageInfo(options: GetStorageInfoOptions): void;
}

/** 业务仓储依赖的 Promise 风格键值存储边界。 */
export interface KeyValueStorage {
  /** 读取 key；key 不存在时返回 undefined，而不是抛出异常。 */
  get<T>(key: string): Promise<T | undefined>;
  /** 写入或覆盖一个 key。 */
  set<T>(key: string, value: T): Promise<void>;
  /** 删除一个 key。 */
  remove(key: string): Promise<void>;
}

/** 在键值读写能力上增加容量查询的完整 Storage 适配器。 */
export interface StorageAdapter extends KeyValueStorage {
  /** 获取当前容量、容量上限和 key 列表的只读快照。 */
  getCapacityInfo(): Promise<StorageCapacityInfo>;
}

/** 将“key 不存在”识别为正常空值，其他 Storage 错误仍向上抛出。 */
function isMissingKeyError(error: StorageFailure): boolean {
  return error.errMsg.includes("data not found");
}

/**
 * 把回调式 uni Storage API 转换为 Promise 风格的 StorageAdapter。
 *
 * 该边界统一处理缺失 key 语义和容量单位，仓储层无需依赖 uni 全局对象。
 */
export function createUniStorageAdapter(
  runtime: UniStorageRuntime,
): StorageAdapter {
  return {
    get<T>(key: string): Promise<T | undefined> {
      return new Promise((resolve, reject) => {
        runtime.getStorage({
          key,
          success(result) {
            resolve(result.data as T);
          },
          fail(error) {
            if (isMissingKeyError(error)) {
              resolve(undefined);
              return;
            }

            reject(new Error(error.errMsg));
          },
        });
      });
    },
    set<T>(key: string, value: T): Promise<void> {
      return new Promise((resolve, reject) => {
        runtime.setStorage({
          key,
          data: value,
          success() {
            resolve();
          },
          fail(error) {
            reject(new Error(error.errMsg));
          },
        });
      });
    },
    remove(key: string): Promise<void> {
      return new Promise((resolve, reject) => {
        runtime.removeStorage({
          key,
          success() {
            resolve();
          },
          fail(error) {
            reject(new Error(error.errMsg));
          },
        });
      });
    },
    getCapacityInfo(): Promise<StorageCapacityInfo> {
      return new Promise((resolve, reject) => {
        runtime.getStorageInfo({
          success(result) {
            resolve({
              keys: [...result.keys],
              currentSizeKb: result.currentSize,
              limitSizeKb: result.limitSize,
            });
          },
          fail(error) {
            reject(new Error(error.errMsg));
          },
        });
      });
    },
  };
}
