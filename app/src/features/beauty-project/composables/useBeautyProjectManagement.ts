import { computed, readonly, shallowRef } from "vue";
import type { BeautyProjectV1, InventoryItemV1 } from "@/domain/data-schema";
import type {
  BeautyProjectManagementService,
  CreateBeautyProjectInput,
  UpdateBeautyProjectInput,
} from "@/services/beauty-project-management-service";

/** 管理项目页的本机读取与提交状态，对组件暴露只读集合。 */
export function useBeautyProjectManagement(
  service: BeautyProjectManagementService,
) {
  const projects = shallowRef<BeautyProjectV1[]>([]);
  const inventoryItems = shallowRef<InventoryItemV1[]>([]);
  const loading = shallowRef(false);
  const submitting = shallowRef(false);
  const errorMessage = shallowRef("");
  const activeInventoryItems = computed(() =>
    inventoryItems.value.filter((item) => item.status === "active"),
  );

  async function refresh(): Promise<boolean> {
    loading.value = true;
    errorMessage.value = "";
    try {
      const data = await service.readData();
      projects.value = data.projects;
      inventoryItems.value = data.inventoryItems;
      return true;
    } catch {
      errorMessage.value = "项目资料读取失败，为避免覆盖原数据，请返回后重试";
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function runMutation(
    operation: () => Promise<unknown>,
    fallbackMessage: string,
  ): Promise<boolean> {
    submitting.value = true;
    errorMessage.value = "";
    try {
      await operation();
      await refresh();
      return true;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : fallbackMessage;
      return false;
    } finally {
      submitting.value = false;
    }
  }

  function createProject(input: CreateBeautyProjectInput): Promise<boolean> {
    return runMutation(
      () => service.createProject(input),
      "服务项目保存失败，请稍后重试",
    );
  }

  function updateProject(input: UpdateBeautyProjectInput): Promise<boolean> {
    return runMutation(
      () => service.updateProject(input),
      "服务项目保存失败，请稍后重试",
    );
  }

  function setProjectStatus(
    projectId: string,
    status: BeautyProjectV1["status"],
  ): Promise<boolean> {
    return runMutation(
      () => service.setProjectStatus(projectId, status),
      "项目状态保存失败，请稍后重试",
    );
  }

  function deleteProject(projectId: string): Promise<boolean> {
    return runMutation(
      () => service.deleteProject(projectId),
      "服务项目删除失败，请稍后重试",
    );
  }

  return {
    projects: readonly(projects),
    inventoryItems: readonly(inventoryItems),
    activeInventoryItems,
    loading: readonly(loading),
    submitting: readonly(submitting),
    errorMessage: readonly(errorMessage),
    refresh,
    createProject,
    updateProject,
    setProjectStatus,
    deleteProject,
  };
}
