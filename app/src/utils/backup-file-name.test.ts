import { describe, expect, it } from "vitest";
import { createBackupFileName } from "./backup-file-name";

describe("本地备份文件名", () => {
  it("按需求生成到分钟的 JSON 文件名", () => {
    const createdAt = new Date(2026, 7, 4, 9, 5, 42);

    expect(createBackupFileName(createdAt)).toBe(
      "美容管家备份_20260804_0905.json",
    );
  });

  it("系统与美容模块使用不同前缀，避免同一分钟的文件互相覆盖", () => {
    const createdAt = new Date(2026, 7, 4, 9, 5, 42);

    expect(createBackupFileName(createdAt, "system")).toBe(
      "庄月空间系统备份_20260804_0905.json",
    );
    expect(createBackupFileName(createdAt, "beauty")).toBe(
      "庄月空间美容备份_20260804_0905.json",
    );
  });
});
