import { z } from "zod";
export declare const responseCodeSchema: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
export type ResponseCode = z.infer<typeof responseCodeSchema>;
export declare const apiResponseEnvelopeSchema: z.ZodObject<{
    status: z.ZodNumber;
    code: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$loose>;
export declare const apiErrorResponseSchema: z.ZodObject<{
    status: z.ZodNumber;
    code: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    error: z.ZodString;
    error_description: z.ZodString;
}, z.core.$strip>;
export type APIErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export declare class APIResponse<T extends Record<string, unknown> = Record<string, never>> {
    readonly status: number;
    readonly code: ResponseCode;
    readonly payload: T;
    readonly headers: Readonly<Record<string, string>>;
    constructor(payload?: T, status?: number, code?: ResponseCode, headers?: Record<string, string>);
    toJSON(): T & {
        status: number;
        code: ResponseCode;
    };
}
export declare class APIError extends Error {
    readonly error: string;
    readonly status: number;
    readonly code: ResponseCode;
    constructor(error: string, message: string, status?: number, code?: ResponseCode);
    toJSON(): APIErrorResponse;
    static from(value: unknown, fallback?: APIError): APIError;
}
export declare function apiResponseSchema<T extends z.ZodRawShape>(shape: T): z.ZodObject<(keyof T & ("status" | "code") extends never ? { -readonly [P in keyof T]: T[P]; } & {
    status: z.ZodNumber;
    code: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
} : { [K in keyof { -readonly [P in keyof T]: T[P]; } as K extends "status" | "code" ? never : K]: { -readonly [P in keyof T]: T[P]; }[K]; } & {
    status: z.ZodNumber;
    code: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}) extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.core.$strip>;
//# sourceMappingURL=api.d.ts.map