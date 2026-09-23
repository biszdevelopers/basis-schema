import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { APIError, APIResponse } from "../src/api.js";
import { accessTokenClaimsSchema } from "../src/auth.js";
import { APIClient, defineEndpoint } from "../src/client.js";
import { renderErrorPage } from "../src/error-page.js";
import {
  DelegatedPermissionSet,
  definePermissionTree,
  flattenPermissions,
  normalizePermission,
} from "../src/permissions.js";

describe("API envelopes", () => {
  test("serializes canonical success and error responses", () => {
    expect(new APIResponse({ item: "one" }, 201, "created").toJSON()).toEqual({
      item: "one",
      status: 201,
      code: "created",
    });
    expect(
      new APIError("invalid_request", "Name is required", 400).toJSON(),
    ).toEqual({
      status: 400,
      code: 400,
      error: "invalid_request",
      error_description: "Name is required",
    });
  });
});

describe("error page", () => {
  test("renders only the escaped API error code after the main message", () => {
    const html = renderErrorPage({
      status: 500,
      code: "BROKEN<CODE>",
      error: "server_error",
      error_description: "Sensitive implementation details",
    });

    expect(html).toStartWith("<!doctype html>");
    expect(html).toContain('go back home</a> (BROKEN&lt;CODE&gt;)</h1>');
    expect(html).not.toContain("server_error");
    expect(html).not.toContain("Sensitive implementation details");
    expect(html).toContain('src="data:image/png;base64,');
    expect(html).not.toContain('src="/sad_barry.png"');
  });

  test("omits the error code when rendered without an error", () => {
    expect(renderErrorPage(null)).toContain('go back home</a></h1>');
  });
});

describe("delegated permissions", () => {
  const permissions = definePermissionTree({
    OnlineMeetings: {
      MicrosoftTeams: {
        offlineParticipants: {
          create: true,
          read: true,
        },
      },
    },
  });

  test("defines canonical permission strings", () => {
    expect(permissions.OnlineMeetings.MicrosoftTeams.offlineParticipants.read).toBe(
      "OnlineMeetings.MicrosoftTeams.offlineParticipants.read",
    );
    expect(flattenPermissions(permissions)).toHaveLength(2);
  });

  test("matches case-insensitively with explicit all inheritance", () => {
    const exact = new DelegatedPermissionSet([
      "onlinemeetings.microsoftteams.offlineparticipants.READ",
    ]);
    expect(exact.permissions).toEqual([
      "OnlineMeetings.MicrosoftTeams.offlineParticipants.read",
    ]);
    expect(normalizePermission("users.READ")).toBe("Users.read");
    expect(exact.has(permissions.OnlineMeetings.MicrosoftTeams.offlineParticipants.read)).toBe(true);
    expect(exact.has(permissions.OnlineMeetings.MicrosoftTeams.offlineParticipants.create)).toBe(false);

    const inherited = new DelegatedPermissionSet([
      "OnlineMeetings.MicrosoftTeams.all",
    ]);
    expect(inherited.has(permissions.OnlineMeetings.MicrosoftTeams.offlineParticipants.create)).toBe(true);
  });

  test("supports allOf and anyOf requirements", () => {
    const set = new DelegatedPermissionSet([
      permissions.OnlineMeetings.MicrosoftTeams.offlineParticipants.read,
    ]);
    expect(set.satisfies({ allOf: [permissions.OnlineMeetings.MicrosoftTeams.offlineParticipants.read] })).toBe(true);
    expect(set.satisfies({ anyOf: [permissions.OnlineMeetings.MicrosoftTeams.offlineParticipants.create, permissions.OnlineMeetings.MicrosoftTeams.offlineParticipants.read] })).toBe(true);
  });
});

describe("authentication and API client", () => {
  test("validates canonical access-token claims", () => {
    expect(
      accessTokenClaimsSchema.parse({
        sub: "user",
        client_id: "client",
        scope: "openid",
        permissions: ["Users.read"],
        jti: "token",
        iat: 1,
        exp: 2,
        iss: "https://auth.example.test",
        aud: "urn:basis:api",
      }).sub,
    ).toBe("user");
  });

  test("normalizes an omitted permissions claim to an empty list", () => {
    expect(
      accessTokenClaimsSchema.parse({
        sub: "user",
        client_id: "client",
        scope: "openid",
        jti: "token",
        iat: 1,
        exp: 2,
        iss: "https://auth.example.test",
        aud: "urn:basis:api",
      }).permissions,
    ).toEqual([]);
  });

  test("encodes paths, validates payloads, and supplies bearer tokens", async () => {
    const endpoint = defineEndpoint({
      method: "GET",
      path: "/things/{id}",
      pathSchema: z.object({ id: z.string() }),
      querySchema: z.object({ search: z.string() }),
      responseSchema: z.object({ status: z.literal(200), code: z.literal(200), value: z.string() }),
      authentication: { type: "bearer", permissions: "Users.read" },
    });
    let request: Request | undefined;
    const client = new APIClient({
      baseUrl: "https://api.example.test",
      getAccessToken: () => "token",
      fetch: (async (
        input: Parameters<typeof fetch>[0],
        init?: RequestInit,
      ) => {
        request = new Request(input, init);
        return Response.json({ status: 200, code: 200, value: "ok" });
      }) as unknown as typeof fetch,
    });
    const result = await client.request(endpoint, {
      path: { id: "a/b" },
      query: { search: "hello" },
    });
    expect(request?.url).toBe("https://api.example.test/things/a%2Fb?search=hello");
    expect(request?.headers.get("authorization")).toBe("Bearer token");
    expect(result.value).toBe("ok");
  });

  test("validates bodies before sending and reconstructs API errors", async () => {
    let sent = false;
    const endpoint = defineEndpoint({
      method: "POST",
      path: "/things",
      bodySchema: z.object({ name: z.string().min(1) }),
      responseSchema: z.object({ status: z.literal(201), code: z.literal(201) }),
      authentication: { type: "public" },
    });
    const invalidClient = new APIClient({
      baseUrl: "https://api.example.test",
      fetch: (async () => {
        sent = true;
        return Response.json({ status: 201, code: 201 }, { status: 201 });
      }) as unknown as typeof fetch,
    });
    await expect(
      invalidClient.request(endpoint, { body: { name: "" } }),
    ).rejects.toMatchObject({ error: "invalid_request", status: 400 });
    expect(sent).toBe(false);

    const errorClient = new APIClient({
      baseUrl: "https://api.example.test",
      fetch: (async () => Response.json({
        status: 409,
        code: "duplicate",
        error: "duplicate_name",
        error_description: "That name already exists",
      }, { status: 409 })) as unknown as typeof fetch,
    });
    await expect(
      errorClient.request(endpoint, { body: { name: "valid" } }),
    ).rejects.toMatchObject({
      error: "duplicate_name",
      message: "That name already exists",
      status: 409,
      code: "duplicate",
    });
  });

  test("supports empty endpoint responses", async () => {
    const endpoint = defineEndpoint({
      method: "DELETE",
      path: "/things/{id}",
      pathSchema: z.object({ id: z.string() }),
      responseType: "empty",
      authentication: { type: "public" },
    });
    const client = new APIClient({
      baseUrl: "https://api.example.test",
      fetch: (async () => new Response(null, { status: 204 })) as unknown as typeof fetch,
    });
    await expect(
      client.request(endpoint, { path: { id: "one" } }),
    ).resolves.toBeUndefined();
  });
});
