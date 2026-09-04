import { z } from "zod";
import { APIError } from "./api.js";
import type { EndpointAuthentication } from "./auth.js";

type AnySchema = z.ZodType;
type Input<S> = S extends AnySchema ? z.input<S> : never;
type Output<S> = S extends AnySchema ? z.output<S> : undefined;

export interface EndpointDefinition<
  Path extends AnySchema | undefined = undefined,
  Query extends AnySchema | undefined = undefined,
  Body extends AnySchema | undefined = undefined,
  Response extends AnySchema | undefined = undefined,
> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  pathSchema?: Path;
  querySchema?: Query;
  bodySchema?: Body;
  responseSchema?: Response;
  responseType?: "json" | "empty";
  authentication?: EndpointAuthentication;
}

export function defineEndpoint<
  Path extends AnySchema | undefined = undefined,
  Query extends AnySchema | undefined = undefined,
  Body extends AnySchema | undefined = undefined,
  Response extends AnySchema | undefined = undefined,
>(
  endpoint: EndpointDefinition<Path, Query, Body, Response>,
): EndpointDefinition<Path, Query, Body, Response> {
  return Object.freeze({ responseType: "json", ...endpoint });
}

export type EndpointRequest<
  Endpoint extends EndpointDefinition<AnySchema | undefined, AnySchema | undefined, AnySchema | undefined, AnySchema | undefined>,
> = {
  path?: Input<Endpoint["pathSchema"]>;
  query?: Input<Endpoint["querySchema"]>;
  body?: Input<Endpoint["bodySchema"]>;
  signal?: AbortSignal;
};

export interface APIClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
}

function encodedPath(template: string, parameters: unknown): string {
  const values = z.record(z.string(), z.unknown()).parse(parameters ?? {});
  const used = new Set<string>();
  const path = template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, name: string) => {
    const value = values[name];
    if (typeof value !== "string" && typeof value !== "number") {
      throw new APIError(
        "invalid_request",
        `Path parameter ${name} is required`,
      );
    }
    used.add(name);
    return encodeURIComponent(String(value));
  });
  if (/\{[^}]+\}/.test(path)) {
    throw new APIError("invalid_request", "Endpoint path is invalid");
  }
  const unused = Object.keys(values).filter((name) => !used.has(name));
  if (unused.length) {
    throw new APIError(
      "invalid_request",
      `Unknown path parameter: ${unused[0]}`,
    );
  }
  return path;
}

function appendQuery(url: URL, query: unknown): void {
  if (query === undefined) return;
  const values = z.record(z.string(), z.unknown()).parse(query);
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries) url.searchParams.append(name, String(entry));
  }
}

export class APIClient {
  private readonly requestFetch: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly getAccessToken?: APIClientOptions["getAccessToken"];

  constructor(options: APIClientOptions) {
    this.baseUrl = new URL(options.baseUrl).toString();
    this.requestFetch = options.fetch ?? globalThis.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  async request<
    Path extends AnySchema | undefined,
    Query extends AnySchema | undefined,
    Body extends AnySchema | undefined,
    Response extends AnySchema | undefined,
  >(
    endpoint: EndpointDefinition<Path, Query, Body, Response>,
    request: {
      path?: Input<Path>;
      query?: Input<Query>;
      body?: Input<Body>;
      signal?: AbortSignal;
    } = {},
  ): Promise<Output<Response>> {
    try {
      const path = endpoint.pathSchema
        ? endpoint.pathSchema.parse(request.path)
        : request.path;
      const query = endpoint.querySchema
        ? endpoint.querySchema.parse(request.query)
        : request.query;
      const body = endpoint.bodySchema
        ? endpoint.bodySchema.parse(request.body)
        : request.body;
      const url = new URL(encodedPath(endpoint.path, path), this.baseUrl);
      appendQuery(url, query);
      const headers = new Headers({ accept: "application/json" });
      if (body !== undefined) headers.set("content-type", "application/json");
      if (endpoint.authentication?.type === "bearer") {
        const token = await this.getAccessToken?.();
        if (!token) {
          throw new APIError("unauthorized", "Bearer token is unavailable", 401);
        }
        headers.set("authorization", `Bearer ${token}`);
      }
      const response = await this.requestFetch(url, {
        method: endpoint.method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: request.signal,
      });
      if (!response.ok) {
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new APIError(
            "invalid_response",
            "API error response is not valid JSON",
            response.status || 502,
          );
        }
        throw APIError.from(
          payload,
          new APIError(
            "invalid_response",
            "API error response is invalid",
            response.status || 502,
          ),
        );
      }
      if (endpoint.responseType === "empty" || response.status === 204) {
        return undefined as Output<Response>;
      }
      const payload: unknown = await response.json();
      return (endpoint.responseSchema
        ? endpoint.responseSchema.parse(payload)
        : payload) as Output<Response>;
    } catch (error) {
      if (error instanceof APIError) throw error;
      if (error instanceof z.ZodError) {
        throw new APIError(
          "invalid_request",
          error.issues[0]?.message ?? "API request is invalid",
        );
      }
      throw error;
    }
  }
}
