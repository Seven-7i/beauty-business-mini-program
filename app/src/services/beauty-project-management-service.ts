import type {
  ApplicationData,
  BeautyProjectV1,
} from "@/domain/data-schema";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";
import {
  assertBeautyProjectCanBeDeleted,
  normalizeBeautyProjectInput,
  type ProjectDefaultUsageInput,
} from "./beauty-project-service";

/** 项目用例依赖的窄仓储接口，禁止调用整库恢复方法保存日常资料。 */
export type BeautyProjectManagementRepository = Pick<
  ApplicationDataRepository,
  "readSnapshot" | "applyBusinessMutation"
>;

export interface BeautyProjectManagementServiceOptions {
  repository: BeautyProjectManagementRepository;
  /** 同一次保存中的创建和更新时间必须来自同一个时钟读数。 */
  now?: () => Date;
  /** 注入标识生成器便于故障重试和稳定测试。 */
  createId?: () => string;
}

export interface CreateBeautyProjectInput {
  /** 启用项目中唯一的名称。 */
  name: string;
  /** 以人民币元填写、最多两位小数的标准价格。 */
  standardPriceInput: string;
  /** 大于零的整数分钟数。 */
  durationMinutesInput: string;
  /** 可为空的默认物品用量草稿。 */
  defaultUsages: readonly ProjectDefaultUsageInput[];
}

export interface UpdateBeautyProjectInput extends CreateBeautyProjectInput {
  /** 被编辑项目的稳定标识。 */
  projectId: string;
}

function defaultCreateId(): string {
  return `beauty-project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 提供服务项目页面所需的读取和新增用例，并隐藏校验与命令提交组合。 */
export function createBeautyProjectManagementService(
  options: BeautyProjectManagementServiceOptions,
) {
  const {
    repository,
    now = () => new Date(),
    createId = defaultCreateId,
  } = options;

  async function readData(): Promise<ApplicationData> {
    return repository.readSnapshot();
  }

  async function createProject(
    input: CreateBeautyProjectInput,
  ): Promise<BeautyProjectV1> {
    const data = await readData();
    const fields = normalizeBeautyProjectInput({
      ...input,
      inventoryItems: data.inventoryItems,
      existingProjects: data.projects,
    });
    const projectId = createId();
    if (data.projects.some((project) => project.id === projectId)) {
      throw new Error("服务项目标识冲突，请重试");
    }
    const occurredAt = now().toISOString();
    const project: BeautyProjectV1 = {
      id: projectId,
      ...fields,
      status: "active",
      createdAt: occurredAt,
      updatedAt: occurredAt,
      schemaVersion: 1,
    };
    await repository.applyBusinessMutation({
      kind: "upsert-beauty-project",
      project,
    });
    return project;
  }

  async function updateProject(
    input: UpdateBeautyProjectInput,
  ): Promise<BeautyProjectV1> {
    const data = await readData();
    const current = data.projects.find(
      (project) => project.id === input.projectId,
    );
    if (!current) {
      throw new Error("服务项目不存在");
    }
    const fields = normalizeBeautyProjectInput({
      ...input,
      inventoryItems: data.inventoryItems,
      existingProjects: data.projects,
      editingProjectId: current.id,
      targetStatus: current.status,
    });
    const updated: BeautyProjectV1 = {
      ...current,
      ...fields,
      updatedAt: now().toISOString(),
    };
    await repository.applyBusinessMutation({
      kind: "upsert-beauty-project",
      project: updated,
      expectedUpdatedAt: current.updatedAt,
    });
    return updated;
  }

  async function setProjectStatus(
    projectId: string,
    status: BeautyProjectV1["status"],
  ): Promise<BeautyProjectV1> {
    const data = await readData();
    const current = data.projects.find((project) => project.id === projectId);
    if (!current) {
      throw new Error("服务项目不存在");
    }
    if (status === "active") {
      // 重新启用等同于再次进入新预约选择范围，必须复核名称和默认用量引用。
      normalizeBeautyProjectInput({
        name: current.name,
        standardPriceInput: `${Math.floor(current.standardPriceCents / 100)}.${String(current.standardPriceCents % 100).padStart(2, "0")}`,
        durationMinutesInput: String(current.durationMinutes),
        defaultUsages: current.defaultUsages.map((usage) => ({
          inventoryItemId: usage.inventoryItemId,
          quantityInput: usage.quantity,
        })),
        inventoryItems: data.inventoryItems,
        existingProjects: data.projects,
        editingProjectId: current.id,
        targetStatus: "active",
      });
    }
    const updated: BeautyProjectV1 = {
      ...current,
      status,
      updatedAt: now().toISOString(),
    };
    await repository.applyBusinessMutation({
      kind: "upsert-beauty-project",
      project: updated,
      expectedUpdatedAt: current.updatedAt,
    });
    return updated;
  }

  async function deleteProject(projectId: string): Promise<void> {
    const data = await readData();
    if (!data.projects.some((project) => project.id === projectId)) {
      throw new Error("服务项目不存在");
    }
    assertBeautyProjectCanBeDeleted(projectId, data.appointments);
    await repository.applyBusinessMutation({
      kind: "delete-unreferenced-beauty-project",
      projectId,
    });
  }

  return {
    readData,
    createProject,
    updateProject,
    setProjectStatus,
    deleteProject,
  };
}

export type BeautyProjectManagementService = ReturnType<
  typeof createBeautyProjectManagementService
>;
