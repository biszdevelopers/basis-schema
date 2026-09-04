import { z } from "zod";
import { APIError } from "./api.js";
export function defineEndpoint(endpoint) {
    return Object.freeze({ responseType: "json", ...endpoint });
}
function encodedPath(template, parameters) {
    const values = z.record(z.string(), z.unknown()).parse(parameters ?? {});
    const used = new Set();
    const path = template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, name) => {
        const value = values[name];
        if (typeof value !== "string" && typeof value !== "number") {
            throw new APIError("invalid_request", `Path parameter ${name} is required`);
        }
        used.add(name);
        return encodeURIComponent(String(value));
    });
    if (/\{[^}]+\}/.test(path)) {
        throw new APIError("invalid_request", "Endpoint path is invalid");
    }
    const unused = Object.keys(values).filter((name) => !used.has(name));
    if (unused.length) {
        throw new APIError("invalid_request", `Unknown path parameter: ${unused[0]}`);
    }
    return path;
}
function appendQuery(url, query) {
    if (query === undefined)
        return;
    const values = z.record(z.string(), z.unknown()).parse(query);
    for (const [name, value] of Object.entries(values)) {
        if (value === undefined || value === null)
            continue;
        const entries = Array.isArray(value) ? value : [value];
        for (const entry of entries)
            url.searchParams.append(name, String(entry));
    }
}
export class APIClient {
    requestFetch;
    baseUrl;
    getAccessToken;
    constructor(options) {
        this.baseUrl = new URL(options.baseUrl).toString();
        this.requestFetch = options.fetch ?? globalThis.fetch;
        this.getAccessToken = options.getAccessToken;
    }
    async request(endpoint, request = {}) {
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
            if (body !== undefined)
                headers.set("content-type", "application/json");
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
                let payload;
                try {
                    payload = await response.json();
                }
                catch {
                    throw new APIError("invalid_response", "API error response is not valid JSON", response.status || 502);
                }
                throw APIError.from(payload, new APIError("invalid_response", "API error response is invalid", response.status || 502));
            }
            if (endpoint.responseType === "empty" || response.status === 204) {
                return undefined;
            }
            const payload = await response.json();
            return (endpoint.responseSchema
                ? endpoint.responseSchema.parse(payload)
                : payload);
        }
        catch (error) {
            if (error instanceof APIError)
                throw error;
            if (error instanceof z.ZodError) {
                throw new APIError("invalid_request", error.issues[0]?.message ?? "API request is invalid");
            }
            throw error;
        }
    }
}
//# sourceMappingURL=client.js.map