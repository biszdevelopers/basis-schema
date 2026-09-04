import { z } from "zod";

export const accessTokenClaimsSchema = z.looseObject({
  sub: z.string({ error: "Access token subject must be text" }).min(1, {
    error: "Access token subject is required",
  }),
  client_id: z.string({ error: "Access token client ID must be text" }).min(1, {
    error: "Access token client ID is required",
  }),
  scope: z.string({ error: "Access token scope must be text" }),
  permissions: z
    .array(
      z.string({ error: "Access token permissions must be text" }).min(1, {
        error: "Access token permissions cannot be empty",
      }),
      { error: "Access token permissions must be a list" },
    )
    .default([]),
  jti: z.string({ error: "Access token ID must be text" }).min(1, {
    error: "Access token ID is required",
  }),
  iat: z.number({ error: "Access token issued time must be a number" }).int({
    error: "Access token issued time must be an integer",
  }),
  exp: z.number({ error: "Access token expiry must be a number" }).int({
    error: "Access token expiry must be an integer",
  }),
  iss: z.string({ error: "Access token issuer must be text" }).min(1, {
    error: "Access token issuer is required",
  }),
  aud: z.union(
    [
      z.string({ error: "Access token audience must be text" }).min(1, {
        error: "Access token audience is required",
      }),
      z.array(
        z.string({ error: "Access token audiences must be text" }).min(1, {
          error: "Access token audiences cannot be empty",
        }),
        { error: "Access token audience must be text or a list" },
      ),
    ],
    { error: "Access token audience must be text or a list" },
  ),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export type EndpointAuthentication =
  | { type: "public" }
  | {
      type: "bearer";
      permissions?: import("./permissions.js").PermissionRequirement;
    };
