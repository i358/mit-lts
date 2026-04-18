import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, User, Theme } from '../types';

interface AppStore extends AppState {
  setUser: (user: User | null) => void;
  setTheme: (theme: Theme) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setCurrentPage: (page: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  logout: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      user: null,
      theme: 'dark',
      isAuthenticated: false,
      currentPage: 'welcome',
      sidebarCollapsed: false,

      setUser: (user) => set((state) => {
        // Eğer user null ise, mevcut state'i koru
        if (!user) return { user: null };

        // Mevcut badge bilgilerini koru, eğer yeni gelen bilgiler daha güncel değilse
        if (state.user?.badgeInfo && !user.badgeInfo) {
          return {
            user: {
              ...user,
              badgeInfo: state.user.badgeInfo,
              is_banned: state.user.is_banned,
              ban_info: state.user.ban_info
            }
          };
        }

        // Yeni badge bilgileri varsa, localStorage'a kaydet
        if (user.badgeInfo) {
          localStorage.setItem('mit_current_badge', JSON.stringify(user.badgeInfo));
        }

        return { user };
      }),
      setTheme: (theme) => set({ theme }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setCurrentPage: (page) => set({ currentPage: page }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      logout: () => {
        localStorage.removeItem('mit_current_badge');
        set({ 
          user: null, 
          isAuthenticated: false, 
          currentPage: 'welcome' 
        });
      },
    }),
    {
      name: 'mit-app-storage',
      partialize: (state) => ({ 
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);