import React, { useState, useEffect } from 'react';
import { mitAPI } from '../../services/api';
import { AnnouncementDetailsModal } from '../modals/AnnouncementDetailsModal';
import { useAppStore } from '../../store/useAppStore';

interface NotificationsDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface AnnouncementNotification {
  id: number;
  type: string;
  sub_type: string;
  title: string;
  description: string;
  published_by: string;
  published_at: string;
  type_name: string;
  sub_type_name: string;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ isOpen, onToggle }) => {
  const { setCurrentPage } = useAppStore();
  const [announcements, setAnnouncements] = useState<AnnouncementNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAnnouncements();
    }
  }, [isOpen]);

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true);
      const response = await mitAPI.getLatestAnnouncements(10);

      if (response.success) {
        setAnnouncements(response.data);
      }
    } catch (error: any) {
      console.error('Error loading announcements:', error);
      // Silent error for notifications
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnnouncementClick = (id: number) => {
    setSelectedAnnouncementId(id);
    setIsDetailsModalOpen(true);
    onToggle();
  };

  const truncateText = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case 'UPDATE_NOTES':
        return '📝';
      case 'ANNOUNCEMENT':
        return '📢';
      case 'PLANS':
        return '🔧';
      default:
        return '📌';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins}d önce`;
    if (diffHours < 24) return `${diffHours}s önce`;
    if (diffDays < 7) return `${diffDays}g önce`;

    return date.toLocaleDateString('tr-TR', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <>
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-96 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700 bg-gradient-to-r from-red-500/10 to-orange-500/10">
            <h3 className="text-white font-semibold text-sm">📢 Son Duyurular</h3>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex justify-center items-center h-24">
                <p className="text-gray-400 text-sm">Yükleniyor...</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="flex justify-center items-center h-24">
                <p className="text-gray-400 text-sm">Duyuru bulunmamaktadır</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {announcements.map((ann) => (
                  <button
                    key={ann.id}
                    onClick={() => handleAnnouncementClick(ann.id)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-800/60 transition-colors focus:outline-none"
                  >
                    <div className="flex gap-2">
                      <span className="text-lg flex-shrink-0">{getTypeEmoji(ann.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">
                          {ann.title}
                        </p>
                        <p className="text-gray-300 text-xs mt-1 line-clamp-2">
                          {truncateText(ann.description, 100)}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span className="inline-block px-2 py-0.5 bg-gray-800 text-gray-200 text-xs rounded-lg border border-gray-700">
                            {ann.sub_type_name}
                          </span>
                          <span className="inline-block text-gray-400 text-xs">
                            {formatDate(ann.published_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {announcements.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-700 bg-gray-900">
              <button
                onClick={() => {
                  setCurrentPage('announcements');
                  onToggle();
                }}
                className="w-full text-center text-gray-200 hover:text-white text-xs font-semibold transition-colors"
              >
                Tüm Duyuruları Gör
              </button>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      <AnnouncementDetailsModal
        isOpen={isDetailsModalOpen}
        announcementId={selectedAnnouncementId}
        onClose={() => setIsDetailsModalOpen(false)}
        onUpdated={() => loadAnnouncements()}
      />
    </>
  );
};

export default NotificationsDropdown;
