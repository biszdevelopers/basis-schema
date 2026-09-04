import { z } from "zod";
export const responseCodeSchema = z.union([
    z.string({ error: "Response code must be text or a number" }).min(1, {
        error: "Response code cannot be empty",
    }),
    z.number({ error: "Response code must be text or a number" }).int({
        error: "Numeric response code must be an integer",
    }),
]);
const httpStatusSchema = z
    .number({ error: "HTTP status must be a number" })
    .int({ error: "HTTP status must be an integer" })
    .min(100, { error: "HTTP status must be between 100 and 599" })
    .max(599, { error: "HTTP status must be between 100 and 599" });
export const apiResponseEnvelopeSchema = z.looseObject({
    status: httpStatusSchema,
    code: responseCodeSchema,
});
export const apiErrorResponseSchema = z.object({
    status: httpStatusSchema,
    code: responseCodeSchema,
    error: z.string({ error: "API error name must be text" }).min(1, {
        error: "API error name is required",
    }),
    error_description: z
        .string({ error: "API error description must be text" })
        .min(1, { error: "API error description is required" }),
});
const payloadSchema = z.record(z.string(), z.unknown());
export class APIResponse {
    status;
    code;
    payload;
    headers;
    constructor(payload = {}, status = 200, code = status, headers = {}) {
        this.status = status;
        this.code = code;
        payloadSchema.parse(payload);
        httpStatusSchema.parse(status);
        responseCodeSchema.parse(code);
        if ("status" in payload || "code" in payload) {
            throw new TypeError("API response payload cannot contain status or code");
        }
        this.payload = payload;
        this.headers = Object.freeze({ ...headers });
    }
    toJSON() {
        return { ...this.payload, status: this.status, code: this.code };
    }
}
export class APIError extends Error {
    error;
    status;
    code;
    constructor(error, message, status = 400, code = status) {
        super(message);
        this.error = error;
        this.status = status;
        this.code = code;
        this.name = new.target.name;
        apiErrorResponseSchema.parse({
            status,
            code,
            error,
            error_description: message,
        });
    }
    toJSON() {
        return apiErrorResponseSchema.parse({
            status: this.status,
            code: this.code,
            error: this.error,
            error_description: this.message,
        });
    }
    static from(value, fallback) {
        const parsed = apiErrorResponseSchema.safeParse(value);
        if (!parsed.success) {
            return fallback ?? new APIError("invalid_response", "API error response is invalid", 502);
        }
        return new APIError(parsed.data.error, parsed.data.error_description, parsed.data.status, parsed.data.code);
    }
}
export function apiResponseSchema(shape) {
    return z.object(shape).extend({
        status: httpStatusSchema,
        code: responseCodeSchema,
    });
}
//# sourceMappingURL=api.js.map