import { computed, readonly, shallowRef } from "vue";
import type { BeautyProjectV1, InventoryItemV1 } from "@/domain/data-schema";
import type {
  BeautyProjectManagementService,
  CreateBeautyProjectInput,
  UpdateBeautyProjectInput,
} from "@/services/beauty-project-management-service";

/** 服务项目列表筛选所需的最小项目形状。 */
interface FilterableBeautyProject {
  /** 可被项目名称搜索匹配的文本。 */
  name: string;
  /** 决定项目属于默认启用范围还是“仅看停用”范围。 */
  status: BeautyProjectV1["status"];
}

/**
 * 按确认稿在互斥的启用/停用范围内匹配服务项目名称。
 * 当前由 BeautyProjectList 调用；保留为纯函数以覆盖列表筛选边界。
 */
export function filterBeautyProjects<TProject extends FilterableBeautyProject>(
  projects: readonly TProject[],
  keyword: string,
  inactiveOnly: boolean,
): TProject[] {
  const query = keyword.trim();
  const visibleStatus: BeautyProjectV1["status"] = inactiveOnly
    ? "inactive"
    : "active";

  return projects.filter(
    (project) =>
      project.status === visibleStatus &&
      (!query || project.name.includes(query)),
  );
}

/** 管理项目页的本机读取与提交状态，对组件暴露只读集合。 */
export function useBeautyProjectManagement(
  service: BeautyProjectManagementService,
) {
  const projects = shallowRef<BeautyProjectV1[]>([]);
  const inventoryItems = shallowRef<InventoryItemV1[]>([]);
  const loading = shallowRef(false);
  const hasLoaded = shallowRef(false);
  const submitting = shallowRef(false);
  const errorMessage = shallowRef("");
  const errorKind = shallowRef<"" | "read" | "operation">("");
  const activeInventoryItems = computed(() =>
    inventoryItems.value.filter((item) => item.status === "active"),
  );
  const projectsByStatusAndName = computed(() =>
    [...projects.value].sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "active" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    }),
  );

  /** 重新读取服务项目与默认用量引用的库存快照。 */
  async function refresh(): Promise<boolean> {
    loading.value = true;
    errorMessage.value = "";
    errorKind.value = "";
    try {
      const data = await service.readData();
      projects.value = data.projects;
      inventoryItems.value = data.inventoryItems;
      hasLoaded.value = true;
      return true;
    } catch {
      errorKind.value = "read";
      errorMessage.value = "项目资料读取失败，为避免覆盖原数据，请返回后重试";
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** 统一业务提交状态、错误呈现和提交后的最新快照读回。 */
  async function runMutation(
    operation: () => Promise<unknown>,
    fallbackMessage: string,
  ): Promise<boolean> {
    submitting.value = true;
    errorMessage.value = "";
    errorKind.value = "";
    try {
      await operation();
      await refresh();
      return true;
    } catch (error) {
      errorKind.value = "operation";
      errorMessage.value =
        error instanceof Error ? error.message : fallbackMessage;
      return false;
    } finally {
      submitting.value = false;
    }
  }

  /** 创建项目并在成功时返回其稳定标识载体。 */
  async function createProject(
    input: CreateBeautyProjectInput,
  ): Promise<BeautyProjectV1 | undefined> {
    let created: BeautyProjectV1 | undefined;
    const saved = await runMutation(async () => {
      created = await service.createProject(input);
    }, "服务项目保存失败，请稍后重试");
    return saved ? created : undefined;
  }

  /** 更新指定项目资料，保持原有状态与创建时间。 */
  function updateProject(input: UpdateBeautyProjectInput): Promise<boolean> {
    return runMutation(
      () => service.updateProject(input),
      "服务项目保存失败，请稍后重试",
    );
  }

  /** 在引用规则允许的范围内切换项目启用状态。 */
  function setProjectStatus(
    projectId: string,
    status: BeautyProjectV1["status"],
  ): Promise<boolean> {
    return runMutation(
      () => service.setProjectStatus(projectId, status),
      "项目状态保存失败，请稍后重试",
    );
  }

  /** 仅在项目从未进入预约快照时彻底删除。 */
  function deleteProject(projectId: string): Promise<boolean> {
    return runMutation(
      () => service.deleteProject(projectId),
      "服务项目删除失败，请稍后重试",
    );
  }

  return {
    projects: readonly(projects),
    projectsByStatusAndName,
    inventoryItems: readonly(inventoryItems),
    activeInventoryItems,
    loading: readonly(loading),
    hasLoaded: readonly(hasLoaded),
    submitting: readonly(submitting),
    errorMessage: readonly(errorMessage),
    errorKind: readonly(errorKind),
    refresh,
    createProject,
    updateProject,
    setProjectStatus,
    deleteProject,
  };
}
