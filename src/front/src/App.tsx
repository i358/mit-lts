import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { Dashboard } from './components/dashboard/Dashboard';
import { BannedPage } from './components/banned/BannedPage';
import { MaintenancePage } from './components/maintenance/MaintenancePage';
import { LoadingScreen } from './components/loading/LoadingScreen';
import { useAppStore } from './store/useAppStore';
import { AuthService } from './services/auth.service';
import { ApolloProvider } from '@apollo/client/react';
import client from './services/graphqlClient';
import type { User } from './types';

const LOADING_MIN_MS = 2000; // Animasyonun bitmesi için minimum süre

function App() {
  const { theme, isAuthenticated, setUser, setAuthenticated, user } = useAppStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [loadingMinTimeReached, setLoadingMinTimeReached] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoadingMinTimeReached(true), LOADING_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  const loading = !authChecked || !loadingMinTimeReached;

  const maintenanceMode = false;

  const getPersistedRoles = (): string[] => {
    try {
      const persisted = localStorage.getItem('mit-app-storage');
      if (!persisted) return [];
      const parsed = JSON.parse(persisted);
      const roles = parsed?.state?.user?.permissions?.roles;
      return Array.isArray(roles) ? roles : [];
    } catch {
      return [];
    }
  };

  const getUserRoles = (): string[] => {
    const rolesFromPermissions = user?.permissions?.roles;
    if (Array.isArray(rolesFromPermissions)) return rolesFromPermissions;

    const legacyRoles = (user as any)?.roles;
    return Array.isArray(legacyRoles) ? legacyRoles : [];
  };

  const roles = getUserRoles();
  const effectiveRoles = roles.length ? roles : getPersistedRoles();
  const isAdminOrModerator = effectiveRoles.includes('ADMIN') || effectiveRoles.includes('MODERATOR');

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    // Check for existing session
    const checkAuth = async () => {
      try {
        const response = await AuthService.getCurrentUser();

        if (response?.banned && response.ban_info) {
          // Prepare ban info with correct property names
          const banInfo: BanInfo = {
            ...response.ban_info,
            id: Number(response.ban_info.id),
            permanent: response.ban_info.permanently || false,
            expires: response.ban_info.expires || undefined,
            created_at: response.ban_info.created_at
          };
          
          // Create a minimal user object with ban information
          setUser({
            id: banInfo.user_id,
            username: banInfo.username,
            is_banned: true,
            ban_info: banInfo
          });
          setAuthenticated(true);
        } else if (response?.success === 1 && response.user) {
          const userData = response.user as User;
          
          // localStorage'dan badge bilgisini al
          const cachedBadgeInfo = localStorage.getItem('mit_current_badge');
          
          // Eğer GraphQL'den badge bilgisi gelmediyse ve cache'de varsa, cache'den al
          if (!userData.badgeInfo && cachedBadgeInfo) {
            userData.badgeInfo = JSON.parse(cachedBadgeInfo);
          }
          
          setUser(userData);
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        setAuthenticated(false);
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();

    // Her 15 saniyede bir güncelle (daha sık kontrol)
    const interval = setInterval(checkAuth, 15000);
    return () => clearInterval(interval);
  }, [setUser, setAuthenticated]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (maintenanceMode && (!isAuthenticated || !isAdminOrModerator)) {
    return <MaintenancePage />;
  }

  return (
    <ApolloProvider client={client}>
      <div className="min-h-screen transition-colors duration-300">
        {user?.is_banned && user.ban_info ? (
          <BannedPage banInfo={user.ban_info} />
        ) : (
          isAuthenticated ? <Dashboard /> : <WelcomeScreen />
        )}
        
        <Toaster
          position="top-right"
          toastOptions={{
            success: {
              duration: 4000,
              style: {
                background: '#10391C',
                color: '#86EFAC',
                fontWeight: '500',
                border: '1px solid rgba(134, 239, 172, 0.2)',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              },
              iconTheme: {
                primary: '#86EFAC',
                secondary: '#10391C',
              },
            },
            error: {
              duration: 4000,
              style: {
                background: '#391010',
                color: '#FECACA',
                fontWeight: '500',
                border: '1px solid rgba(254, 202, 202, 0.2)',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              },
              iconTheme: {
                primary: '#FECACA',
                secondary: '#391010',
              },
            },
          }}
        />
      </div>
    </ApolloProvider>
  );
  /*return (
    <ApolloProvider client={client}>
      <div className="min-h-screen transition-colors duration-300"
        {user?.is_banned && user.ban_info ? (
          <BannedPage banInfo={user.ban_info} />
        ) : (
          isAuthenticated ? <Dashboard /> : <WelcomeScreen />
        )}
        
        <Toaster
          position="top-right"
          toastOptions={{
            success: {
              duration: 4000,
              style: {
                background: '#10391C',
                color: '#86EFAC',
                fontWeight: '500',
                border: '1px solid rgba(134, 239, 172, 0.2)',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              },
              iconTheme: {
                primary: '#86EFAC',
                secondary: '#10391C',
              },
            },
            error: {
              duration: 4000,
              style: {
                background: '#391010',
                color: '#FECACA',
                fontWeight: '500',
                border: '1px solid rgba(254, 202, 202, 0.2)',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              },
              iconTheme: {
                primary: '#FECACA',
                secondary: '#391010',
              },
            },
          }}
        />
      </div>
    </ApolloProvider>
  );*/
}

export default App;