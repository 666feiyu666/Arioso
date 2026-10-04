import "dotenv/config";

import path from "node:path";

import { assembleCompletedOrchestralTasks } from "../web/task-store.js";

const outputDirectory = process.env.ARIOSO_OUTPUT_DIR ?? "outputs";
const taskDirectory = path.resolve(outputDirectory, "tasks");
const result = await assembleCompletedOrchestralTasks(taskDirectory);

console.log(`Assembled orchestral tasks: ${result.assembledTasks}`);
console.log(`Skipped tasks: ${result.skippedTasks}`);
for (const failure of result.failures) {
  console.error(`${failure.taskId}: ${failure.error}`);
}
if (result.failures.length) process.exitCode = 1;
