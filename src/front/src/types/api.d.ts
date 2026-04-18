export interface ArchiveRecord {
  id: number;
  username: string;
  type: ArchiveType;
  promoter: string;
  old_badge: string;
  old_rank: string;
  new_badge: string;
  new_rank: string;
  codename: string;
  action_timestamp: number;
  action_date: string;
  action_time: string;
}

export type ArchiveType = 'all' | 'badge_up' | 'badge_down' | 'mr' | 'warning';

export interface ArchiveResponse {
  success: 1 | 0;
  data: ArchiveRecord[];
  error?: string;
}

// User management types
export interface APIUser {
  id: number;
  username: string;
  avatar: string | null;
  badge_name: string | null;
  rank_name: string | null;
  user_flags: bigint;
  extras?: string[];
  created_at: string;
  is_banned?: boolean;
  ban_info?: {
    permanent: boolean;
    reason: string;
  };
}

export interface UserResponse {
  success: boolean;
  data: {
    users: APIUser[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}