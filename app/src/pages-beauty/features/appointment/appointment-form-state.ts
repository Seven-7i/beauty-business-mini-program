/** 预约项目选择结果；changed=false 时调用方不得重建用户已调整的实际用量。 */
export interface ProjectSelectionResult {
  projectIds: string[];
  changed: boolean;
}

/** 完成预约时可编辑的一项库存用量草稿。 */
export interface AppointmentUsageDraft {
  inventoryItemId: string;
  quantityInput: string;
}

/** 新增页顶部可选择的预约录入方式。 */
export type AppointmentEntryMode = "scheduled" | "backfilled";

/** 后补预约的最终结果；后补记录不会进入待执行。 */
export type BackfilledOutcome = "completed" | "cancelled";

/**
 * 合并项目默认用量，为后补完成和正常预约完成提供可调整的初始值。
 */
export function buildDefaultUsageDrafts(
  projectIds: readonly string[],
  projects: readonly {
    id: string;
    defaultUsages: readonly { inventoryItemId: string; quantity: string }[];
  }[],
  addQuantities: (left: string, right: string) => string,
): AppointmentUsageDraft[] {
  const quantities = new Map<string, string>();
  for (const projectId of projectIds) {
    const project = projects.find((candidate) => candidate.id === projectId);
    for (const usage of project?.defaultUsages ?? []) {
      quantities.set(
        usage.inventoryItemId,
        addQuantities(
          quantities.get(usage.inventoryItemId) ?? "0",
          usage.quantity,
        ),
      );
    }
  }
  return [...quantities].map(([inventoryItemId, quantityInput]) => ({
    inventoryItemId,
    quantityInput,
  }));
}

/**
 * 生成完成正常预约时的实际用量初始值：优先保留预约创建时的预计用量快照，
 * 仅为历史空快照预约回退合并当前项目的正常用量。
 */
export function buildCompletionUsageDrafts(
  expectedUsages: readonly { inventoryItemId: string; quantity: string }[],
  projectIds: readonly string[],
  projects: readonly {
    id: string;
    defaultUsages: readonly { inventoryItemId: string; quantity: string }[];
  }[],
  addQuantities: (left: string, right: string) => string,
): AppointmentUsageDraft[] {
  if (expectedUsages.length > 0) {
    return expectedUsages.map((usage) => ({
      inventoryItemId: usage.inventoryItemId,
      quantityInput: usage.quantity,
    }));
  }
  return buildDefaultUsageDrafts(projectIds, projects, addQuantities);
}

/**
 * 把选择器确认的项目立即加入项目组合。空值和重复项目保持原组合，
 * 避免重复选择误触发默认用量重建。
 */
export function applyProjectSelection(
  currentProjectIds: readonly string[],
  selectedProjectId: string,
): ProjectSelectionResult {
  if (!selectedProjectId || currentProjectIds.includes(selectedProjectId)) {
    return { projectIds: [...currentProjectIds], changed: false };
  }
  return {
    projectIds: [...currentProjectIds, selectedProjectId],
    changed: true,
  };
}
