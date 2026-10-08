import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  sourcemap: true,
  clean: true,
  // workspace 套件打進 bundle；node_modules 依賴維持外部引用
  noExternal: [/^@lunch\//],
  // 原生/大型第三方套件維持外部引用（由 server 的 dependencies 提供）
  external: ["better-sqlite3", "drizzle-orm", "@google/genai", "openai", "discord.js", "zod"],
  shims: true,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" }
});
