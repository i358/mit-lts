import axios from 'axios';
import { AuthService } from './auth.service';
import { localAuthService } from './authService';
import type { ArchiveResponse } from '../types/api';
import toast from 'react-hot-toast';

const API_BASE_URL = 'https://api.habbojoh.com.tr/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor
apiClient.interceptors.request.use((config) => {
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const data = error.response.data;
      const remainingSeconds = data.remainingSeconds;
      
      if (data.isPenalty) {
        toast.error(
          `İstek limiti çok fazla aşıldı. ${Math.ceil(remainingSeconds / 60)} dakika boyunca engellendiniz.`,
          { duration: 5000, style: { background: '#392810', color: '#FED7AA', border: '1px solid rgba(254, 215, 170, 0.2)' } }
        );
      } else {
        toast.error(
          `İşlem limiti aşıldı. Lütfen ${remainingSeconds} saniye bekleyin.`,
          { duration: 3000, style: { background: '#392810', color: '#FED7AA', border: '1px solid rgba(254, 215, 170, 0.2)' } }
        );
      }
    }
    return Promise.reject(error);
  }
);

export const mitAPI = {
  async login(username: string, password: string) {
    return await AuthService.login(username, password);
  },

  async getCurrentUser() {
    return await AuthService.getCurrentUser();
  },

  async getActiveUserCount(): Promise<{ success: number; activeCount: number }> {
    const response = await apiClient.get<{ success: number; activeCount: number }>('/users/active-count');
    return response.data;
  },

  /** WebSocket aktivite bağlantısı için token alır. */
  async getActivityToken(): Promise<{ success: number; token?: string }> {
    const response = await apiClient.get<{ success: number; token?: string }>('/users/activity-token');
    return response.data;
  },

  async getUserInfo(username: string) {
    try {
      return await localAuthService.getUserInfo(username);
    } catch (error) {
      console.error('getUserInfo error:', error);
      throw error;
    }
  },

  async getArchive(type: string = 'all', date?: string) {
    try {
      const response = await apiClient.post<ArchiveResponse>('/archive', { type, date });
      return response.data;
    } catch (error: any) {
      console.error('Get archive error:', error);
      throw new Error(error.response?.data?.error || 'Arşiv verileri alınamadı');
    }
  },

  logout() {
    return AuthService.logout();
  },

  async register(data: any) {
    return await AuthService.completeRegistration(data?.state_id, data?.password);
  },

  // Discord doğrulama işlemi
  async verifyDiscord(code: string) {
    try {
      const response = await apiClient.post('/auth/verify', { code });
      return response.data;
    } catch (error: any) {
      console.error('Discord verification error:', error);
    }
  },

  async getAllUserTimes() {
    try {
      const response = await apiClient.get('/management/times');
      return response.data;
    } catch (error: any) {
      console.error('Get all user times error:', error);
      throw new Error(error.response?.data?.error || 'Süre verileri alınamadı');
    }
  },

  // Haftalık süre verileri (weekly_time) - week: YYYY-MM-DD (Pazartesi), opsiyonel
  async getWeeklyTimes(week?: string) {
    try {
      const response = await apiClient.get('/management/times/weekly', {
        params: week ? { week } : undefined
      });
      return response.data;
    } catch (error: any) {
      console.error('Get weekly times error:', error);
      throw new Error(error.response?.data?.error || 'Haftalık süre verileri alınamadı');
    }
  },

  // Discord bağlantı durumunu kontrol et
  async checkDiscordLink() {
    try {
      const response = await apiClient.post('/auth/check');
      return response.data;
    } catch (error: any) {
      console.error('Discord link check error:', error);
      throw error;
    }
  },

  // Kullanıcı kodunu al
  async getUserCode() {
    try {
      const response = await apiClient.get('/user/code');
      return response.data;
    } catch (error: any) {
      console.error('Get user code error:', error);
      return { data: null };
    }
  },

  // Kullanıcı kodu ayarla
  async setUserCode(code: string) {
    try {
      const response = await apiClient.post('/user/code', { code });
      return response.data;
    } catch (error: any) {
      console.error('Set user code error:', error);
      throw error;
    }
  },

  // Bulk promotion API çağrıları
  async getBulkPromotionBadges() {
    try {
      const response = await apiClient.get('/bulk-promotion/badges');
      return response.data;
    } catch (error: any) {
      console.error('Get badges error:', error);
      throw error;
    }
  },

  async searchBulkPromotionUsers(searchQuery: string) {
    try {
      const response = await apiClient.post('/bulk-promotion/search', { searchQuery });
      return response.data;
    } catch (error: any) {
      console.error('Bulk promotion search error:', error);
      throw error;
    }
  },

  async checkBulkPromotionUser(username: string, hid?: number) {
    try {
      const response = await apiClient.post('/bulk-promotion/check-user', { username, hid });
      return response.data;
    } catch (error: any) {
      console.error('Bulk promotion check user error:', error);
      throw error;
    }
  },

  async bulkPromotionBadgeCheck(hid: number) {
    try {
      const response = await apiClient.post('/bulk-promotion/badge-check', { hid });
      return response.data;
    } catch (error: any) {
      console.error('Bulk promotion badge check error:', error);
      throw error;
    }
  },

  async promoteBulk(users: Array<{ username: string; multiplier: number; badge?: number; rank?: number }>) {
    try {
      const response = await apiClient.post('/bulk-promotion/promote', { users });
      return response.data;
    } catch (error: any) {
      console.error('Bulk promotion error:', error);
      throw error;
    }
  },

  async getBulkPromotionArchive(query: any = {}) {
    try {
      const response = await apiClient.get('/bulk-promotion/archive', { params: query });
      return response.data;
    } catch (error: any) {
      console.error('Get bulk promotion archive error:', error);
      throw new Error(error.response?.data?.error || 'Toplu terfi arşivi alınamadı');
    }
  },

  async getBulkPromotionSchedule(week?: string) {
    const params = week ? { week } : {};
    const response = await apiClient.get('/bulk-promotion/schedule', { params });
    return response.data;
  },

  async claimBulkPromotionSlot(week: string, dayOfWeek: number, timeSlot: string) {
    const response = await apiClient.post('/bulk-promotion/schedule/claim', {
      week,
      day_of_week: dayOfWeek,
      time_slot: timeSlot,
    });
    return response.data;
  },

  async unclaimBulkPromotionSlot(week: string, dayOfWeek: number, timeSlot: string) {
    const response = await apiClient.post('/bulk-promotion/schedule/unclaim', {
      week,
      day_of_week: dayOfWeek,
      time_slot: timeSlot,
    });
    return response.data;
  },

  async getHighRankChatMessages(limit?: number, beforeId?: number) {
    const params: Record<string, string> = {};
    if (limit != null) params.limit = String(limit);
    if (beforeId != null) params.before_id = String(beforeId);
    const response = await apiClient.get('/bulk-promotion/chat/messages', { params });
    return response.data;
  },

  /** WebSocket sohbeti için tek kullanımlık token (cookie HttpOnly olduğu için). */
  async getChatWsToken() {
    const response = await apiClient.get('/bulk-promotion/chat/ws-token');
    return response.data;
  },

  async sendHighRankChatMessage(message: string) {
    const response = await apiClient.post('/bulk-promotion/chat', { message });
    return response.data;
  },

  async checkTraining(traineUsername: string) {
    try {
      const response = await apiClient.post('/training/check', {
        trainee_username: traineUsername
      });
      return response.data;
    } catch (error: any) {
      console.error('Check training error:', error);
      throw new Error(error.response?.data?.error || 'Eğitim kaydı kontrol edilemedi');
    }
  },

  async createTraining(traineUsername: string, discordVerified: boolean = false) {
    try {
      const response = await apiClient.post('/training/create', {
        trainee_username: traineUsername,
        discord_verified: discordVerified ? 1 : 0
      });
      return response.data;
    } catch (error: any) {
      console.error('Create training error:', error);
      throw new Error(error.response?.data?.error || 'Eğitim kaydı oluşturulamadı');
    }
  },

  async updateTraining(traineUsername: string, discordVerified: boolean) {
    try {
      const response = await apiClient.put('/training/update', {
        trainee_username: traineUsername,
        discord_verified: discordVerified ? 1 : 0
      });
      return response.data;
    } catch (error: any) {
      console.error('Update training error:', error);
      throw new Error(error.response?.data?.error || 'Eğitim kaydı güncellenemedi');
    }
  },

  // Password reset metodları
  async verifyMotto(username: string, type: 'reset' | 'forgot') {
    try {
      const response = await apiClient.post('/auth/verify-motto', {
        username,
        type
      });
      return response.data;
    } catch (error: any) {
      console.error('Verify motto error:', error);
      throw new Error(error.response?.data?.error || 'Motto doğrulama başlatılamadı');
    }
  },

  async verifyMottoCheck(stateId: number) {
    try {
      const response = await apiClient.post('/auth/verify-motto-check', {
        state_id: stateId
      });
      return response.data;
    } catch (error: any) {
      console.error('Verify motto check error:', error);
      throw new Error(error.response?.data?.error || 'Motto doğrulaması başarısız');
    }
  },

  async resetPassword(stateId: number, password: string) {
    try {
      const response = await apiClient.post('/auth/reset-password', {
        state_id: stateId,
        password
      });
      return response.data;
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw new Error(error.response?.data?.error || 'Şifre sıfırlama başarısız');
    }
  },

  async forgotPassword(stateId: number, password: string) {
    try {
      const response = await apiClient.post('/auth/forgot-password', {
        state_id: stateId,
        password
      });
      return response.data;
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw new Error(error.response?.data?.error || 'Şifre sıfırlama başarısız');
    }
  },

  // Announcements (Duyurular) - Admin/Moderator
  async publishAnnouncement(data: {
    type: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS';
    sub_type: string;
    title: string;
    description: string;
  }) {
    try {
      const response = await apiClient.post('/announcements/publish', data);
      return response.data;
    } catch (error: any) {
      console.error('Publish announcement error:', error);
      throw new Error(error.response?.data?.error || 'Duyuru yayınlanırken hata oluştu');
    }
  },

  // Announcements (Duyurular) - Public (get list)
  async getAnnouncements(filters?: {
    type?: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS';
    sub_type?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      const params = new URLSearchParams();
      if (filters?.type) params.append('type', filters.type);
      if (filters?.sub_type) params.append('sub_type', filters.sub_type);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());

      const response = await apiClient.get('/announcements', { params });
      return response.data;
    } catch (error: any) {
      console.error('Get announcements error:', error);
      throw new Error(error.response?.data?.error || 'Duyurular alınamadı');
    }
  },

  // Get announcement details
  async getAnnouncementDetails(id: number) {
    try {
      const response = await apiClient.get(`/announcements/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Get announcement details error:', error);
      throw new Error(error.response?.data?.error || 'Duyuru detayları alınamadı');
    }
  },

  // Get latest announcements
  async getLatestAnnouncements(count: number = 5) {
    try {
      const response = await apiClient.get(`/announcements/latest/${count}`);
      return response.data;
    } catch (error: any) {
      console.error('Get latest announcements error:', error);
      throw new Error(error.response?.data?.error || 'Son duyurular alınamadı');
    }
  },

  // Edit announcement (Admin/Moderator)
  async editAnnouncement(id: number, data: {
    title?: string;
    description?: string;
    is_active?: boolean;
  }) {
    try {
      const response = await apiClient.put(`/announcements/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Edit announcement error:', error);
      throw new Error(error.response?.data?.error || 'Duyuru güncellenirken hata oluştu');
    }
  },

  // Delete announcement (Admin only)
  async deleteAnnouncement(id: number) {
    try {
      const response = await apiClient.delete(`/announcements/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Delete announcement error:', error);
      throw new Error(error.response?.data?.error || 'Duyuru silinirken hata oluştu');
    }
  },

  // Get announcement types
  async getAnnouncementTypes() {
    try {
      const response = await apiClient.get('/announcements/types');
      return response.data;
    } catch (error: any) {
      console.error('Get announcement types error:', error);
      throw new Error(error.response?.data?.error || 'Duyuru türleri alınamadı');
    }
  },

  // Wordle
  async getWordleToday() {
    const response = await apiClient.get('/wordle/today');
    return response.data;
  },
  async submitWordleGuess(guess: string) {
    const response = await apiClient.post('/wordle/guess', { guess });
    return response.data;
  },
  async getWordleLeaderboard(week?: string) {
    const params = week ? { week } : {};
    const response = await apiClient.get('/wordle/leaderboard', { params });
    return response.data;
  },
  async getWordleMe() {
    const response = await apiClient.get('/wordle/me');
    return response.data;
  },

  // Kim Krediner Olmak İster
  async getKredinerStatus() {
    const response = await apiClient.get('/krediner/status');
    return response.data;
  },
  async startKredinerGame() {
    const response = await apiClient.post('/krediner/start');
    return response.data;
  },
  async submitKredinerAnswer(params: {
    session_id: string;
    question_id: number;
    selected_letter: 'A' | 'B' | 'C' | 'D';
    timed_out?: boolean;
  }) {
    const response = await apiClient.post('/krediner/answer', params);
    return response.data;
  },
  async getKredinerLeaderboard(week?: string) {
    const params = week ? { week } : {};
    const response = await apiClient.get('/krediner/leaderboard', { params });
    return response.data;
  },
  async getKredinerMe() {
    const response = await apiClient.get('/krediner/me');
    return response.data;
  }
};

export const habboAPI = {
  async getUserProfile(username: string) {
    try {
      const response = await axios.get(`https://www.habbo.com.tr/api/public/users?name=${username}`);
      return response.data;
    } catch (error) {
      console.error('Habbo API Error:', error);
      throw new Error('Kullanıcı bulunamadı');
    }
  }
};

export const discordAPI = {
  async sendLog(data: {
    title: string;
    description: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    username?: string;
    avatar?: string;
  }) {
    try {
      await apiClient.post('/log', data);
    } catch (error) {
      console.error('Log API Error:', error);
    }
  },

  // Announcements (Duyurular) - Admin/Moderator
  async publishAnnouncement(data: {
    type: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS';
    sub_type: string;
    title: string;
    description: string;
  }) {
    try {
      const response = await apiClient.post('/announcements/publish', data);
      return response.data;
    } catch (error: any) {
      console.error('Publish announcement error:', error);
      throw new Error(error.response?.data?.error || 'Duyuru yayınlanırken hata oluştu');
    }
  },

  // Announcements (Duyurular) - Public (get list)
  async getAnnouncements(filters?: {
    type?: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS';
    sub_type?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      const params = new URLSearchParams();
      if (filters?.type) params.append('type', filters.type);
      if (filters?.sub_type) params.append('sub_type', filters.sub_type);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());

      const response = await apiClient.get('/announcements', { params });
      return response.data;
    } catch (error: any) {
      console.error('Get announcements error:', error);
      throw new Error(error.response?.data?.error || 'Duyurular alınamadı');
    }
  },

  // Get announcement details
  async getAnnouncementDetails(id: number) {
    try {
      const response = await apiClient.get(`/announcements/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Get announcement details error:', error);
      throw new Error(error.response?.data?.error || 'Duyuru detayları alınamadı');
    }
  },

  // Get latest announcements
  async getLatestAnnouncements(count: number = 5) {
    try {
      const response = await apiClient.get(`/announcements/latest/${count}`);
      return response.data;
    } catch (error: any) {
      console.error('Get latest announcements error:', error);
      throw new Error(error.response?.data?.error || 'Son duyurular alınamadı');
    }
  },

  // Edit announcement (Admin/Moderator)
  async editAnnouncement(id: number, data: {
    title?: string;
    description?: string;
    is_active?: boolean;
  }) {
    try {
      const response = await apiClient.put(`/announcements/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Edit announcement error:', error);
      throw new Error(error.response?.data?.error || 'Duyuru güncellenirken hata oluştu');
    }
  },

  // Delete announcement (Admin only)
  async deleteAnnouncement(id: number) {
    try {
      const response = await apiClient.delete(`/announcements/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Delete announcement error:', error);
      throw new Error(error.response?.data?.error || 'Duyuru silinirken hata oluştu');
    }
  },

  // Get announcement types
  async getAnnouncementTypes() {
    try {
      const response = await apiClient.get('/announcements/types');
      return response.data;
    } catch (error: any) {
      console.error('Get announcement types error:', error);
      throw new Error(error.response?.data?.error || 'Duyuru türleri alınamadı');
    }
  }
};

// legacy api bu, normal api ekledikten sonra burayı düzenle
export const authAPI = {
  async login(username: string, password: string) {
    return await mitAPI.login(username, password);
  },

  async register(data: any) {
    return await mitAPI.register(data);
  },
  getCurrentUser() {
    return mitAPI.getCurrentUser();
  },

  logout() {
    mitAPI.logout();
  }
};