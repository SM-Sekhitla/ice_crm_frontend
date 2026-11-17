import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers: Record<string, (event: any) => void> = {};
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockResolvedValue(new Response("online"));
  const self = {
    location: { origin: "https://crm.example.com" },
    addEventListener: (name: string, callback: (event: any) => void) => {
      handlers[name] = callback;
    },
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    skipWaiting: vi.fn(),
  };
  const source = readFileSync(
    new URL("./service-worker.js", import.meta.url),
    "utf8",
  )
    .replace(
      "self.__CRM_PRECACHE__",
      JSON.stringify(["/offline.html", "/assets/app.js"]),
    )
    .replace("self.__CRM_CACHE_NAME__", JSON.stringify("crm-static-current"));
  vm.runInNewContext(source, {
    self,
    caches,
    fetch,
    URL,
    Response,
    Set,
    Promise,
  });
  function request(
    path: string,
    options: { method?: string; mode?: string; headers?: HeadersInit } = {},
  ) {
    const event = {
      request: {
        url: new URL(path, self.location.origin).href,
        method: "GET",
        mode: "cors",
        ...options,
        headers: new Headers(options.headers),
      },
      respondWith: vi.fn(),
    };
    handlers.fetch(event);
    return event;
  }
  return { handlers, cache, caches, fetch, self, request };
}

describe("PWA cache isolation", () => {
  it("precaches only the explicit public app assets", async () => {
    const w = worker();
    const waitUntil = vi.fn();
    w.handlers.install({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(w.cache.addAll).toHaveBeenCalledWith([
      "/offline.html",
      "/assets/app.js",
    ]);
  });
  it("never intercepts API traffic, writes, cross-origin or authenticated requests", () => {
    const w = worker();
    for (const [path, options] of [
      ["/api/v1/contacts", {}],
      ["/api/v1/email-images/abc", {}],
      ["/contacts", { method: "POST" }],
      ["https://api.example.com/contacts", {}],
      [
        "/assets/app.js",
        { headers: { Authorization: "Bearer private-token" } },
      ],
    ] as const)
      expect(w.request(path, options).respondWith).not.toHaveBeenCalled();
    expect(w.caches.open).not.toHaveBeenCalled();
    expect(w.fetch).not.toHaveBeenCalled();
  });
  it("serves known versioned assets from this build's cache", async () => {
    const w = worker();
    w.cache.match.mockResolvedValue(new Response("cached script"));
    const event = w.request("/assets/app.js");
    const response = await event.respondWith.mock.calls[0][0];
    expect(await response.text()).toBe("cached script");
    expect(w.fetch).not.toHaveBeenCalled();
    expect(w.caches.open).toHaveBeenCalledWith("crm-static-current");
  });
  it("does not intercept arbitrary downloads, token URLs or unknown assets", () => {
    const w = worker();
    for (const path of [
      "/export.csv",
      "/assets/unknown.js",
      "/assets/app.js?token=secret",
      "/activate?token=secret",
    ])
      expect(w.request(path).respondWith).not.toHaveBeenCalled();
  });
  it("fetches navigations fresh and never stores their responses", async () => {
    const w = worker();
    const event = w.request("/activate?token=secret", { mode: "navigate" });
    expect(await (await event.respondWith.mock.calls[0][0]).text()).toBe(
      "online",
    );
    expect(w.caches.open).not.toHaveBeenCalled();
  });
  it("shows a generic offline screen rather than a cached user's page", async () => {
    const w = worker();
    w.fetch.mockRejectedValue(new Error("offline"));
    w.cache.match.mockResolvedValue(new Response("Reconnect to CRM"));
    const event = w.request("/contacts", { mode: "navigate" });
    expect(await (await event.respondWith.mock.calls[0][0]).text()).toBe(
      "Reconnect to CRM",
    );
    expect(w.cache.match).toHaveBeenCalledWith("/offline.html");
  });
  it("removes only obsolete CRM caches and waits for user approval to update", async () => {
    const w = worker();
    w.caches.keys.mockResolvedValue([
      "crm-static-old",
      "crm-static-current",
      "other-app",
    ]);
    const waitUntil = vi.fn();
    w.handlers.activate({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith("crm-static-old");
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
    w.handlers.message({ data: { type: "APPLY_UPDATE" } });
    expect(w.self.skipWaiting).toHaveBeenCalledOnce();
  });
});
