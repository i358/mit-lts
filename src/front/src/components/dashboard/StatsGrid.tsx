import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Briefcase, DollarSign, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useQuery } from '@apollo/client/react';
import { GET_CURRENT_USER } from '../../services/graphqlClient';
import { useAppStore } from '../../store/useAppStore';
import { formatTime } from '../../utils/time';
import { cn } from '../../utils/cn';

interface TimeData {
  storedTotal: number;
  currentSessionTime: number;
  realTimeTotal: number;
  workTime: number;
  requiredWorkTime: number;
  isActive: boolean;
  lastSeen: string;
}

interface BadgeInfo {
  badge: number;
  rank: number;
  badgeName: string | null;
  rankName: string | null;
  requiredTime: number;
}

interface UserData {
  user: {
    id: string;
    username: string;
    avatar: string;
    motto: string;
    dailyTime: number;
    time: TimeData;
    badgeInfo: BadgeInfo;
  };
}

interface Stat {
  title: string;
  value: string;
  progress: number;
  target: string;
  icon: any;
  color: string;
  soon?: boolean;
  beta?: boolean;
}

export function StatsGrid() {
  const { user } = useAppStore();
  const { data, loading } = useQuery<UserData>(GET_CURRENT_USER, {
    variables: { username: user?.username },
    pollInterval: 30000, // 30 saniyede bir güncelle
    skip: !user?.username,
  });

  const stats: Stat[] = [
    {
      title: 'Toplam Süre',
      value: loading ? '...' : formatTime(data?.user?.time?.storedTotal || 0),
      progress: loading ? 0 : Math.min(100, ((data?.user?.time?.storedTotal || 0) / (120 * 60 * 1000)) * 100),
      target: '120 dk',
      icon: Clock,
      color: 'from-primary-500 to-primary-600',
    },
    {
      title: 'Terfi Süresi',
      value: loading ? '...' : formatTime((data?.user?.time?.workTime || 0) * 60 * 1000),
      progress: loading ? 0 : Math.min(100, ((data?.user?.time?.workTime || 0) / (data?.user?.time?.requiredWorkTime || 300)) * 100),
      target: formatTime((data?.user?.time?.requiredWorkTime || 300) * 60 * 1000),
      icon: Briefcase,
      color: 'from-accent-500 to-accent-600',
    },
    {
      title: 'Maaş Süresi',
      value: loading ? '...' : formatTime(data?.user?.time?.storedTotal || 0),
      progress: 0,
      target: '480 dk',
      icon: DollarSign,
      color: 'from-secondary-500 to-secondary-600',
      soon: true
    },
    {
      title: 'Kalan Terfi Süresi',
      value: loading ? '...' : formatTime(Math.max(0, (data?.user?.badgeInfo?.requiredTime || 300) - (data?.user?.time?.workTime || 0)) * 60 * 1000) + ' kaldı',
      progress: loading ? 0 : Math.min(100, ((data?.user?.time?.workTime || 0) / (data?.user?.badgeInfo?.requiredTime || 300)) * 100),
      target: formatTime((data?.user?.badgeInfo?.requiredTime || 300) * 60 * 1000),
      icon: TrendingUp,
      color: 'from-primary-600 to-accent-600'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <Card hover className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                {stat.title}
                {stat.soon && <Badge variant="soon" />}
                {stat.beta && <Badge variant="beta" />}
              </h3>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            
            <div className="mb-4">
              <p className={cn(
                "text-2xl font-bold text-gray-900 dark:text-white",
                stat.soon && "blur-sm select-none"
              )}>
                {stat.value}
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Başlangıç</span>
                <span>Hedef: {stat.target}</span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  className={`h-2 rounded-full bg-gradient-to-r ${stat.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${stat.progress}%` }}
                  transition={{ duration: 1, delay: index * 0.1 + 0.5 }}
                />
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}