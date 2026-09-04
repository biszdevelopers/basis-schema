import { z } from "zod";
export declare const permissionSchema: z.ZodString;
export type Permission = z.infer<typeof permissionSchema>;
export type PermissionRequirement = Permission | {
    allOf: readonly Permission[];
} | {
    anyOf: readonly Permission[];
};
type PermissionTreeInput = {
    readonly [key: string]: true | PermissionTreeInput;
};
type DefinedPermissionTree<T extends PermissionTreeInput, Prefix extends string = ""> = {
    readonly [K in keyof T]: T[K] extends true ? `${Prefix}${Extract<K, string>}` : T[K] extends PermissionTreeInput ? DefinedPermissionTree<T[K], `${Prefix}${Extract<K, string>}.`> : never;
};
export declare function definePermissionTree<const T extends PermissionTreeInput>(input: T): DefinedPermissionTree<T>;
export declare function flattenPermissions(tree: object): Permission[];
export declare function normalizePermission(permission: Permission): string;
export declare class DelegatedPermissionSet {
    readonly permissions: readonly string[];
    constructor(permissions: Iterable<string>);
    has(required: Permission): boolean;
    satisfies(requirement?: PermissionRequirement): boolean;
}
export declare const BasisPermissions: DefinedPermissionTree<{
    readonly Users: {
        readonly read: true;
    };
}, "">;
export {};
//# sourceMappingURL=permissions.d.ts.map