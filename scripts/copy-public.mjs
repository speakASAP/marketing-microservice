import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const source = path.resolve("public");
const target = path.resolve("dist/public");

if (!existsSync(source)) {
  await mkdir(target, { recursive: true });
} else {
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true });
}
