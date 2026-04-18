//@ts-nocheck
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Home, 
  TrendingUp, 
  DollarSign, 
  Users, 
  CreditCard, 
  GraduationCap,
  UserPlus,
  UserMinus,
  Archive,
  Shield,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  SettingsIcon,
  ChevronDown,
  Bell,
  Gamepad2,
  CalendarDays,
  Clock,
  Trophy
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Badge } from '../ui/Badge';
import { useActivity } from '../../contexts/ActivityContext';

const menuCategories = [
  {
    items: [
      { id: 'home', label: 'Ana Sayfa', icon: Home },
    ]
  },
  {
    category: 'Oyunlar',
    items: [
      { id: 'wordle', label: 'Wordle!', icon: Gamepad2 },
      { id: 'krediner', label: 'Kim Krediner Olmak İster?', icon: Trophy },
    ]
  },
  {
    category: "Sistem",
    items: [
       { id: 'announcements', label: 'Duyurular', icon: Bell },
       { id: 'admin', label: 'Site Yönetici Paneli', icon: Shield, requirePermissions: ['system.MANAGE'] },
    ]
  },
  {
    category: 'İşlemler',
    items: [
      { id: 'promotion', label: 'Terfi', icon: TrendingUp},
      { id: 'demotion', label: 'Tenzil', icon: UserMinus},
      { id: 'education', label: 'Eğitim', icon: GraduationCap, requireBadgeLevel: 3 },
    ]
  },
  {
    category: 'Yüksek Rütbe',
    items: [
      { id: 'bulk-promotion-schedule', label: 'Haftalık Toplu Terfi Takvimi', icon: CalendarDays },
      { id: 'weekly-time-query', label: 'Haftalık Süre Sorgu', icon: Clock },
      { id: 'bulk-promotion', label: 'Toplu Terfi', icon: Users },
      { id: 'bulk-promotion-archive', label: 'Toplu Terfi Arşivi', icon: Archive },
      { id: 'bulk-promotion-chat', label: 'Toplu Terfi Sohbet', icon: MessageSquare },
    ],
    requireBadgeLevel: 19
  },
  {
    category: 'Arşiv',
    items: [
      { id: 'archive', label: 'Terfi & Tenzil Arşivi', icon: Archive },
    ]
  },
  {
    category: 'Diğer',
    items: [
      { id: 'discord-link', label: 'Kullanıcı Ayarları', icon: SettingsIcon},
    ]
  }
];  

export function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed, setSidebarCollapsed, user } = useAppStore();
  const [bugReportDropdownOpen, setBugReportDropdownOpen] = useState(false);
  const { activeCount } = useActivity();

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

  // Admin panelindeyken yetkimiz kalkarsa ana sayfaya yönlendir
  React.useEffect(() => {
    if (currentPage === 'admin' && (!user?.permissions?.raw || BigInt(user.permissions.raw) === 0n)) {
      setCurrentPage('home');
    }
  }, [user?.permissions?.raw, currentPage, setCurrentPage]);

  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className={`fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-700 z-40 transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-80'
      }`}
    >
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-7 h-7 text-white" />
            </div>
            {sidebarCollapsed && activeCount !== null && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-green-600 text-white text-xs font-bold">
                {activeCount}
              </span>
            )}
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-white">
                JÖH
              </h1>
              <p className="text-xs text-gray-400">Yönetim Sistemi</p>
              {activeCount !== null && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-green-400">
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-medium text-white">{activeCount}</span> cihaz/sekme açık
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Menu Items */}
      <nav className="p-4 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {menuCategories.map((category, catIndex) => {
          const visibleItems = category.items.filter(item => {
            // Admin paneli için özel kontrol
            if (item.id === 'admin') {
              return user?.permissions?.raw && BigInt(user.permissions.raw) > 0n;
            }
            // Duyurular için Admin/Moderator kontrolü
            if (item.requireAdminOrModerator) {
              const roles = user?.permissions?.roles || getPersistedRoles();
              return roles.includes('ADMIN') || roles.includes('MODERATOR');
            }
            // Item seviyesinde badge level kontrolü
            if (item.requireBadgeLevel) {
              return user?.badge >= item.requireBadgeLevel;
            }
            // Category seviyesinde badge level kontrolü
            if (category.requireBadgeLevel) {
              return user?.badge >= category.requireBadgeLevel;
            }
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={catIndex}>
              {!sidebarCollapsed && (
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-4 mb-3">
                  {category.category}
                </h3>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <motion.button
                    key={item.id}
                    onClick={() => item.status !== 'soon' && setCurrentPage(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200 group ${
                      currentPage === item.id
                        ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                        : item.status === 'soon'
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 text-left text-sm">{item.label}</span>
                        {item.status === 'soon' && (
                          <Badge variant="secondary" size="sm">Soon</Badge>
                        )}
                      </>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bug Report Button at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-700 bg-gray-900">
        <button
          onClick={() => setBugReportDropdownOpen(!bugReportDropdownOpen)}
          className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 group relative"
        >
          <MessageSquare className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left text-sm font-medium">Bug Report</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${bugReportDropdownOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>

        {/* Dropdown Menu */}
        {bugReportDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="border-t border-gray-700 bg-gray-800/50 py-1"
          >
            <button
              onClick={() => {
                setCurrentPage('bug-report');
                setBugReportDropdownOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-red-500/20 transition-colors"
            >
              Hata Bildir
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}