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
