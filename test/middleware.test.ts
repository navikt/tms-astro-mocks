import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { createMockMiddleware, findMatch } from "../src/middleware.js";
import { resolveMocks } from "../src/loader.js";
import type { ResolvedMock } from "../src/types.js";

function makeReq(
  method: string,
  url: string,
  body?: string,
  headers: Record<string, string> = {},
): IncomingMessage {
  const req = new EventEmitter() as unknown as IncomingMessage & EventEmitter;
  (req as { method?: string }).method = method;
  (req as { url?: string }).url = url;
  (req as { headers: Record<string, string> }).headers = {
    host: "localhost",
    ...headers,
  };
  // Emit body on next tick so listeners are attached first.
  queueMicrotask(() => {
    if (body !== undefined) req.emit("data", Buffer.from(body));
    req.emit("end");
  });
  return req;
}

interface CapturedRes {
  res: ServerResponse;
  done: Promise<void>;
  get: () => {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  };
}

function makeRes(): CapturedRes {
  const headers: Record<string, string> = {};
  let body = "";
  let statusCode = 200;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(v: number) {
      statusCode = v;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    end(chunk?: string | Buffer) {
      if (chunk) body += chunk.toString();
      resolveDone();
    },
  } as unknown as ServerResponse;

  return {
    res,
    done,
    get: () => ({ statusCode, headers, body }),
  };
}

const mocks: ResolvedMock[] = resolveMocks([
  { path: "/ping", response: "pong" },
  { path: "/users/:id", handler: (ctx) => ({ id: ctx.params.id }) },
  { path: "/create", method: "POST", handler: (ctx) => ctx.body, status: 201 },
  { path: "/slow", response: "ok", delay: 30 },
  {
    path: "/custom",
    handler: () => new Response("hi", { status: 418, headers: { "X-A": "b" } }),
  },
]);

describe("findMatch", () => {
  it("matches method and path", () => {
    expect(findMatch(mocks, "GET", "/ping")?.mock.response).toBe("pong");
  });
  it("returns null when method differs", () => {
    expect(findMatch(mocks, "POST", "/ping")).toBeNull();
  });
  it("extracts params", () => {
    expect(findMatch(mocks, "GET", "/users/9")?.params).toEqual({ id: "9" });
  });
});

describe("createMockMiddleware", () => {
  const mw = createMockMiddleware(() => mocks, { logger: false });

  it("responds with a static string", async () => {
    const req = makeReq("GET", "/ping");
    const cap = makeRes();
    await mw(req, cap.res, () => {});
    await cap.done;
    const out = cap.get();
    expect(out.statusCode).toBe(200);
    expect(out.body).toBe("pong");
  });

  it("responds from a handler with path params as JSON", async () => {
    const req = makeReq("GET", "/users/42");
    const cap = makeRes();
    await mw(req, cap.res, () => {});
    await cap.done;
    const out = cap.get();
    expect(JSON.parse(out.body)).toEqual({ id: "42" });
    expect(out.headers["Content-Type"]).toContain("application/json");
  });

  it("parses a JSON body and honors custom status", async () => {
    const req = makeReq("POST", "/create", JSON.stringify({ a: 1 }), {
      "content-type": "application/json",
    });
    const cap = makeRes();
    await mw(req, cap.res, () => {});
    await cap.done;
    const out = cap.get();
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).toEqual({ a: 1 });
  });

  it("applies a response delay", async () => {
    const req = makeReq("GET", "/slow");
    const cap = makeRes();
    const start = Date.now();
    await mw(req, cap.res, () => {});
    await cap.done;
    expect(Date.now() - start).toBeGreaterThanOrEqual(25);
  });

  it("passes through a standard Response", async () => {
    const req = makeReq("GET", "/custom");
    const cap = makeRes();
    await mw(req, cap.res, () => {});
    await cap.done;
    const out = cap.get();
    expect(out.statusCode).toBe(418);
    expect(out.headers["x-a"]).toBe("b");
    expect(out.body).toBe("hi");
  });

  it("calls next() when nothing matches", async () => {
    const req = makeReq("GET", "/nope");
    const cap = makeRes();
    let nexted = false;
    await mw(req, cap.res, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
  });
});
