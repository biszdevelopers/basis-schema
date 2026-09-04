import { z } from "zod";
export const permissionSchema = z
    .string({ error: "Permission must be text" })
    .trim()
    .min(1, { error: "Permission is required" })
    .refine((permission) => /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/.test(permission), { error: "Permission must be a dot-separated namespace" });
const canonicalPermissions = new Map();
function comparisonKey(permission) {
    return permission.toLocaleLowerCase("en-US");
}
function registerCanonicalPath(segments) {
    for (let length = 1; length <= segments.length; length += 1) {
        const value = segments.slice(0, length).join(".");
        canonicalPermissions.set(comparisonKey(value), value);
    }
}
function validateCanonicalPath(segments) {
    if (segments.length < 2) {
        throw new TypeError("Permission definitions require a group and behavior");
    }
    let behaviorStarted = false;
    for (const [index, segment] of segments.entries()) {
        const upperCamel = /^[A-Z][A-Za-z0-9]*$/.test(segment);
        const lowerCamel = /^[a-z][A-Za-z0-9]*$/.test(segment);
        if (!upperCamel && !lowerCamel) {
            throw new TypeError(`Permission segment \"${segment}\" is not camelCase`);
        }
        if (index === 0 && !upperCamel) {
            throw new TypeError("Permission groups must begin with an uppercase letter");
        }
        if (behaviorStarted && upperCamel) {
            throw new TypeError("Permission groups cannot follow behavior segments");
        }
        if (lowerCamel)
            behaviorStarted = true;
    }
    if (!behaviorStarted) {
        throw new TypeError("Permission definitions require a lower-camel-case behavior");
    }
}
function defineNode(input, segments) {
    const output = {};
    for (const [key, value] of Object.entries(input)) {
        const path = [...segments, key];
        if (value === true) {
            validateCanonicalPath(path);
            registerCanonicalPath(path);
            output[key] = path.join(".");
        }
        else {
            output[key] = defineNode(value, path);
        }
    }
    return Object.freeze(output);
}
export function definePermissionTree(input) {
    return defineNode(input, []);
}
export function flattenPermissions(tree) {
    const permissions = [];
    for (const value of Object.values(tree)) {
        if (typeof value === "string")
            permissions.push(permissionSchema.parse(value));
        else if (value && typeof value === "object") {
            permissions.push(...flattenPermissions(value));
        }
    }
    return permissions;
}
export function normalizePermission(permission) {
    const parsed = permissionSchema.parse(permission);
    const key = comparisonKey(parsed);
    const registered = canonicalPermissions.get(key);
    if (registered)
        return registered;
    if (key.endsWith(".all")) {
        const parent = canonicalPermissions.get(key.slice(0, -4));
        if (parent)
            return `${parent}.all`;
    }
    return parsed;
}
export class DelegatedPermissionSet {
    permissions;
    constructor(permissions) {
        const unique = new Map();
        for (const permission of permissions) {
            const parsed = z
                .string({ error: "Granted permission must be text" })
                .trim()
                .min(1, { error: "Granted permission cannot be empty" })
                .parse(permission);
            const canonical = parsed.includes(".")
                ? normalizePermission(permissionSchema.parse(parsed))
                : parsed;
            unique.set(comparisonKey(canonical), canonical);
        }
        this.permissions = Object.freeze([...unique.values()]);
    }
    has(required) {
        return this.permissions.some((granted) => {
            const normalizedGranted = comparisonKey(granted);
            const normalizedRequired = comparisonKey(normalizePermission(required));
            if (normalizedGranted === normalizedRequired)
                return true;
            if (!normalizedGranted.endsWith(".all"))
                return false;
            return normalizedRequired.startsWith(`${normalizedGranted.slice(0, -4)}.`);
        });
    }
    satisfies(requirement) {
        if (!requirement)
            return true;
        if (typeof requirement === "string")
            return this.has(requirement);
        if ("allOf" in requirement) {
            return requirement.allOf.every((permission) => this.has(permission));
        }
        return requirement.anyOf.some((permission) => this.has(permission));
    }
}
export const BasisPermissions = definePermissionTree({
    Users: {
        read: true,
    },
});
//# sourceMappingURL=permissions.js.map