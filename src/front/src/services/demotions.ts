import { apiClient } from './api';

export interface UserSearchResult {
  username: string;
  hid: number;
  registered: boolean;
}

export interface DemoteCheckResponse {
  success: number;
  registered?: boolean;
  error?: string;
  user?: {
    username: string;
    badge?: number;
    rank?: number;
    id?: string;
  };
}

interface DemotionResponse {
  success: number;
  message?: string;
  error?: string;
  new_badge?: number;
  new_rank?: number;
  new_badge_name?: string;
  new_rank_name?: string;
  codename?: string;
}

export const demotionsAPI = {
  async searchUsers(username: string): Promise<UserSearchResult[]> {
    try {
      const response = await apiClient.get(`/badge/search/${encodeURIComponent(username)}`);
      return response.data;
    } catch (error: any) {
      console.error('Search users error:', error);
      throw new Error(error.response?.data?.error || 'Kullanıcı arama başarısız');
    }
  },

  async demoteCheck(hid: number, mode: 'check' | 'create', rank?: number): Promise<DemoteCheckResponse> {
    try {
      hid = Number(hid);
      const payload: any = { hid, mode };
      if (rank !== undefined) payload.rank = Number(rank);
      const response = await apiClient.post('/badge/demote/check', payload);
      return response.data;
    } catch (error: any) {
      console.error('Demote check error:', error);
      throw new Error(error.response?.data?.error || 'Kullanıcı kontrolü başarısız');
    }
  },

  async getUserInfo(username: string) {
    try {
      const response = await apiClient.get(`/badge/demote?username=${encodeURIComponent(username)}`);
      return response.data;
    } catch (error: any) {
      console.error('Get user info error:', error);
      throw new Error(error.response?.data?.error || 'Kullanıcı bilgileri alınamadı');
    }
  },

  async demoteUser(username: string): Promise<DemotionResponse> {
    try {
      const response = await apiClient.post('/badge/demote', { username });
      return response.data;
    } catch (error: any) {
      console.error('Demotion error:', error);
      throw new Error(error.response?.data?.error || 'Tenzil işlemi sırasında bir hata oluştu');
    }
  },
};
