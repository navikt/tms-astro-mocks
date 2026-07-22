import type { IncomingMessage } from "node:http";

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

/**
 * Context passed to a dynamic mock handler.
 */
export interface MockContext {
  /** The raw Node request. */
  req: IncomingMessage;
  /** The parsed request URL. */
  url: URL;
  /** The HTTP method of the request, upper-cased. */
  method: HttpMethod;
  /** Path parameters extracted from the matched route (e.g. `:id`). */
  params: Record<string, string>;
  /** Parsed query string parameters. */
  query: URLSearchParams;
  /** Parsed request body. JSON bodies are parsed to objects; otherwise a string, or `undefined`. */
  body: unknown;
}

/**
 * The value a handler (or `response`) may resolve to.
 *
 * - A standard `Response` is passed through as-is.
 * - Any other value is serialized: `string` is sent verbatim, everything else as JSON.
 */
export type MockResult = Response | unknown;

/**
 * A single mock endpoint definition.
 */
export interface MockDefinition {
  /** HTTP method to match. Defaults to `GET`. */
  method?: HttpMethod;
  /** Path to match. Supports `:param` segments, e.g. `/users/:id`. */
  path: string;
  /** Status code for static responses. Defaults to `200`. */
  status?: number;
  /** Artificial delay in milliseconds before responding. Defaults to `0`. */
  delay?: number;
  /** Response headers to set. */
  headers?: Record<string, string>;
  /** Static response body. Ignored when `handler` is provided. */
  response?: unknown;
  /** Dynamic handler. Takes precedence over `response`. */
  handler?: (ctx: MockContext) => MockResult | Promise<MockResult>;
}

/**
 * Options for the `mockServer` integration.
 */
export interface Options {
  /** Mock definitions to serve. Import JSON or JS/TS files in `astro.config` and pass them here. */
  mocks?: MockDefinition[];
  /**
   * Whether the mock server is enabled. Defaults to `true` (mocks only ever run during `astro dev`).
   * Set to `false` to disable without removing the integration.
   */
  enabled?: boolean;
  /** Optional path prefix applied to every mock path, e.g. `/api`. */
  basePath?: string;
  /** Log matched requests to the console. Defaults to `true`. */
  logger?: boolean;
}

/**
 * A mock definition after normalization, with defaults and the base path applied.
 */
export interface ResolvedMock {
  method: HttpMethod;
  path: string;
  status: number;
  delay: number;
  headers: Record<string, string>;
  response?: unknown;
  handler?: (ctx: MockContext) => MockResult | Promise<MockResult>;
}
