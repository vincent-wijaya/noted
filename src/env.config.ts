/* eslint-disable @typescript-eslint/no-require-imports */

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

let project_root_dir: string | undefined;

// Server-side pre-processing for environment variables
if (typeof window === "undefined" && process.env.NEXT_RUNTIME !== "edge") {
  const path = require("path");
  const { fileURLToPath } = require("url");
  const dotenv = require("dotenv");

  const __filename = fileURLToPath(import.meta.url);
  const __current_dir = path.dirname(__filename);
  project_root_dir = path.resolve(__current_dir, "..");

  // Loads the local .env files if neccessary
  if (!process.env["DATABASE_URL"]) {
    for (const file of [".env", ".env.local", ".env.development.local"]) {
      dotenv.config({ path: path.join(project_root_dir, file) });
    }
  }
}

const process_vercel_env =
  process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
const vercel_env =
  process_vercel_env === "development" ? "vercel_dev" : process_vercel_env;

const runtime_env =
  process.env.NODE_ENV === "test"
    ? "test"
    : process.env.NODE_ENV === "development"
      ? "local"
      : (vercel_env ?? process.env.ENV ?? "local");

const env = createEnv({
  server: {
    ENV: z.enum(["production", "preview", "vercel_dev", "test", "local"]),
    VERCEL_ENV: z.enum(["production", "preview", "vercel_dev"]).optional(),
    NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
    PROJECT_ROOT_DIR: z.string().nonempty().optional(),
    NODE_ENV: z.string().optional(),
    DATABASE_URL: z.string().nonempty(),
  },
  client: {
    NEXT_PUBLIC_ENV: z.enum([
      "production",
      "preview",
      "vercel_dev",
      "test",
      "local",
    ]),
    NEXT_PUBLIC_VERCEL_ENV: z
      .enum(["production", "preview", "vercel_dev"])
      .optional(),
  },
  runtimeEnv: {
    ENV: runtime_env,
    NEXT_PUBLIC_ENV: runtime_env,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    VERCEL_ENV: vercel_env,
    NEXT_PUBLIC_VERCEL_ENV: vercel_env,
    PROJECT_ROOT_DIR: project_root_dir,
    NODE_ENV: process.env.NODE_ENV,
  },
});

export default env;
