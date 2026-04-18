export interface BadgeInfo {
  badgeName: string;
  rankName: string;
  badge: number;
  rank: number;
}

export interface Permissions {
  roles: string[];
  users?: {
    VIEW?: boolean;
    LIST?: boolean;
    CREATE?: boolean;
    UPDATE?: boolean;
    DELETE?: boolean;
    BAN?: boolean;
    MANAGE?: boolean;
  };
  records?: {
    VIEW?: boolean;
    CREATE?: boolean;
    UPDATE?: boolean;
    DELETE?: boolean;
    MANAGE?: boolean;
  };
  time?: {
    VIEW?: boolean;
    UPDATE?: boolean;
    RESET?: boolean;
    MANAGE?: boolean;
  };
  badges?: {
    VIEW?: boolean;
    ASSIGN?: boolean;
    CREATE?: boolean;
    DELETE?: boolean;
    MANAGE?: boolean;
  };
  system?: {
    VIEW_LOGS?: boolean;
    SETTINGS?: boolean;
    BACKUPS?: boolean;
    MANAGE?: boolean;
  };
  api?: {
    VIEW?: boolean;
    CREATE?: boolean;
    REVOKE?: boolean;
    MANAGE?: boolean;
  };
  raw?: string;
}

export interface User {
  id: string;
  username: string;
  habbo_id?: string;
  avatar?: string;
  badge?: number;
  rank?: number;
  salary?: string;
  bitflags?: string;
  user_flags?: string;
  permissions?: Permissions;
  created_at?: string;
  online?: boolean;
  current_look?: string | null;
  current_motto?: string | null;
  badgeInfo?: BadgeInfo;
  is_banned?: boolean;
  ban_info?: {
    permanent: boolean;
    expires: string | null;
    reason: string | null;
  } | null;
}

export type UserResponse = {
  user: User;
};
