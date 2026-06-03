import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat ESLint config for the web app (Next.js 16 removed the `next lint`
 * subcommand, so we run the ESLint CLI directly). `core-web-vitals` already
 * includes the Next base rules; `typescript` adds typescript-eslint's
 * (non-type-aware) recommended set.
 * @type {import("eslint").Linter.Config[]}
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];

export default config;
