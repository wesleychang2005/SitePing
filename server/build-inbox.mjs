import { build } from "esbuild";
await build({
  entryPoints: ["inbox/main.jsx"], bundle: true, minify: true, format: "esm", splitting: true,
  outdir: "public/inbox", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".css": "css" },
});
