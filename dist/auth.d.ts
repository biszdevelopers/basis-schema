import { z } from "zod";
export declare const accessTokenClaimsSchema: z.ZodObject<{
    sub: z.ZodString;
    client_id: z.ZodString;
    scope: z.ZodString;
    permissions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    jti: z.ZodString;
    iat: z.ZodNumber;
    exp: z.ZodNumber;
    iss: z.ZodString;
    aud: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
}, z.core.$loose>;
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;
export type EndpointAuthentication = {
    type: "public";
} | {
    type: "bearer";
    permissions?: import("./permissions.js").PermissionRequirement;
};
//# sourceMappingURL=auth.d.ts.map