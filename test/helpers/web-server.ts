import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAriosoServer } from "../../src/web/server.js";

interface TestServer {
  root: string;
  server: Server;
  baseUrl: string;
}

export async function withWebServer(
  test: (context: TestServer) => Promise<void>,
  options: {
    prepare?: (root: string) => Promise<void>;
    environment?: NodeJS.ProcessEnv;
  } = {},
): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "arioso-web-test-"));
  let server: Server | undefined;
  try {
    await options.prepare?.(root);
    server = await createAriosoServer({
      envPath: path.join(root, ".env"),
      preferencesPath: path.join(root, "settings.json"),
      environment: { ...options.environment, ARIOSO_OUTPUT_DIR: path.join(root, "outputs") },
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await test({ root, server, baseUrl });
  } finally {
    if (server?.listening) {
      const closed = once(server, "close");
      server.close();
      await closed;
    }
    await rm(root, { recursive: true, force: true });
  }
}
