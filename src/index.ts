import type { AstroIntegration } from "astro";
import { resolveMocks } from "./loader.js";
import { createMockMiddleware } from "./middleware.js";
import type { Options, ResolvedMock } from "./types.js";

export type {
  HttpMethod,
  MockContext,
  MockDefinition,
  MockResult,
  Options,
  ResolvedMock,
} from "./types.js";

const NAME = "tms-astro-mocks";

/**
 * Astro integration that serves mock HTTP endpoints during development only.
 *
 * Mocks are declared via the `mocks` option. Import JSON or JS/TS files in your
 * `astro.config` and pass them in:
 *
 * ```js
 * import users from "./mock/users.json" with { type: "json" };
 * import { productMocks } from "./mock/products";
 * import mockServer from "tms-astro-mocks";
 *
 * export default defineConfig({
 *   integrations: [mockServer({ mocks: [...users, ...productMocks] })],
 * });
 * ```
 *
 * The mocks are wired through Astro's `astro:server:setup` hook, which runs
 * exclusively during `astro dev`. Nothing is registered for `astro build`, so
 * production output is never affected.
 */
export default function mockServer(options: Options = {}): AstroIntegration {
  const enabled = options.enabled ?? true;

  let mocks: ResolvedMock[] = [];
  const getMocks = () => mocks;

  return {
    name: NAME,
    hooks: {
      "astro:server:setup": ({ server, logger }) => {
        if (!enabled) {
          logger.info("disabled via `enabled: false`; no mocks registered.");
          return;
        }

        mocks = resolveMocks(options.mocks ?? [], options.basePath);

        server.middlewares.use(
          createMockMiddleware(getMocks, { logger: options.logger }),
        );

        logger.info(`serving ${mocks.length} mock endpoint(s) (dev only).`);
      },
    },
  };
}
