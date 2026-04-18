export interface BanInfo {
  id: number;
  username: string;
  authoritative: string;
  user_id: string;
  authoritative_id: string;
  expires?: string;
  permanent: boolean;
  permanently?: boolean;
  ip_addr?: string;
  reason?: string;
  created_at: string;
}

export interface User {
  is_banned?: boolean;
  ban_info?: BanInfo;
  id: string;
  username: string;
  hasCodeName?: boolean;
  habbo_id?: string | number;
  avatar?: string;
  badge?: number;
  rank?: number;
  salary?: string;
  bitflags?: string;
  user_flags?: string;
  permissions?: {
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
  };
  online?: boolean;
  current_look?: string | null;
  current_motto?: string | null;
  created_at?: string;
  time_stats?: {
    total_time: number;
    current_session: number;
    last_seen: number;
  };
  badgeInfo?: {
    badge: number;
    rank: number;
    badgeName: string | null;
    rankName: string | null;
  };
}

export interface PromotionData {
  userName: string;
  workTime: number;
  badge: string;
  rank: string;
  currentWorkTime?: number;
}

export interface PromotionResult {
  success: boolean;
  message: string;
  nextRank?: string;
  badge?: string;
  requiredTime?: number;
  remainingTime?: number;
}

export interface TeamMember {
  id: string;
  name: string;
  position: string;
  category: string;
  avatar: string;
  rank: string;
  discordId?: string;
}

export interface Award {
  id: string;
  title: string;
  winner: string;
  votes: number;
  totalVotes: number;
  percentage: number;
}

export interface Supporter {
  id: string;
  name: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'emerald' | 'platinum' | 'ruby' | 'jade';
  contribution: number;
}

export interface DiscordActivity {
  id: string;
  userId: string;
  type: 'promotion' | 'salary' | 'join' | 'leave' | 'achievement';
  message: string;
  timestamp: Date;
}

export type Theme = 'light' | 'dark';

export interface AppState {
  user: User | null;
  theme: Theme;
  isAuthenticated: boolean;
  currentPage: string;
  sidebarCollapsed: boolean;
}