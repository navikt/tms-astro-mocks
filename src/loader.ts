import { joinPath } from "./match.js";
import type { HttpMethod, MockDefinition, ResolvedMock } from "./types.js";

const DEFAULT_METHOD: HttpMethod = "GET";

function stableKey(method: HttpMethod, path: string): string {
  return `${method} ${path}`;
}

/**
 * Normalize a single definition into a `ResolvedMock`, applying defaults and
 * the base path prefix.
 */
export function normalizeMock(
  def: MockDefinition,
  basePath?: string,
): ResolvedMock {
  if (!def.path) {
    throw new Error("[tms-astro-mocks] mock definition is missing a `path`.");
  }
  const method = (def.method ?? DEFAULT_METHOD).toUpperCase() as HttpMethod;
  return {
    method,
    path: joinPath(basePath, def.path),
    status: def.status ?? 200,
    delay: def.delay ?? 0,
    headers: def.headers ? { ...def.headers } : {},
    response: def.response,
    handler: def.handler,
  };
}

/**
 * Resolve the configured mock definitions into an ordered list of `ResolvedMock`.
 *
 * Definitions are deduplicated by `method` + `path`: when two definitions share
 * the same key, the later one wins. This lets consumers spread an imported set
 * and then override individual routes inline.
 */
export function resolveMocks(
  mocks: MockDefinition[],
  basePath?: string,
): ResolvedMock[] {
  const byKey = new Map<string, ResolvedMock>();
  for (const def of mocks) {
    const resolved = normalizeMock(def, basePath);
    byKey.set(stableKey(resolved.method, resolved.path), resolved);
  }
  return [...byKey.values()];
}
