import { computed, readonly, shallowRef } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type {
  CreateCustomerInput,
  CustomerManagementService,
  UpdateCustomerInput,
} from "@/services/customer-management-service";
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

  async function refresh(): Promise<void> {
    loading.value = true;
    errorMessage.value = "";
    try {
      const data = await service.readData();
      customers.value = data.customers;
      appointments.value = data.appointments;
    } catch {
      errorMessage.value = "顾客资料读取失败，为避免覆盖原数据，请返回后重试";
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

  return {
    customers: readonly(customers),
    customersByName,
    businessSummaries,
    loading: readonly(loading),
    submitting: readonly(submitting),
    errorMessage: readonly(errorMessage),
    refresh,
    createCustomer: (input: CreateCustomerInput) =>
      runMutation(
        () => service.createCustomer(input),
        "顾客资料保存失败，请稍后重试",
      ),
    updateCustomer: (input: UpdateCustomerInput) =>
      runMutation(
        () => service.updateCustomer(input),
        "顾客资料保存失败，请稍后重试",
      ),
    setCustomerStatus: (
      customerId: string,
      status: CustomerV1["status"],
    ) =>
      runMutation(
        () => service.setCustomerStatus(customerId, status),
        "顾客状态保存失败，请稍后重试",
      ),
    deleteCustomer: (customerId: string) =>
      runMutation(
        () => service.deleteCustomer(customerId),
        "顾客删除失败，请稍后重试",
      ),
  };
}
