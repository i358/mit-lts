//@ts-nocheck
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Settings, LogOut, User, Moon, Sun } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { authAPI } from '../../services/api';
import { useQuery } from '@apollo/client/react';
import { GET_CURRENT_USER } from '../../services/graphqlClient';
import { NotificationsDropdown } from '../navigation/NotificationsDropdown';

export function Header() {
  const { user: appUser, theme, setTheme, logout } = useAppStore();
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: userData, loading } = useQuery(GET_CURRENT_USER, {
    variables: { username: appUser?.username },
    skip: !appUser?.username
  });

  const user = userData?.user || appUser;

  const handleLogout = () => {
    authAPI.logout();
    logout();
    window.location.href = '/';
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="fixed top-0 right-0 left-0 z-30 bg-gray-950/80 backdrop-blur-lg border-b border-gray-700/50">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold text-white">
            JÖH Yönetim Paneli
          </h2>
        </div>

        <div className="flex items-center space-x-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-800/50 border border-gray-600/50 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg bg-gray-800/50 border border-gray-600/50 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </button>

            <NotificationsDropdown
              isOpen={showNotifications}
              onToggle={() => setShowNotifications(false)}
            />
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{user?.username}</p>
              {(user?.badgeInfo?.badge > 0 && user?.badgeInfo?.rank < 1) ? null : (
                <p className={`text-xs ${
                  user?.badgeInfo?.badge < 1 && user?.badgeInfo?.rank < 1 
                    ? 'text-gray-400'
                    : 'text-gray-400'
                }`}>
                  {(user?.badgeInfo?.badge < 1 && user?.badgeInfo?.rank < 1) ? 'Stajyer' :
                   user?.badgeInfo?.rankName}
                </p>
              )}
            </div>
            
            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${user.username}&background=475569&color=fff`;
                  }}
                />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-gray-800/50 border border-gray-600/50 text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}