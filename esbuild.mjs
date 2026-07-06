import * as esbuild from "esbuild";

const production = process.argv.includes("--production");

await esbuild.build({
  entryPoints: ["extension/src/extension.ts"],
  bundle: true,
  format: "cjs",
  minify: production,
  platform: "node",
  sourcemap: !production,
  sourcesContent: false,
  outfile: "dist/extension.js",
  external: ["vscode"],
  logLevel: "info"
});
