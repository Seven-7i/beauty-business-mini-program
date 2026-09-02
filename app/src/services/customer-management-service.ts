import type { ApplicationData, CustomerV1 } from "@/domain/data-schema";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";
import {
  assertCustomerCanBeDeleted,
  normalizeCustomerInput,
  type CustomerAddressInput,
} from "./customer-service";

/** 顾客用例依赖的窄仓储接口，日常资料不得通过整库恢复写入。 */
export type CustomerManagementRepository = Pick<
  ApplicationDataRepository,
  "readSnapshot" | "applyBusinessMutation"
>;

/** 顾客管理用例的基础设施依赖；默认实现仅用于产品运行时。 */
export interface CustomerManagementServiceOptions {
  repository: CustomerManagementRepository;
  /** 同一次保存中的创建和更新时间使用同一个时钟读数。 */
  now?: () => Date;
  /** 注入顾客标识生成器，便于故障重试和稳定测试。 */
  createId?: () => string;
}

export interface CreateCustomerInput {
  /** 所有顾客中唯一的昵称，停用记录也参与唯一性检查。 */
  nickname: string;
  /** 中国大陆 11 位手机号。 */
  phone: string;
  /** 可为空且不设置默认项的服务地址列表。 */
  addresses: readonly CustomerAddressInput[];
}

export interface UpdateCustomerInput extends CreateCustomerInput {
  /** 被编辑顾客的稳定标识。 */
  customerId: string;
}

function defaultCreateId(): string {
  return `customer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 提供顾客管理页面所需用例，并隐藏领域校验与命令提交组合。 */
export function createCustomerManagementService(
  options: CustomerManagementServiceOptions,
) {
  const {
    repository,
    now = () => new Date(),
    createId = defaultCreateId,
  } = options;

  async function readData(): Promise<ApplicationData> {
    return options.repository.readSnapshot();
  }

  /** 按稳定标识读取一位顾客；统一顾客表单页无需接触完整应用快照。 */
  async function readCustomer(
    customerId: string,
  ): Promise<CustomerV1 | undefined> {
    const data = await readData();
    return data.customers.find((customer) => customer.id === customerId);
  }

  async function createCustomer(
    input: CreateCustomerInput,
  ): Promise<CustomerV1> {
    const data = await readData();
    const fields = normalizeCustomerInput({
      ...input,
      existingCustomers: data.customers,
    });
    const customerId = createId();
    if (data.customers.some((customer) => customer.id === customerId)) {
      throw new Error("顾客标识冲突，请重试");
    }
    const occurredAt = now().toISOString();
    const customer: CustomerV1 = {
      id: customerId,
      ...fields,
      status: "active",
      createdAt: occurredAt,
      updatedAt: occurredAt,
      schemaVersion: 1,
    };
    await options.repository.applyBusinessMutation({
      kind: "upsert-customer",
      customer,
    });
    return customer;
  }

  async function updateCustomer(
    input: UpdateCustomerInput,
  ): Promise<CustomerV1> {
    const data = await readData();
    const current = data.customers.find(
      (customer) => customer.id === input.customerId,
    );
    if (!current) {
      throw new Error("顾客不存在");
    }
    const fields = normalizeCustomerInput({
      ...input,
      existingCustomers: data.customers,
      editingCustomerId: current.id,
    });
    const updated: CustomerV1 = {
      ...current,
      ...fields,
      updatedAt: now().toISOString(),
    };
    await options.repository.applyBusinessMutation({
      kind: "upsert-customer",
      customer: updated,
      expectedUpdatedAt: current.updatedAt,
    });
    return updated;
  }

  async function setCustomerStatus(
    customerId: string,
    status: CustomerV1["status"],
  ): Promise<CustomerV1> {
    const data = await readData();
    const current = data.customers.find(
      (customer) => customer.id === customerId,
    );
    if (!current) {
      throw new Error("顾客不存在");
    }
    const updated: CustomerV1 = {
      ...current,
      status,
      updatedAt: now().toISOString(),
    };
    await options.repository.applyBusinessMutation({
      kind: "upsert-customer",
      customer: updated,
      expectedUpdatedAt: current.updatedAt,
    });
    return updated;
  }

  async function deleteCustomer(customerId: string): Promise<void> {
    const data = await readData();
    if (!data.customers.some((customer) => customer.id === customerId)) {
      throw new Error("顾客不存在");
    }
    assertCustomerCanBeDeleted(customerId, data.appointments);
    await options.repository.applyBusinessMutation({
      kind: "delete-unreferenced-customer",
      customerId,
    });
  }

  return {
    readData,
    readCustomer,
    createCustomer,
    updateCustomer,
    setCustomerStatus,
    deleteCustomer,
  };
}

/** 顾客页面可调用的窄用例接口，不暴露仓储内部能力。 */
export type CustomerManagementService = ReturnType<
  typeof createCustomerManagementService
>;

/**
 * 统一顾客表单页可调用的最窄服务契约。
 * 新增模式只创建顾客，编辑模式额外读取并更新指定顾客。
 */
export type CustomerEditorService = Pick<
  CustomerManagementService,
  "readCustomer" | "createCustomer" | "updateCustomer"
>;
