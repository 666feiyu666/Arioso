import "dotenv/config";

import { outputPaths } from "../config/paths.js";
import { assembleCompletedOrchestralTasks } from "../web/task-store.js";

const taskDirectory = outputPaths().tasks;
const result = await assembleCompletedOrchestralTasks(taskDirectory);

console.log(`Assembled orchestral tasks: ${result.assembledTasks}`);
console.log(`Skipped tasks: ${result.skippedTasks}`);
for (const failure of result.failures) {
  console.error(`${failure.taskId}: ${failure.error}`);
}
if (result.failures.length) process.exitCode = 1;
