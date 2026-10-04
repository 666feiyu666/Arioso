import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

class Element {
  hidden = false;
  disabled = false;
  checked = false;
  value = "";
  textContent = "";
  innerHTML = "";
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  children = new Map<string, Element>();
  listeners = new Map<string, Array<() => unknown>>();
  classList = { contains: () => false, toggle: () => {} };
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) || null; }
  removeAttribute(key: string) { this.attributes.delete(key); }
  addEventListener(event: string, handler: () => unknown) {
    const handlers = this.listeners.get(event) || [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }
  async emit(event: string) {
    await Promise.all((this.listeners.get(event) || []).map((handler) => handler()));
    await Promise.resolve();
  }
  querySelector(selector: string): Element {
    if (!this.children.has(selector)) this.children.set(selector, new Element());
    return this.children.get(selector)!;
  }
  querySelectorAll() { return []; }
  focus() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { height: 120 }; }
}

class Audio extends Element {
  src = "";
  paused = true;
  ended = false;
  error: unknown = null;
  currentTime = 0;
  rejectPlay = false;
  load() { this.paused = true; this.ended = false; this.currentTime = 0; }
  async play() {
    if (this.rejectPlay) throw Object.assign(new Error("User gesture required"), { name: "NotAllowedError" });
    this.paused = false;
    this.ended = false;
    await this.emit("playing");
  }
  pause() { this.paused = true; void this.emit("pause"); }
  async finish() { this.ended = true; this.paused = true; await this.emit("ended"); }
}

function track(id: string, order: number, admission = "candidate", audio = true) {
  return { id, order, title: id, admission, status: audio ? "completed" : "generating", audioFile: audio ? `${id}.wav` : undefined, durationSeconds: audio ? 110 : undefined, targetDurationSeconds: 120 };
}

function album() {
  return { id: "album", title: "Late Night Noir", description: "Late night noir jazz for relaxation", compositionMode: "album", workflowType: "04-album", status: "completed", lyriaModel: "lyria-3.5", updatedAt: "2026-10-04T08:00:00Z", albumCandidateCount: 14, albumPlan: { albumTitle: "Late Night Noir", albumMind: "Quiet variations after midnight." }, albumTracks: [track("one", 1), track("two", 2), track("three", 3)], albumPlaylist: [] as string[] };
}

async function interfaceHarness(initial = album()) {
  const source = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
  const nodes = new Map<string, Element>();
  const audio = new Audio();
  nodes.set("#audio-player", audio);
  const vocals = ["auto", "instrumental", "vocals"].map((value) => Object.assign(new Element(), { value, checked: value === "auto" }));
  const root = Object.assign(new Element(), { style: { setProperty() {} }, lang: "zh-CN" });
  const document = {
    documentElement: root, title: "",
    querySelector(selector: string) {
      if (!nodes.has(selector)) nodes.set(selector, new Element());
      return nodes.get(selector)!;
    },
    querySelectorAll(selector: string) { return selector.includes('name="vocal-mode"') ? vocals : []; },
  };
  const requests: Array<{ url: string; method: string; body: unknown }> = [];
  let stored = structuredClone(initial);
  const fetch = async (url: string, options: { method?: string; body?: string } = {}) => {
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : undefined;
    requests.push({ url, method, body });
    let result: unknown = {};
    if (url === "/api/capabilities") result = { apiVersion: 5, workflows: ["01-general", "02-jazz", "03-orchestral", "04-album"], backgroundMusicProducer: { denoiser: "denoising-historical-recordings" } };
    else if (url === "/api/settings") result = { language: "zh-CN", credentials: { openai: { configured: false }, gemini: { configured: false } } };
    else if (url === "/api/tasks" && method === "GET") result = [stored];
    else if (url === "/api/tasks" && method === "POST") result = stored;
    else if (method === "PATCH") {
      const id = url.split("/").at(-1);
      const target = stored.albumTracks.find((item) => item.id === id)!;
      target.admission = body.admission;
      stored.albumPlaylist = stored.albumPlaylist.filter((item) => item !== id);
      if (body.admission === "included") stored.albumPlaylist.push(id!);
      result = stored;
    }
    return { ok: true, json: async () => structuredClone(result) };
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction("document", "window", "ResizeObserver", "fetch", "setInterval", `${source}\nreturn {state, elements, openAlbum, startAlbum, playAlbumTrack, playTask, stepAlbumTrack, changeAdmission, showComposer, submitTask, renderAlbumDetail};`);
  const api = await run(document, { scrollTo() {} }, class { observe() {} }, fetch, () => 0);
  await Promise.resolve();
  await Promise.resolve();
  api.state.tasks = [structuredClone(initial)];
  return { api, audio, nodes, requests };
}

describe("album listening interface", () => {
  it("blocks producer creation against an older server", async () => {
    const { api, requests } = await interfaceHarness();
    api.showComposer("none", "album", "04-album");
    api.state.supportsBackgroundMusicProducer = false;
    api.elements.albumProduction.value = "producer";
    await api.submitTask({ preventDefault() {} });
    expect(requests.some((item) => item.url === "/api/tasks" && item.method === "POST")).toBe(false);
  });
  it("submits the producer choice and explains the mono output", async () => {
    const { api, requests } = await interfaceHarness();
    api.showComposer("none", "album", "04-album");
    api.elements.albumProduction.value = "producer";
    await api.elements.albumProduction.emit("change");
    expect(api.elements.albumProductionHelp.hidden).toBe(false);
    api.elements.input.value = "Quiet reading background music";
    api.elements.albumCount.value = "14";
    api.elements.albumDuration.value = "35";
    await api.submitTask({ preventDefault() {} });
    expect(requests.find((item) => item.url === "/api/tasks" && item.method === "POST")?.body).toMatchObject({ produceAlbum: true });
  });
  it("opens a generated album as candidates without silently admitting tracks", async () => {
    const { api, audio } = await interfaceHarness();
    await api.openAlbum("album");
    expect(api.state.albumViewScope).toBe("candidate");
    expect(audio.src).toBe("/api/tasks/album/album/tracks/one/audio");
    expect(audio.paused).toBe(false);
    expect(api.state.tasks[0].albumPlaylist).toEqual([]);
    expect(api.state.tasks[0].albumTracks.every((item: { admission: string }) => item.admission === "candidate")).toBe(true);
    expect(api.elements.form.hidden).toBe(true);
  });

  it("plays only included audio in the explicit playlist order and stops at the end", async () => {
    const initial = album();
    initial.albumTracks[0]!.admission = "included";
    initial.albumTracks[2]!.admission = "included";
    initial.albumPlaylist = ["three", "one"];
    const { api, audio } = await interfaceHarness(initial);
    await api.openAlbum("album");
    expect(api.state.albumViewScope).toBe("included");
    expect(api.state.playingAlbumTrackId).toBe("three");
    await audio.finish();
    expect(api.state.playingAlbumTrackId).toBe("one");
    await audio.finish();
    expect(api.state.playingAlbumTrackId).toBe("one");
    expect(audio.ended).toBe(true);
    expect(api.elements.playerNext.disabled).toBe(true);
  });

  it("skips excluded and unfinished candidates during continuous listening", async () => {
    const initial = album();
    initial.albumTracks = [track("pending", 1, "candidate", false), track("one", 2), track("excluded", 3, "excluded"), track("two", 4)];
    const { api, audio } = await interfaceHarness(initial);
    await api.openAlbum("album");
    expect(api.state.playingAlbumTrackId).toBe("one");
    await audio.finish();
    expect(api.state.playingAlbumTrackId).toBe("two");
    await api.elements.playerPrevious.emit("click");
    expect(api.state.playingAlbumTrackId).toBe("one");
  });

  it("continues after the playing track is removed from the included playlist", async () => {
    const initial = album();
    initial.albumTracks.forEach((item) => { item.admission = "included"; });
    initial.albumPlaylist = ["one", "two", "three"];
    const { api, audio, requests } = await interfaceHarness(initial);
    await api.openAlbum("album");
    await api.changeAdmission("album", "one", "excluded", new Element());
    expect(requests.at(-1)).toEqual({ url: "/api/tasks/album/album/tracks/one", method: "PATCH", body: { admission: "excluded" } });
    expect(api.state.tasks[0].albumPlaylist).toEqual(["two", "three"]);
    await audio.finish();
    expect(api.state.playingAlbumTrackId).toBe("two");
  });

  it("keeps autoplay rejection recoverable through the record control", async () => {
    const { api, audio } = await interfaceHarness();
    audio.rejectPlay = true;
    await api.openAlbum("album");
    expect(api.state.playbackStatus).toBe("paused");
    expect(api.elements.message.textContent).toContain("点击唱片");
    audio.rejectPlay = false;
    await api.elements.playerToggle.emit("click");
    expect(audio.paused).toBe(false);
    expect(api.state.playbackStatus).toBe("playing");
  });

  it("creates full-song instrumental candidates using the album controls", async () => {
    const { api, requests } = await interfaceHarness();
    api.showComposer("none", "album", "04-album");
    api.elements.input.value = "Late night noir jazz for relaxation";
    api.elements.albumCount.value = "14";
    api.elements.albumDuration.value = "35";
    await api.submitTask({ preventDefault() {} });
    expect(requests.find((item) => item.url === "/api/tasks" && item.method === "POST")?.body).toMatchObject({ compositionMode: "album", workflowType: "04-album", candidateCount: 14, targetTotalMinutes: 35, mode: "generate", lyriaModel: "lyria-3.5", vocalMode: "instrumental" });
  });
});
