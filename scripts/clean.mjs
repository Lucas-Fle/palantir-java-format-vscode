import { rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
for (const relative of ["dist", "out", "worker/target"]) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing to remove path outside workspace: ${target}`);
  }
  rmSync(target, { recursive: true, force: true });
}
