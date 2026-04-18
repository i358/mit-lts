//@ts-nocheck
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Trophy, 
  TrendingUp,
  Target,
  Award,
  Clock,
  Shield,
  Star,
  Activity,
  Zap
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatsGrid } from './StatsGrid';
import { useAppStore } from '../../store/useAppStore';
import client from '../../services/graphqlClient';
import { GET_CURRENT_USER } from '../../services/graphqlClient';
import { User, UserResponse } from '../../types/user';

import { useActivity } from '../../contexts/ActivityContext';

export function DashboardHome() {
  const { user } = useAppStore();
  const { activeCount } = useActivity();
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.username) {
        try {
          const response = await client.query<UserResponse>({
            query: GET_CURRENT_USER,
            variables: { username: user.username },
            fetchPolicy: 'network-only'
          });
          if (response.data?.user) {
            setCurrentUser(response.data.user);
          }
        } catch (error) {
          console.error('GraphQL error:', error);
        }
      }
    };

    fetchUserData();
    const interval = setInterval(fetchUserData, 15000);

    return () => clearInterval(interval);
  }, [user?.username]);

  const quickActions = [
    {
      title: 'Terfi Ver',
      description: 'Kullanıcıya terfi ver',
      icon: TrendingUp,
      color: 'from-red-500 to-red-600',
      action: () => console.log('Terfi ver')
    },
    {
      title: 'Maaş Rozeti',
      description: 'Maaş rozeti hesapla',
      icon: Award,
      color: 'from-orange-500 to-orange-600',
      action: () => console.log('Maaş rozeti'),
      status: 'soon'
    },
    {
      title: 'Lisans Ver',
      description: 'Kullanıcıya lisans ver',
      icon: Shield,
      color: 'from-gray-600 to-gray-700',
      action: () => console.log('Lisans ver'),
      status: 'soon'
    },
    {
      title: 'Eğitim Planla',
      description: 'Yeni eğitim planla',
      icon: Target,
      color: 'from-red-600 to-orange-500',
      action: () => console.log('Eğitim planla'),
      status: 'soon'
    }
  ];

  const recentActivities = [
    {
      user: 'John Doe',
      action: 'Terfi aldı',
      details: 'Uzman → Uzman Çavuş',
      time: '5 dakika önce',
      type: 'promotion'
    },
    {
      user: 'Jane Smith',
      action: 'Maaş rozeti aldı',
      details: '40 saat çalışma',
      time: '15 dakika önce',
      type: 'salary'
    },
    {
      user: 'Mike Johnson',
      action: 'Lisans aldı',
      details: 'Sniper Lisansı',
      time: '1 saat önce',
      type: 'license'
    }
  ];

  const achievements = [
    {
      title: 'En Aktif Ay',
      description: 'Bu ay 150+ terfi verildi',
      icon: Trophy,
      color: 'from-red-500 to-red-600'
    },
    {
      title: 'Yüksek Performans',
      description: 'Sistem %99.9 uptime',
      icon: Zap,
      color: 'from-orange-500 to-orange-600'
    },
    {
      title: 'Büyük Topluluk',
      description: '300+ aktif üye',
      icon: Users,
      color: 'from-gray-600 to-gray-700'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Card */}
      <Card className="p-8 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-700/50">
        <div className="flex items-start space-x-4">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-r from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            {(currentUser?.avatar || user?.avatar) && (
              <img 
                src={currentUser?.avatar || user?.avatar}
                alt={currentUser?.username || user?.username}
                className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full border-2 border-gray-800"
              />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">
              Hoş geldin, {currentUser?.username || user?.username || 'Komutan'}! 👋
            </h1>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {/* Ana Rozet */}
              <div className="min-w-[120px] text-center px-3 py-1 bg-gradient-to-r from-gray-700 to-gray-600 rounded-lg text-sm text-white font-medium">
                {currentUser?.badgeInfo?.badgeName || 'Stajyer'}
              </div>
              
              {/* Rütbe */}
              {(currentUser?.badgeInfo?.badge > 0 && currentUser?.badgeInfo?.rank < 1) ? null : (
                <div className={`min-w-[120px] text-center px-3 py-1 text-sm font-medium ${
                  currentUser?.badgeInfo?.badge < 1 && currentUser?.badgeInfo?.rank < 1 
                    ? 'text-gray-400'
                    : 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg text-red-300'
                }`}>
                  {(currentUser?.badgeInfo?.badge < 1 && currentUser?.badgeInfo?.rank < 1) ? 'Yetkisiz' :
                   currentUser?.badgeInfo?.rankName}
                </div>
              )}

              {/* Extra Rozetler */}
              {currentUser?.extras && currentUser.extras.map((extra: string, index: number) => (
                <div key={index} className="min-w-[120px] text-center px-3 py-1 bg-gradient-to-r from-purple-900/30 to-purple-800/30 text-purple-400 border border-purple-900/50 rounded-lg text-sm font-medium">
                  {extra}
                </div>
              ))}
            </div>
            <p className="text-gray-300">
              JÖH Yönetim Paneline hoş geldin. Bugün ne yapmak istiyorsun?
            </p>
            {activeCount !== null && (
              <p className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                <Users className="w-4 h-4 text-green-500" />
                Sitede <span className="font-semibold text-green-400">{activeCount}</span> cihaz/sekme açık.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <StatsGrid />

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
          <Zap className="w-6 h-6 mr-2 text-red-500" />
          Hızlı İşlemler
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className={`p-6 transition-all duration-300 group ${
                  action.status === 'soon' ? 'cursor-not-allowed opacity-75' : 'hover:shadow-xl cursor-pointer'
                }`} 
                onClick={() => action.status !== 'soon' && action.action()}
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-xl flex items-center justify-center mb-4 ${
                  action.status !== 'soon' && 'group-hover:scale-110'
                } transition-transform duration-300 shadow-lg`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center mb-2">
                  <h3 className={`text-lg font-semibold text-white ${action.status === 'soon' ? 'blur-[1px]' : ''}`}>
                    {action.title}
                  </h3>
                  {action.status === 'soon' && <Badge variant="soon" className="ml-2" />}
                  {action.status === 'beta' && <Badge variant="beta" className="ml-2" />}
                </div>
                <p className={`text-gray-400 text-sm ${action.status === 'soon' ? 'blur-[1px]' : ''}`}>
                  {action.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

       

      {/* System Status */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <Activity className="w-6 h-6 mr-2 text-green-500" />
          Sistem Durumu
          <span className="ml-2 text-sm text-green-400">Çevrimiçi</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-2 animate-pulse"></div>
            <p className="text-sm font-medium text-white">Discord Bot</p>
            <p className="text-xs text-gray-400">Aktif</p>
          </div>
          <div className="text-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-2 animate-pulse"></div>
            <p className="text-sm font-medium text-white">Habbo API</p>
            <p className="text-xs text-gray-400">Bağlı</p>
          </div>
          <div className="text-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-2 animate-pulse"></div>
            <p className="text-sm font-medium text-white">Veritabanı</p>
            <p className="text-xs text-gray-400">Çalışıyor</p>
          </div>
        </div>
      </Card>
    </div>
  );
}