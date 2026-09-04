import { z } from "zod";
import type { EndpointAuthentication } from "./auth.js";
type AnySchema = z.ZodType;
type Input<S> = S extends AnySchema ? z.input<S> : never;
type Output<S> = S extends AnySchema ? z.output<S> : undefined;
export interface EndpointDefinition<Path extends AnySchema | undefined = undefined, Query extends AnySchema | undefined = undefined, Body extends AnySchema | undefined = undefined, Response extends AnySchema | undefined = undefined> {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    pathSchema?: Path;
    querySchema?: Query;
    bodySchema?: Body;
    responseSchema?: Response;
    responseType?: "json" | "empty";
    authentication?: EndpointAuthentication;
}
export declare function defineEndpoint<Path extends AnySchema | undefined = undefined, Query extends AnySchema | undefined = undefined, Body extends AnySchema | undefined = undefined, Response extends AnySchema | undefined = undefined>(endpoint: EndpointDefinition<Path, Query, Body, Response>): EndpointDefinition<Path, Query, Body, Response>;
export type EndpointRequest<Endpoint extends EndpointDefinition<AnySchema | undefined, AnySchema | undefined, AnySchema | undefined, AnySchema | undefined>> = {
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
export declare class APIClient {
    private readonly requestFetch;
    private readonly baseUrl;
    private readonly getAccessToken?;
    constructor(options: APIClientOptions);
    request<Path extends AnySchema | undefined, Query extends AnySchema | undefined, Body extends AnySchema | undefined, Response extends AnySchema | undefined>(endpoint: EndpointDefinition<Path, Query, Body, Response>, request?: {
        path?: Input<Path>;
        query?: Input<Query>;
        body?: Input<Body>;
        signal?: AbortSignal;
    }): Promise<Output<Response>>;
}
export {};
//# sourceMappingURL=client.d.ts.map