//@ts-nocheck
import axios from 'axios';

 export const API_URL = 'https://api.habbojoh.com.tr/v1';

interface UserResponse {
  success: number;
  banned?: boolean;
  ban_info?: {
    id: number;
    username: string;
    authoritative: string;
    user_id: string;
    authoritative_id: string;
    expires?: string;
    permanently: boolean;
    ip_addr?: string;
    reason?: string;
    created_at: string;
  };
  user?: {
    id: string;
    username: string;
    habbo_id: number;
    avatar: string;
    badgeInfo: {
      badge: number;
      rank: number;
      badgeName: string | null;
      rankName: string | null;
    };
    salary: string;
    bitflags: string;
    online: boolean;
    current_look: string | null;
    current_motto: string | null;
    time_stats: {
      total_time: number;
      current_session: number;
      last_seen: number;
    }
  }
}

export const AuthService = {
  // Kayıt işlemi - Adım 1: Kullanıcı kontrolü
  async checkUsername(username: string) {
    try {
      const response = await axios.post(`${API_URL}/users/new?m=check`, {
        username
      }, {
        withCredentials: true
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Username check failed');
    }
  },

  // Kayıt işlemi - Adım 2: Motto doğrulama
  async verifyMotto(state_id: number) {
    try {
      const response = await axios.post(`${API_URL}/users/new?m=verify`, {
        state_id
      }, {
        withCredentials: true
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Motto verification failed');
    }
  },

  // Kayıt işlemi - Adım 3: Kayıt tamamlama
  async completeRegistration(state_id: number, password: string) {
    try {
      console.log('Sending registration completion request:', { state_id, password });
      
      const response = await axios.post(`${API_URL}/users/new?m=done`, {
        state_id,
        password
      }, {
        withCredentials: true
      });
      
      console.log('Registration response:', response.data);

      if (response.data?.success !== 1) {
        throw new Error(response.data?.error || 'Registration failed');
      }

      return response.data;
    } catch (error: any) {
      console.error('Registration error:', {
        error: error,
        response: error.response?.data,
        status: error.response?.status
      });
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  // Giriş işlemi
  async login(username: string, password: string) {
    try {
      const response = await axios.post(`${API_URL}/users/login`, {
        username,
        password
      }, {
        withCredentials: true
      });
      
      // Eğer ban durumu varsa, token kaydetmeden ban bilgisini dön
      if (response.data.banned) {
        localStorage.removeItem('toh_token');
        localStorage.removeItem('toh_current_user');
        
        // Ban yanıtını döndür
        return {
          success: 0,
          banned: true,
          ban_info: {
            ...response.data.ban_info,
            permanent: response.data.ban_info.permanently,
          },
          error: response.data.error
        };
      }
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.banned) {
        localStorage.removeItem('toh_token');
        localStorage.removeItem('toh_current_user');
        
        // Ban yanıtını döndür
        return {
          success: 0,
          banned: true,
          ban_info: {
            ...error.response.data.ban_info,
            permanent: error.response.data.ban_info.permanently,
          },
          error: error.response.data.error
        };
      }
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  // Çıkış işlemi
  async logout() {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, {
        withCredentials: true
      });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('mit_token');
      localStorage.removeItem('mit_current_user');
    }
  },

  // Kullanıcı bilgileri getirme
  async getCurrentUser(): Promise<UserResponse | null> {
    try {
      const response = await axios.get<UserResponse>(`${API_URL}/users/me`, {
        withCredentials: true
      });

      // GraphQL client'ı kullanarak badge bilgilerini güncelle
      // Ban durumunu kontrol et
      if (response.data.banned) {
        return {
          success: 0,
          banned: true,
          ban_info: response.data.ban_info,
          user: {
            ...response.data.user,
            is_banned: true,
            ban_info: response.data.ban_info
          }
        };
      }

      if (response.data.success === 1 && response.data.user) {
        const { client } = await import('./graphqlClient');
        const { GET_CURRENT_USER } = await import('./graphqlClient');
        
        try {
          const graphqlResponse = await client.query({
            query: GET_CURRENT_USER,
            variables: { username: response.data.user.username },
            fetchPolicy: 'no-cache' // Cache'i bypass et, her zaman yeni veri al
          });

          if (graphqlResponse.data.user) {
            // API yanıtını GraphQL verileriyle birleştir ve badgeInfo'yu öncelikli tut
            response.data.user = {
              ...response.data.user,
              ...graphqlResponse.data.user,
              badgeInfo: graphqlResponse.data.user.badgeInfo || response.data.user.badgeInfo
            };

            // localStorage'a güncel badge bilgisini kaydet
            localStorage.setItem('mit_current_badge', JSON.stringify(graphqlResponse.data.user.badgeInfo));
          }
        } catch (graphqlError) {
          console.error('GraphQL error:', graphqlError);
          // GraphQL hatası durumunda localStorage'dan badge bilgisini al
          const cachedBadgeInfo = localStorage.getItem('mit_current_badge');
          if (cachedBadgeInfo) {
            response.data.user.badgeInfo = JSON.parse(cachedBadgeInfo);
          }
        }
      }

      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 401) return null;
      throw error;
    }
  }
};