import path from "node:path";

import { organizeTaskStorage } from "../web/server.js";

const outputDirectory = process.env.ARIOSO_OUTPUT_DIR ?? "outputs";
const taskDirectory = path.resolve(outputDirectory, "tasks");
const result = await organizeTaskStorage(taskDirectory);

console.log(
  `Organized ${result.migratedTasks} task(s) and ${result.migratedAudioFiles} audio file(s) in ${taskDirectory}.`,
);
