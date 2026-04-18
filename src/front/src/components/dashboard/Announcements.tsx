import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { mitAPI } from '../../services/api';
import { AnnouncementModal } from '../modals/AnnouncementModal';
import { AnnouncementDetailsModal } from '../modals/AnnouncementDetailsModal';
import { useAppStore } from '../../store/useAppStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Bell, Plus, FileText, Megaphone, Wrench } from 'lucide-react';

interface AnnouncementItem {
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

interface AnnouncementsProps {
  userRoles?: string[];
}

export const Announcements: React.FC<AnnouncementsProps> = ({ userRoles }) => {
  const { user } = useAppStore();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('');

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

  const roles = userRoles || user?.permissions?.roles || getPersistedRoles();
  const isAdminOrModerator = roles.includes('ADMIN') || roles.includes('MODERATOR');

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async (type?: string) => {
    try {
      setIsLoading(true);
      const response = await mitAPI.getAnnouncements({
        type: type ? (type as 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS') : undefined,
        limit: 50
      });

      if (response.success) {
        setAnnouncements(response.data);
      } else {
        toast.error('Duyurular yüklenemedi');
      }
    } catch (error: any) {
      console.error('Error loading announcements:', error);
      toast.error(error.message || 'Duyurular yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (type: string) => {
    setSelectedFilter(type);
    loadAnnouncements(type || undefined);
  };

  const handlePublishSuccess = () => {
    loadAnnouncements(selectedFilter || undefined);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="w-full space-y-6">
      <Card className="bg-gray-900 border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Duyurular</h2>
              <p className="text-sm text-gray-400">Güncellemeler, duyurular ve planlar</p>
            </div>
          </div>

          {isAdminOrModerator && (
            <Button
              onClick={() => setIsModalOpen(true)}
              icon={Plus}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
            >
              Yeni Duyuru
            </Button>
          )}
        </div>

        {/* Filtreler */}
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => handleFilterChange('')}
              className={`px-4 py-2 rounded-lg border transition-all ${
                selectedFilter === ''
                  ? 'border-red-500 bg-red-500/20'
                  : 'border-gray-600 bg-gray-800 hover:border-gray-500'
              }`}
            >
              <span className="text-gray-200 text-sm font-medium">Tümü</span>
            </button>

            <button
              type="button"
              onClick={() => handleFilterChange('UPDATE_NOTES')}
              className={`px-4 py-2 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                selectedFilter === 'UPDATE_NOTES'
                  ? 'border-red-500 bg-red-500/20'
                  : 'border-gray-600 bg-gray-800 hover:border-gray-500'
              }`}
            >
              <FileText className="w-4 h-4 text-gray-300" />
              <span className="text-gray-200 text-sm font-medium">Notlar</span>
            </button>

            <button
              type="button"
              onClick={() => handleFilterChange('ANNOUNCEMENT')}
              className={`px-4 py-2 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                selectedFilter === 'ANNOUNCEMENT'
                  ? 'border-red-500 bg-red-500/20'
                  : 'border-gray-600 bg-gray-800 hover:border-gray-500'
              }`}
            >
              <Megaphone className="w-4 h-4 text-gray-300" />
              <span className="text-gray-200 text-sm font-medium">Duyuru</span>
            </button>

            <button
              type="button"
              onClick={() => handleFilterChange('PLANS')}
              className={`px-4 py-2 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                selectedFilter === 'PLANS'
                  ? 'border-red-500 bg-red-500/20'
                  : 'border-gray-600 bg-gray-800 hover:border-gray-500'
              }`}
            >
              <Wrench className="w-4 h-4 text-gray-300" />
              <span className="text-gray-200 text-sm font-medium">Plan</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Duyurular Listesi */}
      <div className="space-y-4">
        {isLoading ? (
          <Card className="bg-gray-900 border-gray-700">
            <div className="p-8 text-center">
              <p className="text-gray-400">Yükleniyor...</p>
            </div>
          </Card>
        ) : announcements.length === 0 ? (
          <Card className="bg-gray-900 border-gray-700">
            <div className="p-8 text-center">
              <p className="text-gray-400">Duyuru bulunmamaktadır</p>
            </div>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <motion.div
              key={announcement.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                hover
                onClick={() => {
                  setSelectedAnnouncementId(announcement.id);
                  setIsDetailsModalOpen(true);
                }}
                className="p-6 bg-gray-900 border-gray-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Başlık ve Meta */}
                    <h3 className="text-lg font-semibold text-white mb-2 truncate">
                      {announcement.title}
                    </h3>

                    {/* Kategoriler */}
                    <div className="flex gap-2 mb-3 flex-wrap">
                      <span className="inline-flex items-center px-2 py-1 bg-gray-800 text-gray-200 text-xs rounded-lg border border-gray-700">
                        {announcement.type_name}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 bg-gray-800 text-gray-200 text-xs rounded-lg border border-gray-700">
                        {announcement.sub_type_name}
                      </span>
                    </div>

                    {/* Açıklama (Kısaltılmış) */}
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                      {announcement.description}
                    </p>

                    {/* Alt Bilgiler */}
                    <div className="flex gap-3 text-xs text-gray-400">
                      <span>👤 {announcement.published_by}</span>
                      <span>🕒 {formatDate(announcement.published_at)}</span>
                    </div>
                  </div>

                  {/* Detayları Aç İkonu */}
                  <div className="flex-shrink-0 text-gray-500 text-xl">
                    →
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Modals */}
      <AnnouncementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPublish={handlePublishSuccess}
      />

      <AnnouncementDetailsModal
        isOpen={isDetailsModalOpen}
        announcementId={selectedAnnouncementId}
        onClose={() => setIsDetailsModalOpen(false)}
      />
    </div>
  );
};

export default Announcements;
