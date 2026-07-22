/**
 * Normalize a path: ensure a single leading slash and no trailing slash (except root).
 */
export function normalizePath(path: string): string {
  let p = path.trim();
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/**
 * Join a base path with a mock path, normalizing the result.
 */
export function joinPath(basePath: string | undefined, path: string): string {
  const base = basePath ? normalizePath(basePath) : "";
  const joined = normalizePath((base === "/" ? "" : base) + normalizePath(path));
  return joined;
}

/**
 * Attempt to match a concrete request pathname against a mock path pattern.
 *
 * Pattern segments starting with `:` are treated as named parameters, e.g.
 * `/users/:id` matches `/users/42` yielding `{ id: "42" }`.
 *
 * Returns the extracted params if the path matches, or `null` otherwise.
 */
export function matchPath(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const patternSegments = splitSegments(normalizePath(pattern));
  const pathSegments = splitSegments(normalizePath(pathname));

  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const pat = patternSegments[i]!;
    const seg = pathSegments[i]!;

    if (pat.startsWith(":")) {
      const name = pat.slice(1);
      if (name.length === 0) return null;
      params[name] = decodeURIComponent(seg);
      continue;
    }

    if (pat !== seg) return null;
  }

  return params;
}

function splitSegments(path: string): string[] {
  if (path === "/") return [];
  return path.split("/").filter((s) => s.length > 0);
}
