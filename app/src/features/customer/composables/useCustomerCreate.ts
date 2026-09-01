import { readonly, shallowRef } from "vue";
import type {
  CreateCustomerInput,
  CustomerCreateService,
} from "@/services/customer-management-service";
import {
  CustomerRuleError,
  type CustomerRuleErrorCode,
} from "@/services/customer-service";

/**
 * 编排独立新增顾客页的单次写入状态，不读取或暴露顾客集合。
 * 当前由 `CustomerCreate` 调用，只接收创建顾客的最窄服务契约。
 */
export function useCustomerCreate(service: CustomerCreateService) {
  const submitting = shallowRef(false);
  const errorMessage = shallowRef("");
  const errorCode = shallowRef<CustomerRuleErrorCode | "">("");

  /** 用户修改草稿后清除上一次保存错误。 */
  function clearError(): void {
    errorMessage.value = "";
    errorCode.value = "";
  }

  /** 创建顾客并保留可供表单就近定位的领域错误。 */
  async function createCustomer(input: CreateCustomerInput): Promise<boolean> {
    submitting.value = true;
    clearError();
    try {
      await service.createCustomer(input);
      return true;
    } catch (error) {
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
    submitting: readonly(submitting),
    errorMessage: readonly(errorMessage),
    errorCode: readonly(errorCode),
    clearError,
    createCustomer,
  };
}
