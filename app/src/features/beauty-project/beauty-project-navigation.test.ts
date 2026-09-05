import { describe, expect, it, vi } from "vitest";
import {
  buildBeautyProjectDetailUrl,
  buildBeautyProjectEditorUrl,
  BEAUTY_PROJECT_CHANGED_EVENT,
  completeBeautyProjectDeletion,
  completeBeautyProjectEditorNavigation,
  notifyBeautyProjectChanged,
  openBeautyProjectDetail,
  openBeautyProjectEditor,
  readBeautyProjectId,
  returnToBeautyProjectList,
  subscribeBeautyProjectChanged,
} from "./beauty-project-navigation";

describe("服务项目独立页面导航", () => {
  it("新增使用基础地址，编辑和详情只附加编码后的稳定项目标识", () => {
    expect(buildBeautyProjectEditorUrl()).toBe(
      "/pages/beauty-project-create/index",
    );
    expect(buildBeautyProjectEditorUrl("project/深层补水")).toBe(
      "/pages/beauty-project-create/index?projectId=project%2F%E6%B7%B1%E5%B1%82%E8%A1%A5%E6%B0%B4",
    );
    expect(buildBeautyProjectDetailUrl("project/深层补水")).toBe(
      "/pages/beauty-project-detail/index?projectId=project%2F%E6%B7%B1%E5%B1%82%E8%A1%A5%E6%B0%B4",
    );
  });

  it("列表和详情通过聚焦入口打开对应页面", () => {
    const navigateTo = vi.fn();

    openBeautyProjectEditor("", { navigateTo });
    openBeautyProjectEditor("project-1", { navigateTo });
    openBeautyProjectDetail("project-1", { navigateTo });

    expect(navigateTo).toHaveBeenNthCalledWith(1, {
      url: "/pages/beauty-project-create/index",
    });
    expect(navigateTo).toHaveBeenNthCalledWith(2, {
      url: "/pages/beauty-project-create/index?projectId=project-1",
    });
    expect(navigateTo).toHaveBeenNthCalledWith(3, {
      url: "/pages/beauty-project-detail/index?projectId=project-1",
    });
  });

  it("页面参数缺失或全空时不误选项目", () => {
    expect(readBeautyProjectId()).toBe("");
    expect(readBeautyProjectId({ projectId: "   " })).toBe("");
    expect(readBeautyProjectId({ projectId: " project-1 " })).toBe(
      "project-1",
    );
  });

  it("有上一页时返回，深链入口则重建到服务项目列表", () => {
    const navigateBack = vi.fn();
    const reLaunch = vi.fn();

    returnToBeautyProjectList(2, { navigateBack, reLaunch });
    expect(navigateBack).toHaveBeenCalledOnce();
    expect(reLaunch).not.toHaveBeenCalled();

    navigateBack.mockClear();
    returnToBeautyProjectList(1, { navigateBack, reLaunch });
    expect(navigateBack).not.toHaveBeenCalled();
    expect(reLaunch).toHaveBeenCalledWith({
      url: "/pages/beauty-project/index",
    });
  });

  it("保存成功后先反馈再返回来源，深链按新增或编辑模式恢复", () => {
    const runtime = {
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      reLaunch: vi.fn(),
    };

    completeBeautyProjectEditorNavigation("project-1", false, runtime, 2);
    expect(runtime.showToast).toHaveBeenLastCalledWith({
      title: "服务项目已保存",
      icon: "success",
    });
    expect(runtime.navigateBack).toHaveBeenCalledOnce();
    expect(runtime.reLaunch).not.toHaveBeenCalled();

    runtime.navigateBack.mockClear();
    completeBeautyProjectEditorNavigation("project-1", false, runtime, 1);
    expect(runtime.reLaunch).toHaveBeenLastCalledWith({
      url: "/pages/beauty-project/index",
    });

    completeBeautyProjectEditorNavigation("project-1", true, runtime, 1);
    expect(runtime.showToast).toHaveBeenLastCalledWith({
      title: "项目资料已更新",
      icon: "success",
    });
    expect(runtime.reLaunch).toHaveBeenLastCalledWith({
      url: "/pages/beauty-project-detail/index?projectId=project-1",
    });
  });

  it("彻底删除后先反馈，再按页面栈返回项目列表", () => {
    const calls: string[] = [];
    const runtime = {
      showToast: vi.fn(() => calls.push("toast")),
      navigateBack: vi.fn(() => calls.push("back")),
      reLaunch: vi.fn(() => calls.push("relaunch")),
    };

    completeBeautyProjectDeletion(runtime, 2);
    expect(calls).toEqual(["toast", "back"]);

    calls.splice(0);
    completeBeautyProjectDeletion(runtime, 1);
    expect(calls).toEqual(["toast", "relaunch"]);
    expect(runtime.reLaunch).toHaveBeenLastCalledWith({
      url: "/pages/beauty-project/index",
    });
  });

  it("项目写入完成事件可刷新来源页并在卸载时对称取消", () => {
    type Payload = { projectId: string; kind: "saved" | "status" | "deleted" };
    const listeners = new Map<string, (payload: Payload) => void>();
    const runtime = {
      $emit: vi.fn((event: string, payload: Payload) => {
        listeners.get(event)?.(payload);
      }),
      $on: vi.fn((event: string, listener: (payload: Payload) => void) => {
        listeners.set(event, listener);
      }),
      $off: vi.fn((event: string, listener: (payload: Payload) => void) => {
        if (listeners.get(event) === listener) {
          listeners.delete(event);
        }
      }),
    };
    const listener = vi.fn();
    const stop = subscribeBeautyProjectChanged(listener, runtime);

    notifyBeautyProjectChanged(
      { projectId: "project-1", kind: "saved" },
      runtime,
    );
    expect(listener).toHaveBeenCalledWith({
      projectId: "project-1",
      kind: "saved",
    });
    expect(runtime.$emit).toHaveBeenCalledWith(BEAUTY_PROJECT_CHANGED_EVENT, {
      projectId: "project-1",
      kind: "saved",
    });

    stop();
    notifyBeautyProjectChanged(
      { projectId: "project-1", kind: "deleted" },
      runtime,
    );
    expect(listener).toHaveBeenCalledOnce();
    expect(runtime.$off).toHaveBeenCalledWith(
      BEAUTY_PROJECT_CHANGED_EVENT,
      listener,
    );
  });
});
