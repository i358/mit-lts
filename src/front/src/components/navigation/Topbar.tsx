import { LogOut, User, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { authAPI } from '../../services/api';
import { NotificationsDropdown } from './NotificationsDropdown';

export function Topbar() {
  const navigate = useNavigate();
  const { user, logout } = useAppStore();
  const username = user?.username || '';
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const handleLogout = () => {
    authAPI.logout();
    logout();
    navigate('/');
  };

  return (
    <div className="bg-gray-800 h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          <div className="text-white text-xl font-bold">
            Admin Panel
          </div>

          <div className="flex items-center space-x-4">
            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative flex items-center justify-center p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="Duyurular"
              >
                <Bell className="h-5 w-5" />
              </button>
              <NotificationsDropdown
                isOpen={isNotificationsOpen}
                onToggle={() => setIsNotificationsOpen(false)}
              />
            </div>

            <div className="flex items-center text-gray-300">
              <User className="h-5 w-5 mr-2" />
              <span>{username}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <LogOut className="h-5 w-5 mr-2" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}