import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all envs regardless of the `VITE_` prefix.
    const env = loadEnv(mode, process.cwd(), "");

    return {
        test: {
            globals: true,
            environment: "node",
            testTimeout: 30000,
            hookTimeout: 30000,
            include: ["src/tests/**/*.test.ts"],
            env: env, // Inject loaded env vars
        },
    };
});
