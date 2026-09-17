import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = join(projectRoot, "dist", "build", "mp-weixin");
const appConfig = JSON.parse(await readFile(join(outputRoot, "app.json"), "utf8"));
const subpackageRoots = (appConfig.subPackages ?? []).map(({ root }) => root);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : Promise.resolve([path]);
    }),
  );
  return nested.flat();
}

const files = await listFiles(outputRoot);
const sizes = new Map([["main", 0], ...subpackageRoots.map((root) => [root, 0])]);

for (const file of files) {
  const relativePath = relative(outputRoot, file);
  const root = subpackageRoots.find(
    (candidate) =>
      relativePath === candidate || relativePath.startsWith(`${candidate}${sep}`),
  );
  const bucket = root ?? "main";
  sizes.set(bucket, sizes.get(bucket) + (await stat(file)).size);
}

const mib = 1024 * 1024;
const limits = new Map([["main", 2 * mib], ...subpackageRoots.map((root) => [root, 2 * mib])]);
const total = [...sizes.values()].reduce((sum, size) => sum + size, 0);
const failures = [];

for (const [name, size] of sizes) {
  const limit = limits.get(name);
  console.log(`${name}: ${(size / 1024).toFixed(1)} KiB / ${(limit / mib).toFixed(0)} MiB`);
  if (size > limit) failures.push(`${name} 超过 ${(limit / mib).toFixed(0)} MiB`);
}

console.log(`total: ${(total / 1024).toFixed(1)} KiB / 20 MiB`);
if (total > 20 * mib) failures.push("总包超过 20 MiB");

if (failures.length > 0) {
  throw new Error(`微信小程序包体积校验失败：${failures.join("；")}`);
}
