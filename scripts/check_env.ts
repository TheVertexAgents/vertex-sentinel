import { validateEnv } from "../src/logic/env.js";

try {
  validateEnv();
  console.log("✅ Environment validation successful.");
} catch (error) {
  console.error("❌ Environment validation failed:");
  console.error(error);
  process.exit(1);
}
