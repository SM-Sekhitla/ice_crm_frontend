import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const dist = resolve("dist");
async function files(directory) {
  const entries = await readdir(resolve(dist, directory), {
    withFileTypes: true,
  });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = `${directory}/${entry.name}`;
        return entry.isDirectory() ? files(path) : [path];
      }),
    )
  ).flat();
}
const assets = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  ...(await files("assets")).map((file) => `/${file}`),
  ...(await files("pwa")).map((file) => `/${file}`),
].sort();
const hash = createHash("sha256");
for (const path of assets) {
  hash.update(path);
  hash.update(await readFile(resolve(dist, `.${path}`)));
}
const source = await readFile("src/pwa/service-worker.js", "utf8");
hash.update(source);
const version = hash.digest("hex").slice(0, 16);
await writeFile(
  resolve(dist, "sw.js"),
  source
    .replace("self.__CRM_PRECACHE__", JSON.stringify(assets))
    .replace(
      "self.__CRM_CACHE_NAME__",
      JSON.stringify(`crm-static-${version}`),
    ),
);
console.log(`PWA: ${assets.length} public assets, version ${version}`);
