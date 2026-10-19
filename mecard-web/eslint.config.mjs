import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Canonical design mockups + design-system bundle: third-party generated JS,
    // wiped on `design:import`, never built or shipped — don't lint it.
    "design/**",
    // One-off ops scripts (gcloud setup, design import) aren't app code.
    "scripts/**",
  ]),
]);

export default eslintConfig;
