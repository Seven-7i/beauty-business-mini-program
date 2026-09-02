import { computed, readonly, shallowRef } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type {
  CreateCustomerInput,
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

/** 独立顾客详情页的两个互斥内容状态。 */
export type CustomerDetailScreen = "detail" | "form";

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

  /** 统一保护详情写操作，并保留表单能够定位的领域错误码。 */
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

  /** 更新当前顾客资料并刷新详情快照。 */
  function updateDetailCustomer(input: CreateCustomerInput): Promise<boolean> {
    return runDetailMutation(
      () => service.updateCustomer({ customerId, ...input }),
      "顾客资料保存失败，请稍后重试",
    );
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
    updateCustomer: updateDetailCustomer,
    setCustomerStatus: setDetailCustomerStatus,
    deleteCustomer: deleteDetailCustomer,
  };
}

/** 详情展示时允许 onShow 刷新；编辑中保留表单快照和未保存草稿。 */
export function shouldRefreshCustomerDetail(
  screen: CustomerDetailScreen,
): boolean {
  return screen === "detail";
}

/** 按详情页面状态执行刷新，编辑中直接保留当前表单快照。 */
export async function refreshCustomerDetailForScreen(
  screen: CustomerDetailScreen,
  refresh: () => Promise<boolean>,
): Promise<boolean> {
  return shouldRefreshCustomerDetail(screen) ? refresh() : true;
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
