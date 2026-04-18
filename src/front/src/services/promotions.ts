import { apiClient } from './api';

export interface UserPromotionInfo {
  username: string;
  current_badge: number;
  current_rank: number;
  current_badge_name: string;
  current_rank_name: string;
  next_badge: number;
  next_rank: number;
  next_badge_name: string;
  next_rank_name: string;
  promotion_type: string;
  current_time: number;
  required_time: number;
  remaining_time?: number;
  success: number;
  message: string;
  codename?: string;
}

export interface UserSearchResult {
  username: string;
  hid: number;
  registered: boolean;
}

export interface BadgeCheckResponse {
  success: number;
  registered?: boolean;
  hasHigherRank?: boolean;
  error?: string;
  user?: {
    username: string;
    badge?: number;
    rank?: number;
    id?: string;
  };
}

export const promotionsAPI = {
  async searchUsers(username: string): Promise<UserSearchResult[]> {
    try {
      const response = await apiClient.get(`/badge/search/${encodeURIComponent(username)}`);
      return response.data;
    } catch (error: any) {
      console.error('Search users error:', error);
      throw new Error(error.response?.data?.error || 'Kullanıcı arama başarısız');
    }
  },

  async badgeCheck(hid: number, mode: 'check' | 'create', rank?: number): Promise<BadgeCheckResponse> {
    try {
      hid = Number(hid);
      const payload: any = { hid, mode };
      if (rank !== undefined) payload.rank = Number(rank);
      const response = await apiClient.post('/badge/check', payload);
      return response.data;
    } catch (error: any) {
      console.error('Badge check error:', error);
      throw new Error(error.response?.data?.error || 'Terfi kontrol başarısız');
    }
  },

  async getUserInfo(username: string): Promise<UserPromotionInfo> {
    try {
      const response = await apiClient.post('/badge', { 
        username, 
        mode: 'check'
      });
      return response.data;
    } catch (error: any) {
      console.error('Get user promotion info error:', error);
      throw new Error(error.response?.data?.error || 'Kullanıcı bilgileri alınamadı');
    }
  },

  async promoteUser(username: string): Promise<any> {
    try {
      const response = await apiClient.post('/badge', {
        username,
        mode: 'promote'
      });
      return response.data;
    } catch (error: any) {
      console.error('Promote user error:', error);
      throw new Error(error.response?.data?.error || 'Terfi işlemi başarısız oldu');
    }
  }
}