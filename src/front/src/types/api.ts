export type ArchiveType = 'all' | 'badge_up' | 'badge_down' | 'mr' | 'warning' | 'bulk_promotion';

export interface ArchiveRecord {
    id: string;
    username: string;
    type: string;
    old_badge: string;
    old_rank: string;
    new_badge: string;
    new_rank: string;
    action_date: string;
    action_time: string;
    codename: string;
    promoted_users?: {
        id: number;
        username: string;
        old_badge: number;
        old_rank: number;
        new_badge: number;
        new_rank: number;
    }[];
}

export interface ArchiveResponse {
    success: 1 | 0;
    data: ArchiveRecord[];
    message?: string;
}

export interface APIUser {
    id: string;
    username: string;
    badge: number;
    rank: number;
    badge_name: string | null;
    rank_name: string | null;
    avatar: string;
    habbo_id: string;
    coins: number;
    bitflags: number;
    user_flags: string;
    created_at: string;
    is_banned: boolean;
    extras?: string[];
    ban_info: {
        permanent: boolean;
        expires: string | null;
        reason: string | null;
    } | null;
}
