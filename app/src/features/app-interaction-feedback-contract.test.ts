import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/** 递归收集源码目录中的 Vue 单文件组件，供系统级交互契约检查复用。 */
function collectVueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? collectVueFiles(path)
      : entry.name.endsWith(".vue")
        ? [path]
        : [];
  });
}

describe("系统级点击反馈契约", () => {
  it("为原生按钮提供统一按压反馈且禁用态不响应", () => {
    const app = readFileSync(join(process.cwd(), "src/App.vue"), "utf8");

    expect(app).toContain("button:active");
    expect(app).toContain("button[disabled]:active");
  });

  it("所有承担操作的非按钮元素均声明 hover 按压态", () => {
    const sourceRoot = join(process.cwd(), "src");
    const missing = collectVueFiles(sourceRoot).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/<([A-Za-z][\w-]*)\b[\s\S]*?>/g)]
        .map((match) => ({ tag: match[1], openingTag: match[0] }))
        .filter(({ tag, openingTag }) =>
          tag !== "button" &&
          /@(click|tap)(?:\.|=)/.test(openingTag) &&
          !openingTag.includes("hover-class") &&
          !/@click\.stop(?:\s|=|>)/.test(openingTag) &&
          !openingTag.includes("__mask"),
        )
        .map(({ openingTag }) =>
          `${relative(sourceRoot, file)}: ${openingTag.replace(/\s+/g, " ")}`,
        );
    });

    expect(missing).toEqual([]);
  });
});
