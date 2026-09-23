# @basis/schema

Shared API envelopes, typed endpoint clients, access-token claims, and delegated-permission definitions for Basis services.

```ts
import { APIResponse } from "@basis/schema/api";
import { APIClient, defineEndpoint } from "@basis/schema/client";
import { renderErrorPage } from "@basis/schema/error-page";
import { BasisPermissions, DelegatedPermissionSet } from "@basis/schema/permissions";
```

`renderErrorPage(error)` accepts an `APIErrorResponse` or `null` and returns a self-contained HTML error document with its image embedded as a data URI. When an error is provided, only its escaped `code` is displayed in parentheses after the main message.

Permission definitions use canonical dotted names such as `Users.read` and `OnlineMeetings.MicrosoftTeams.offlineParticipants.create`. Matching is case-insensitive; a permission ending in `.all` grants its descendants.

The package is ESM-only and publishes compiled JavaScript and declarations for:

- `@basis/schema/api`
- `@basis/schema/auth`
- `@basis/schema/client`
- `@basis/schema/error-page`
- `@basis/schema/permissions`

`APIClient` validates typed path, query, and body inputs, obtains bearer tokens through an injected provider, and validates successful or canonical error responses. Version 0.1 supports JSON and empty responses; binary payloads remain service-specific.
