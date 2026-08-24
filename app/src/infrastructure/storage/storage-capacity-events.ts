import type { StorageCapacityInfo } from "./uni-storage-adapter";

export type StorageCapacityListener = (info: StorageCapacityInfo) => void;

const listeners = new Set<StorageCapacityListener>();

/** 跨页面仓储实例广播业务写入后的容量快照。 */
export function publishStorageCapacityChanged(info: StorageCapacityInfo): void {
  for (const listener of listeners) {
    listener(info);
  }
}

export function subscribeStorageCapacityChanged(
  listener: StorageCapacityListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
