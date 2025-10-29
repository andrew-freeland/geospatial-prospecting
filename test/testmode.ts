import fs from "fs";
import path from "path";

export function loadFixture(name: string): any {
  const p = path.join(process.cwd(), "test", "fixtures", name);
  const content = fs.readFileSync(p, "utf-8");
  return JSON.parse(content);
}

