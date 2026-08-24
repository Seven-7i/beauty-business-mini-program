/** 预约项目选择结果；changed=false 时调用方不得重建用户已调整的实际用量。 */
export interface ProjectSelectionResult {
  projectIds: string[];
  changed: boolean;
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
