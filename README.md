# tms-astro-mocks

En [Astro-integrasjon](https://docs.astro.build/en/guides/integrations-guide/) som serverer **mock-HTTP-endepunkter kun under utvikling**.

Mocks kobles inn via Astro sin `astro:server:setup`-hook, som kjører **utelukkende under `astro dev`**. Ingenting registreres for `astro build`, så produksjonsbygget påvirkes aldri.

- Deklarer mocks i `astro.config` — importer JSON for statiske data, eller JS/TS for dynamiske handlere
- Egendefinerte statuskoder, responsforsinkelser, dynamiske handlere og `:param`-stiparametere
- Kun for utvikling — havner aldri i produksjonsbygget
- Ingen runtime-avhengigheter

## Installasjon

```sh
pnpm add -D tms-astro-mocks
# eller: npm i -D tms-astro-mocks / yarn add -D tms-astro-mocks
```

## Bruk

Legg integrasjonen til i `astro.config.mjs` og send inn mock-definisjonene dine:

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

Kjør `astro dev`, så serveres mockene dine av utviklingsserveren.

## Organisere mocker i filer

Det finnes ingen auto-discovery — du importerer mock-filene dine og sender dem inn. Dette holder
integrasjonen liten og lar deg bruke ren JSON for statiske data og JS/TS for dynamisk logikk.

### Statiske data med JSON

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

### Dynamiske handlere med JS/TS

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

Definisjoner dedupliseres etter `method` + `path` — **den siste vinner**, så du kan
spre inn et importert sett og deretter overstyre en enkelt rute inline.

## Mock-definisjon

```ts
interface MockDefinition {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"; // standard "GET"
  path: string;         // støtter ":param", f.eks. "/users/:id"
  status?: number;      // standard 200 (ignoreres når en handler returnerer en Response)
  delay?: number;       // kunstig forsinkelse i ms, standard 0
  headers?: Record<string, string>;
  response?: unknown;   // statisk body; objekt -> JSON, streng -> tekst
  handler?: (ctx: MockContext) => MockResult | Promise<MockResult>;
}
```

### Handler-kontekst

```ts
interface MockContext {
  req: IncomingMessage;          // rå Node-request
  url: URL;                      // parset request-URL
  method: HttpMethod;            // HTTP-metode i store bokstaver
  params: Record<string, string>; // uttrukne stiparametere, f.eks. { id: "42" }
  query: URLSearchParams;        // parametere fra query-strengen
  body: unknown;                 // parset JSON-body, rå streng eller undefined
}
```

En handler kan returnere:

- et vanlig **objekt** → serialisert som JSON
- en **streng** → sendt som `text/plain`
- en standard **`Response`** → sendes videre som den er (dens status/headers/body vinner)

```ts
{
  path: "/teapot",
  handler: () => new Response("I'm a teapot", { status: 418 }),
}
```

## Integrasjonsvalg

```ts
interface Options {
  mocks?: MockDefinition[];     // mock-definisjonene som skal serveres
  enabled?: boolean;            // standard true — mocker kjører uansett kun under `astro dev`
  basePath?: string;            // prefiks som legges på hver mock-sti, f.eks. "/api"
  logger?: boolean;             // logg matchede requester (standard true)
}
```

Eksempel med en base-sti:

```js
mockServer({
  basePath: "/api",
  mocks: [{ path: "/health", response: { ok: true } }], // -> GET /api/health
});
```

## Slik fungerer det

Integrasjonen registrerer en Vite-middleware for utviklingsserveren inne i `astro:server:setup`-hooken.
Requester som matcher en mock (etter metode + sti) besvares direkte; alt annet
faller videre til Astro. Siden hooken kun kjører under `astro dev`, blir middlewaren
aldri en del av produksjonsbygget.

> **Merk:** mocker serveres på samme origin som Astro-utviklingsserveren. Hvis appen din
> henter data fra en annen origin (f.eks. en absolutt URL til en annen port), pek den
> URL-en mot utviklingsserverens origin slik at middlewaren kan fange opp den.

## Lisens

MIT
