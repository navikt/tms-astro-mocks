# tms-astro-mocks

An [Astro integration](https://docs.astro.build/en/guides/integrations-guide/) that serves **mock HTTP endpoints during development only**.

Mocks are wired through Astro's `astro:server:setup` hook, which runs **exclusively during `astro dev`**. Nothing is registered for `astro build`, so your production output is never affected.

- ⚙️ Declare mocks in `astro.config` — import JSON for static data, or JS/TS for dynamic handlers
- 🎛️ Custom status codes, response delays, dynamic handlers, and `:param` path params
- 🔒 Dev-only by design — never bundled into production
- 🪶 Zero runtime dependencies

## Installation

```sh
pnpm add -D tms-astro-mocks
# or: npm i -D tms-astro-mocks / yarn add -D tms-astro-mocks
```

## Usage

Add the integration to `astro.config.mjs` and pass your mock definitions:

```js
import { defineConfig } from "astro/config";
import mockServer from "tms-astro-mocks";

export default defineConfig({
  integrations: [
    mockServer({
      mocks: [
        { path: "/ping", response: "pong" },
        { path: "/health", response: { ok: true } },
      ],
    }),
  ],
});
```

Run `astro dev` and your mocks are served by the dev server.

## Organizing mocks in files

There's no auto-discovery — you `import` your mock files and pass them in. This keeps the
integration tiny and lets you use plain JSON for static data and JS/TS for dynamic logic.

### Static data with JSON

```json
// mock/users.json
[
  { "path": "/users", "response": [{ "id": 1, "name": "Ada" }] },
  { "path": "/version", "response": { "version": "1.2.3" } }
]
```

```js
// astro.config.mjs
import users from "./mock/users.json" with { type: "json" };
import mockServer from "tms-astro-mocks";

export default defineConfig({
  integrations: [mockServer({ mocks: users })],
});
```

### Dynamic handlers with JS/TS

```ts
// mock/products.ts
import type { MockDefinition } from "tms-astro-mocks";

export const productMocks: MockDefinition[] = [
  {
    path: "/products/:id",
    handler: (ctx) => ({ id: ctx.params.id, name: "Widget" }),
  },
  {
    path: "/products",
    method: "POST",
    status: 201,
    handler: (ctx) => ({ created: ctx.body }),
  },
];
```

```js
// astro.config.mjs
import users from "./mock/users.json" with { type: "json" };
import { productMocks } from "./mock/products";
import mockServer from "tms-astro-mocks";

export default defineConfig({
  integrations: [
    mockServer({
      mocks: [
        ...users,
        ...productMocks,
        { path: "/ping", response: "pong" },
      ],
    }),
  ],
});
```

Definitions are deduplicated by `method` + `path` — **the last one wins**, so you can
spread an imported set and then override a single route inline.

## Mock definition

```ts
interface MockDefinition {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"; // default "GET"
  path: string;         // supports ":param", e.g. "/users/:id"
  status?: number;      // default 200 (ignored when a handler returns a Response)
  delay?: number;       // artificial delay in ms, default 0
  headers?: Record<string, string>;
  response?: unknown;   // static body; object -> JSON, string -> text
  handler?: (ctx: MockContext) => MockResult | Promise<MockResult>;
}
```

### Handler context

```ts
interface MockContext {
  req: IncomingMessage;          // raw Node request
  url: URL;                      // parsed request URL
  method: HttpMethod;            // upper-cased HTTP method
  params: Record<string, string>; // extracted path params, e.g. { id: "42" }
  query: URLSearchParams;        // query string params
  body: unknown;                 // parsed JSON body, raw string, or undefined
}
```

A handler may return:

- a plain **object** → serialized as JSON
- a **string** → sent as `text/plain`
- a standard **`Response`** → passed through as-is (its status/headers/body win)

```ts
{
  path: "/teapot",
  handler: () => new Response("I'm a teapot", { status: 418 }),
}
```

## Integration options

```ts
interface Options {
  mocks?: MockDefinition[];     // the mock definitions to serve
  enabled?: boolean;            // default true — mocks only ever run during `astro dev`
  basePath?: string;            // prefix applied to every mock path, e.g. "/api"
  logger?: boolean;             // log matched requests (default true)
}
```

Example with a base path:

```js
mockServer({
  basePath: "/api",
  mocks: [{ path: "/health", response: { ok: true } }], // -> GET /api/health
});
```

## How it works

The integration registers a Vite dev-server middleware inside the `astro:server:setup`
hook. Requests matching a mock (by method + path) are answered directly; everything else
falls through to Astro. Because the hook only runs during `astro dev`, the middleware is
never part of a production build.

> **Note:** mocks are served on the same origin as the Astro dev server. If your app
> fetches data from a different origin (e.g. an absolute URL to another port), point that
> URL at the dev server origin so the middleware can intercept it.

## License

MIT
