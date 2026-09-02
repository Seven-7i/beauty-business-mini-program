import { computed, readonly, shallowRef } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type {
  CreateCustomerInput,
  CustomerEditorService,
  CustomerManagementService,
  UpdateCustomerInput,
} from "@/services/customer-management-service";
import {
  CustomerRuleError,
  type CustomerRuleErrorCode,
} from "@/services/customer-service";
import {
  deriveCustomerBusinessSummary,
  type CustomerBusinessSummary,
} from "@/services/statistics-service";
import { deriveCustomerAppointmentHistory } from "../customer-appointment-history";

/** 顾客详情页可区分的错误来源。 */
export type CustomerDetailErrorKind = "" | "read" | "missing" | "operation";

/** 统一顾客表单页可区分的错误来源。 */
export type CustomerEditorErrorKind = "" | "read" | "missing" | "operation";

/** 顾客详情可切换的两个内容区。 */
export type CustomerDetailTab = "profile" | "history";

/** 编排顾客页本机读取和提交状态，对组件仅暴露只读集合。 */
export function useCustomerManagement(service: CustomerManagementService) {
  const customers = shallowRef<CustomerV1[]>([]);
  const appointments = shallowRef<AppointmentV1[]>([]);
  const loading = shallowRef(false);
  const submitting = shallowRef(false);
  const errorMessage = shallowRef("");
  const errorKind = shallowRef<"" | "read" | "operation">("");
  const errorCode = shallowRef<CustomerRuleErrorCode | "">("");
  const customersByName = computed(() =>
    [...customers.value].sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "active" ? -1 : 1;
      }
      return left.nickname.localeCompare(right.nickname);
    }),
  );
  const businessSummaries = computed<Record<string, CustomerBusinessSummary>>(
    () =>
      Object.fromEntries(
        customers.value.map((customer) => [
          customer.id,
          deriveCustomerBusinessSummary(customer.id, appointments.value),
        ]),
      ),
  );

  /** 重新读取顾客和预约快照，并清除上一次错误。 */
  async function refresh(): Promise<void> {
    loading.value = true;
    clearError();
    try {
      const data = await service.readData();
      customers.value = data.customers;
      appointments.value = data.appointments;
    } catch {
      errorKind.value = "read";
      errorMessage.value = "顾客资料读取失败，为避免覆盖原数据，请返回后重试";
    } finally {
      loading.value = false;
    }
  }

  /** 清除已展示的读取或业务操作错误。 */
  function clearError(): void {
    errorMessage.value = "";
    errorKind.value = "";
    errorCode.value = "";
  }

  /** 统一保护写操作，并保留可供表单定位的领域错误码。 */
  async function runMutation(
    operation: () => Promise<unknown>,
    fallbackMessage: string,
  ): Promise<boolean> {
    submitting.value = true;
    clearError();
    try {
      await operation();
      await refresh();
      return true;
    } catch (error) {
      errorKind.value = "operation";
      errorMessage.value =
        error instanceof Error ? error.message : fallbackMessage;
      errorCode.value =
        error instanceof CustomerRuleError ? error.code : "";
      return false;
    } finally {
      submitting.value = false;
    }
  }

  /** 创建顾客并在成功后刷新页面快照。 */
  function createCustomer(input: CreateCustomerInput): Promise<boolean> {
    return runMutation(
      () => service.createCustomer(input),
      "顾客资料保存失败，请稍后重试",
    );
  }

  /** 更新现有顾客并在成功后刷新页面快照。 */
  function updateCustomer(input: UpdateCustomerInput): Promise<boolean> {
    return runMutation(
      () => service.updateCustomer(input),
      "顾客资料保存失败，请稍后重试",
    );
  }

  /** 切换顾客状态并在成功后刷新页面快照。 */
  function setCustomerStatus(
    customerId: string,
    status: CustomerV1["status"],
  ): Promise<boolean> {
    return runMutation(
      () => service.setCustomerStatus(customerId, status),
      "顾客状态保存失败，请稍后重试",
    );
  }

  /** 删除未关联预约的顾客并在成功后刷新页面快照。 */
  function deleteCustomer(customerId: string): Promise<boolean> {
    return runMutation(
      () => service.deleteCustomer(customerId),
      "顾客删除失败，请稍后重试",
    );
  }

  return {
    customers: readonly(customers),
    appointments: readonly(appointments),
    customersByName,
    businessSummaries,
    loading: readonly(loading),
    submitting: readonly(submitting),
    errorMessage: readonly(errorMessage),
    errorKind: readonly(errorKind),
    errorCode: readonly(errorCode),
    clearError,
    refresh,
    createCustomer,
    updateCustomer,
    setCustomerStatus,
    deleteCustomer,
  };
}

/**
 * 编排统一顾客表单页的读取与保存状态。
 * 当前由 `CustomerEditor` 调用；无顾客标识时创建，有标识时读取并更新现有顾客。
 * 与顾客详情状态同置于已稳定进入微信主包的顾客 composable，避免新增纯 TS 模块漏装。
 */
export function useCustomerEditor(
  service: CustomerEditorService,
  customerId = "",
) {
  const customer = shallowRef<CustomerV1>();
  const loading = shallowRef(Boolean(customerId));
  const submitting = shallowRef(false);
  const errorMessage = shallowRef("");
  const errorKind = shallowRef<CustomerEditorErrorKind>("");
  const errorCode = shallowRef<CustomerRuleErrorCode | "">("");
  const isEditing = Boolean(customerId);

  /** 清除已经展示的读取或业务校验错误。 */
  function clearError(): void {
    errorMessage.value = "";
    errorKind.value = "";
    errorCode.value = "";
  }

  /** 编辑模式读取当前顾客；新增模式无需访问已有顾客集合。 */
  async function loadCustomer(): Promise<boolean> {
    if (!isEditing) {
      return true;
    }
    loading.value = true;
    clearError();
    try {
      const current = await service.readCustomer(customerId);
      if (!current) {
        customer.value = undefined;
        errorKind.value = "missing";
        errorMessage.value = "顾客不存在或已被删除，请返回顾客列表";
        return false;
      }
      customer.value = current;
      return true;
    } catch {
      errorKind.value = "read";
      errorMessage.value = "顾客资料读取失败，为避免覆盖原数据，请稍后重试";
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** 根据页面模式创建或更新顾客，并保留字段可定位的领域错误。 */
  async function saveCustomer(input: CreateCustomerInput): Promise<boolean> {
    submitting.value = true;
    clearError();
    try {
      if (isEditing) {
        await service.updateCustomer({ customerId, ...input });
      } else {
        await service.createCustomer(input);
      }
      return true;
    } catch (error) {
      errorKind.value = "operation";
      errorMessage.value =
        error instanceof Error
          ? error.message
          : "顾客资料保存失败，请稍后重试";
      errorCode.value =
        error instanceof CustomerRuleError ? error.code : "";
      return false;
    } finally {
      submitting.value = false;
    }
  }

  return {
    customer: readonly(customer),
    isEditing,
    loading: readonly(loading),
    submitting: readonly(submitting),
    errorMessage: readonly(errorMessage),
    errorKind: readonly(errorKind),
    errorCode: readonly(errorCode),
    clearError,
    loadCustomer,
    saveCustomer,
  };
}

/**
 * 编排独立顾客详情页的读取与写入状态。
 * 与列表状态同置于已稳定进入微信主包的顾客 composable，避免新增纯 TS 模块被增量文件清单漏装。
 */
export function useCustomerDetail(
  service: CustomerManagementService,
  customerId: string,
) {
  const customer = shallowRef<CustomerV1>();
  const appointments = shallowRef<AppointmentV1[]>([]);
  const loading = shallowRef(false);
  const submitting = shallowRef(false);
  const errorMessage = shallowRef("");
  const errorKind = shallowRef<CustomerDetailErrorKind>("");
  const errorCode = shallowRef<CustomerRuleErrorCode | "">("");
  const customerAppointments = computed(() =>
    deriveCustomerAppointmentHistory(customerId, appointments.value),
  );
  const businessSummary = computed(() =>
    deriveCustomerBusinessSummary(customerId, appointments.value),
  );

  /** 清除已经展示的读取、缺失或业务操作错误。 */
  function clearError(): void {
    errorMessage.value = "";
    errorKind.value = "";
    errorCode.value = "";
  }

  /** 重新读取当前顾客与预约快照；不存在时不复用旧资料。 */
  async function refresh(): Promise<boolean> {
    loading.value = true;
    clearError();
    try {
      const data = await service.readData();
      const nextCustomer = data.customers.find(
        (candidate) => candidate.id === customerId,
      );
      if (!nextCustomer) {
        customer.value = undefined;
        appointments.value = [];
        errorKind.value = "missing";
        errorMessage.value = "顾客不存在或已被删除，请返回顾客列表";
        return false;
      }
      customer.value = nextCustomer;
      appointments.value = data.appointments;
      return true;
    } catch {
      errorKind.value = "read";
      errorMessage.value = "顾客资料读取失败，为避免覆盖原数据，请稍后重试";
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** 统一保护详情页中的状态与删除写操作。 */
  async function runDetailMutation(
    operation: () => Promise<unknown>,
    fallbackMessage: string,
    refreshAfterSuccess = true,
  ): Promise<boolean> {
    submitting.value = true;
    clearError();
    try {
      await operation();
      return refreshAfterSuccess ? refresh() : true;
    } catch (error) {
      errorKind.value = "operation";
      errorMessage.value =
        error instanceof Error ? error.message : fallbackMessage;
      errorCode.value =
        error instanceof CustomerRuleError ? error.code : "";
      return false;
    } finally {
      submitting.value = false;
    }
  }

  /** 切换当前顾客启用状态并刷新详情快照。 */
  function setDetailCustomerStatus(
    status: CustomerV1["status"],
  ): Promise<boolean> {
    return runDetailMutation(
      () => service.setCustomerStatus(customerId, status),
      "顾客状态保存失败，请稍后重试",
    );
  }

  /** 删除从未关联预约的当前顾客；成功后由路由页返回列表。 */
  function deleteDetailCustomer(): Promise<boolean> {
    return runDetailMutation(
      () => service.deleteCustomer(customerId),
      "顾客删除失败，请稍后重试",
      false,
    );
  }

  return {
    customer: readonly(customer),
    appointments: customerAppointments,
    businessSummary,
    loading: readonly(loading),
    submitting: readonly(submitting),
    errorMessage: readonly(errorMessage),
    errorKind: readonly(errorKind),
    errorCode: readonly(errorCode),
    clearError,
    refresh,
    setCustomerStatus: setDetailCustomerStatus,
    deleteCustomer: deleteDetailCustomer,
  };
}

/** 创建默认展示资料页签、只通过明确动作切换的轻量状态。 */
export function useCustomerDetailTabs(
  initialTab: CustomerDetailTab = "profile",
) {
  const activeTab = shallowRef<CustomerDetailTab>(initialTab);

  function selectTab(tab: CustomerDetailTab): void {
    activeTab.value = tab;
  }

  return { activeTab: readonly(activeTab), selectTab };
}
