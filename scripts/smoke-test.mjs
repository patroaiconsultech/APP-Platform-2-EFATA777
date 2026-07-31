import { readFile } from "node:fs/promises";
const pkg = JSON.parse(await readFile(new URL("../package.json",import.meta.url)));
for (const script of ["test","build","check:contracts"]) {
  if (!pkg.scripts?.[script]) throw new Error(`SCRIPT_REQUIRED:${script}`);
}
console.log("local smoke metadata passed");
