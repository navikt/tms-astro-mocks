import type { IncomingMessage, ServerResponse } from "node:http";
import { matchPath } from "./match.js";
import { sendResult } from "./respond.js";
import type {
  HttpMethod,
  MockContext,
  MockResult,
  ResolvedMock,
} from "./types.js";

type NextFn = (err?: unknown) => void;

export interface MiddlewareOptions {
  logger?: boolean;
}

/**
 * Read and parse a request body. JSON content is parsed to an object; other
 * non-empty bodies are returned as a string. Empty bodies yield `undefined`.
 */
function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const method = (req.method ?? "GET").toUpperCase();
    if (method === "GET" || method === "HEAD") {
      resolve(undefined);
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (raw.length === 0) {
        resolve(undefined);
        return;
      }
      const contentType = (req.headers["content-type"] ?? "").toLowerCase();
      if (contentType.includes("application/json")) {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(raw);
        }
        return;
      }
      resolve(raw);
    });
    req.on("error", reject);
  });
}

/**
 * Find the first mock matching the request method and pathname.
 */
export function findMatch(
  mocks: ResolvedMock[],
  method: string,
  pathname: string,
): { mock: ResolvedMock; params: Record<string, string> } | null {
  const upper = method.toUpperCase();
  for (const mock of mocks) {
    if (mock.method !== upper) continue;
    const params = matchPath(mock.path, pathname);
    if (params) return { mock, params };
  }
  return null;
}

/**
 * Create a connect-style middleware that intercepts requests matching any of
 * the provided mocks. Non-matching requests are passed through via `next()`.
 *
 * `getMocks` is a function so the middleware always sees the latest set of
 * mocks (e.g. after a hot reload).
 */
export function createMockMiddleware(
  getMocks: () => ResolvedMock[],
  options: MiddlewareOptions = {},
) {
  const log = options.logger !== false;

  return async function mockMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: NextFn,
  ): Promise<void> {
    try {
      const host = req.headers.host ?? "localhost";
      const url = new URL(req.url ?? "/", `http://${host}`);
      const method = (req.method ?? "GET").toUpperCase();

      const match = findMatch(getMocks(), method, url.pathname);
      if (!match) {
        next();
        return;
      }

      const { mock, params } = match;
      const body = await readBody(req);

      const ctx: MockContext = {
        req,
        url,
        method: method as HttpMethod,
        params,
        query: url.searchParams,
        body,
      };

      let result: MockResult;
      if (mock.handler) {
        result = await mock.handler(ctx);
      } else {
        result = mock.response;
      }

      if (log) {
        // eslint-disable-next-line no-console
        console.log(
          `[tms-astro-mocks] ${method} ${url.pathname} -> ${mock.status}`,
        );
      }

      await sendResult(res, mock, result);
    } catch (err) {
      next(err);
    }
  };
}
