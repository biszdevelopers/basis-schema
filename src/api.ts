import { z } from "zod";

export const responseCodeSchema = z.union([
  z.string({ error: "Response code must be text or a number" }).min(1, {
    error: "Response code cannot be empty",
  }),
  z.number({ error: "Response code must be text or a number" }).int({
    error: "Numeric response code must be an integer",
  }),
]);

export type ResponseCode = z.infer<typeof responseCodeSchema>;

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

export type APIErrorResponse = z.infer<typeof apiErrorResponseSchema>;

const payloadSchema = z.record(z.string(), z.unknown());

export class APIResponse<
  T extends Record<string, unknown> = Record<string, never>,
> {
  readonly payload: T;
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    payload: T = {} as T,
    public readonly status = 200,
    public readonly code: ResponseCode = status,
    headers: Record<string, string> = {},
  ) {
    payloadSchema.parse(payload);
    httpStatusSchema.parse(status);
    responseCodeSchema.parse(code);
    if ("status" in payload || "code" in payload) {
      throw new TypeError("API response payload cannot contain status or code");
    }
    this.payload = payload;
    this.headers = Object.freeze({ ...headers });
  }

  toJSON(): T & { status: number; code: ResponseCode } {
    return { ...this.payload, status: this.status, code: this.code };
  }
}

export class APIError extends Error {
  constructor(
    public readonly error: string,
    message: string,
    public readonly status = 400,
    public readonly code: ResponseCode = status,
  ) {
    super(message);
    this.name = new.target.name;
    apiErrorResponseSchema.parse({
      status,
      code,
      error,
      error_description: message,
    });
  }

  toJSON(): APIErrorResponse {
    return apiErrorResponseSchema.parse({
      status: this.status,
      code: this.code,
      error: this.error,
      error_description: this.message,
    });
  }

  static from(value: unknown, fallback?: APIError): APIError {
    const parsed = apiErrorResponseSchema.safeParse(value);
    if (!parsed.success) {
      return fallback ?? new APIError("invalid_response", "API error response is invalid", 502);
    }
    return new APIError(
      parsed.data.error,
      parsed.data.error_description,
      parsed.data.status,
      parsed.data.code,
    );
  }
}

export function apiResponseSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).extend({
    status: httpStatusSchema,
    code: responseCodeSchema,
  });
}
