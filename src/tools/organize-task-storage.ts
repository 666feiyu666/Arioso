import { outputPaths } from "../config/paths.js";
import { organizeTaskStorage } from "../web/task-store.js";

const taskDirectory = outputPaths().tasks;
const result = await organizeTaskStorage(taskDirectory);

console.log(
  `Organized ${result.migratedTasks} task(s) and ${result.migratedAudioFiles} audio file(s) in ${taskDirectory}.`,
);
