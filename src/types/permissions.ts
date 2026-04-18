//@ts-nocheck
/*
 * User permissions bitflags v2
 * --------------------------
 * - Daha tutarlı, daha kolay kullanılabilir.
 * - BigInt tabanlı.
 * - Shortcut admin bit ile tüm izinleri kapsar (Discord tarzı).
 * - Dönüştürme, kontrol ve mask oluşturma kolaylıkları.
 */

export type PermissionCategory = 'USERS' | 'RECORDS' | 'TIME' | 'BADGES' | 'SYSTEM' | 'API';
export type Role = 'ADMIN' | 'MODERATOR' | 'VIEWER';

// -------------------
// Permission bitflags
// -------------------
export const PERMISSIONS = {
    USERS: {
        VIEW: 1n << 0n,
        LIST: 1n << 1n,
        CREATE: 1n << 2n,
        UPDATE: 1n << 3n,
        DELETE: 1n << 4n,
        BAN: 1n << 5n,
        MANAGE: 1n << 6n,
    },
    RECORDS: {
        VIEW: 1n << 7n,
        CREATE: 1n << 8n,
        UPDATE: 1n << 9n,
        DELETE: 1n << 10n,
        MANAGE: 1n << 11n,
    },
    TIME: {
        VIEW: 1n << 12n,
        UPDATE: 1n << 13n,
        RESET: 1n << 14n,
        MANAGE: 1n << 15n,
    },
    BADGES: {
        VIEW: 1n << 16n,
        ASSIGN: 1n << 17n,
        CREATE: 1n << 18n,
        DELETE: 1n << 19n,
        MANAGE: 1n << 20n,
    },
    SYSTEM: {
        VIEW_LOGS: 1n << 21n,
        SETTINGS: 1n << 22n,
        BACKUPS: 1n << 23n,
        MANAGE: 1n << 24n,
    },
    API: {
        VIEW: 1n << 25n,
        CREATE: 1n << 26n,
        REVOKE: 1n << 27n,
        MANAGE: 1n << 28n,
    },
} as const;

// -------------------
// Roles / shortcut
// -------------------
export const ROLES = {
    ADMIN: 1n << 29n,        // Shortcut: tüm izinleri kapsar
    MODERATOR: 1n << 30n,    // Belirli yönetim izinleri
    VIEWER: 1n << 31n,       // Sadece okuma izinleri
} as const;

// -------------------
// UserFlags type
// -------------------
export interface UserFlags {
    users?: Partial<Record<keyof typeof PERMISSIONS.USERS, boolean>>;
    records?: Partial<Record<keyof typeof PERMISSIONS.RECORDS, boolean>>;
    time?: Partial<Record<keyof typeof PERMISSIONS.TIME, boolean>>;
    badges?: Partial<Record<keyof typeof PERMISSIONS.BADGES, boolean>>;
    system?: Partial<Record<keyof typeof PERMISSIONS.SYSTEM, boolean>>;
    api?: Partial<Record<keyof typeof PERMISSIONS.API, boolean>>;
    roles: Role[];
}

// -------------------
// Utils
// -------------------

/** Convert structured UserFlags to BigInt mask */
export function flagsToMask(flags: UserFlags): bigint {
    let mask = 0n;

    if (flags.roles.includes('ADMIN')) {
        return getAdminMask(); // shortcut: tüm izinleri kapsar
    }

    for (const cat of Object.keys(PERMISSIONS) as PermissionCategory[]) {
        const perms = PERMISSIONS[cat];
        const userCat = flags[cat.toLowerCase() as keyof UserFlags] as Record<string, boolean> | undefined;
        if (!userCat) continue;
        for (const perm of Object.keys(perms)) {
            if (userCat[perm] === true) mask |= perms[perm as keyof typeof perms];
        }
    }

    // Rolleri ekle
    for (const role of flags.roles) {
        mask |= ROLES[role];
    }

    return mask;
}

/** Convert BigInt mask to structured UserFlags */
export function maskToFlags(mask: bigint): UserFlags {
    const out: UserFlags = { roles: [] };

    // Shortcut ADMIN check
    if ((mask & ROLES.ADMIN) === ROLES.ADMIN) {
        out.roles.push('ADMIN');
        // tüm izinleri true yap
        for (const cat of Object.keys(PERMISSIONS) as PermissionCategory[]) {
            out[cat.toLowerCase() as keyof UserFlags] = {};
            const perms = PERMISSIONS[cat];
            for (const perm of Object.keys(perms)) {
                (out[cat.toLowerCase() as keyof UserFlags] as any)[perm] = true;
            }
        }
        return out;
    }

    // Diğer roller
    for (const r of Object.keys(ROLES) as Role[]) {
        if ((mask & ROLES[r]) === ROLES[r]) out.roles.push(r);
    }

    // İzinleri işaretle
    for (const cat of Object.keys(PERMISSIONS) as PermissionCategory[]) {
        out[cat.toLowerCase() as keyof UserFlags] = {};
        const perms = PERMISSIONS[cat];
        for (const perm of Object.keys(perms)) {
            (out[cat.toLowerCase() as keyof UserFlags] as any)[perm] = (mask & perms[perm as keyof typeof perms]) === perms[perm as keyof typeof perms];
        }
    }

    return out;
}

/** Shortcut: full admin mask */
export function getAdminMask(): bigint {
    let mask = ROLES.ADMIN;
    for (const cat of Object.keys(PERMISSIONS) as PermissionCategory[]) {
        for (const perm of Object.keys(PERMISSIONS[cat])) mask |= PERMISSIONS[cat][perm as keyof typeof PERMISSIONS[cat]];
    }
    return mask;
}

/** Check permission on a mask */
export function hasPermissionMask(mask: bigint, category: PermissionCategory, permission: string): boolean {
    // ADMIN shortcut
    if ((mask & ROLES.ADMIN) === ROLES.ADMIN) return true;
    
    const permMask = PERMISSIONS[category][permission as keyof typeof PERMISSIONS[category]];
    if (!permMask) return false;
    return (mask & permMask) === permMask;
}

/** Create admin UserFlags */
export function createAdminFlags(): UserFlags {
    return maskToFlags(getAdminMask());
}

/** Default user flags */
export function createDefaultFlags(): UserFlags {
    return {
        users: { VIEW: true },
        records: { VIEW: true },
        time: { VIEW: true },
        badges: { VIEW: true },
        system: {},
        api: {},
        roles: ['VIEWER'],
    };
}
