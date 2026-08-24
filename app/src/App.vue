<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { ensureApplicationDataRecovered } from "@/services/application-startup";

const GENERATED_BACKUP_SAFETY_MILLISECONDS = 15 * 60 * 1000;
let appFiles: ReturnType<typeof createDefaultWechatBackupFileAdapter> | undefined;

function cleanupExpiredGeneratedBackups(): void {
  void appFiles
    ?.removeGeneratedBackupFiles({
      createdBefore: new Date(Date.now() - GENERATED_BACKUP_SAFETY_MILLISECONDS),
    })
    .catch(() => undefined);
}

onLaunch(() => {
  const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
  const files = createDefaultWechatBackupFileAdapter();
  appFiles = files;
  const repository = createApplicationDataRepository({
    storage,
    rollbackFiles: files,
    appVersion: APP_VERSION,
  });
  // 尽早启动恢复检查；首个页面会等待同一检查完成后再读取业务数据。
  void ensureApplicationDataRecovered(repository).catch(() => undefined);
  cleanupExpiredGeneratedBackups();
});

onShow(() => {
  // 从微信转发面板或后台返回时，安全年龄外的孤儿文件可继续幂等清理。
  cleanupExpiredGeneratedBackups();
});

onHide(() => {
  console.log("App Hide");
});
</script>

<style lang="scss">
@import "uview-plus/index.scss";

page {
  min-height: 100%;
  background: #f8f9fb;
  color: #172033;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

button::after {
  border: none;
}
</style>
