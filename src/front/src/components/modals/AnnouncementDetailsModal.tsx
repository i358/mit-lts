import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { mitAPI } from '../../services/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { X, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';

interface AnnouncementDetailsModalProps {
  isOpen: boolean;
  announcementId: number | null;
  onClose: () => void;
  onUpdated?: () => void;
}

interface Announcement {
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

export const AnnouncementDetailsModal: React.FC<AnnouncementDetailsModalProps> = ({
  isOpen,
  announcementId,
  onClose,
  onUpdated
}) => {
  const { user } = useAppStore();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const roles = user?.permissions?.roles || getPersistedRoles();
  const isAdminOrModerator = roles.includes('ADMIN') || roles.includes('MODERATOR');
  const isAdmin = roles.includes('ADMIN');

  useEffect(() => {
    if (isOpen && announcementId) {
      loadAnnouncement();
    }
  }, [isOpen, announcementId]);

  const loadAnnouncement = async () => {
    if (!announcementId) return;

    try {
      setIsLoading(true);
      const response = await mitAPI.getAnnouncementDetails(announcementId);
      if (response.success) {
        setAnnouncement(response.data);
        setEditTitle(response.data?.title || '');
        setEditDescription(response.data?.description || '');
      }
    } catch (error) {
      console.error('Error loading announcement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!announcement) return;
    if (!editTitle.trim() || !editDescription.trim()) {
      toast.error('Başlık ve açıklama boş olamaz');
      return;
    }

    try {
      setIsSaving(true);
      const response = await mitAPI.editAnnouncement(announcement.id, {
        title: editTitle,
        description: editDescription
      });

      if (response?.success) {
        toast.success('Duyuru güncellendi');
        setIsEditing(false);
        await loadAnnouncement();
        onUpdated?.();
      } else {
        toast.error(response?.error || 'Duyuru güncellenemedi');
      }
    } catch (error: any) {
      console.error('Error editing announcement:', error);
      toast.error(error.message || 'Duyuru güncellenemedi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!announcement) return;
    const confirmed = window.confirm('Bu duyuruyu silmek istediğine emin misin?');
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const response = await mitAPI.deleteAnnouncement(announcement.id);
      if (response?.success) {
        toast.success('Duyuru silindi');
        onClose();
        onUpdated?.();
      } else {
        toast.error(response?.error || 'Duyuru silinemedi');
      }
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      toast.error(error.message || 'Duyuru silinemedi');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-3xl"
      >
        <Card className="bg-gray-900 border-gray-700 shadow-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gradient-to-r from-red-500/10 to-orange-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Duyuru Detayı</h2>
                <p className="text-sm text-gray-400">Duyuru içeriği ve meta bilgileri</p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <p className="text-white text-lg">Yükleniyor...</p>
              </div>
            ) : announcement ? (
              <div className="space-y-6">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Başlık</label>
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        maxLength={100}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-red-500 focus:ring-red-500/20 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">{editTitle.length}/100</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Açıklama</label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={8}
                        maxLength={1000}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-red-500 focus:ring-red-500/20 transition-colors resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">{editDescription.length}/1000</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3 className="text-2xl font-bold text-white leading-tight">{announcement.title}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Tür</p>
                        <p className="text-sm font-semibold text-white">{announcement.type_name}</p>
                      </div>
                      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Kategori</p>
                        <p className="text-sm font-semibold text-white">{announcement.sub_type_name}</p>
                      </div>
                      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Yayınlayan</p>
                        <p className="text-sm font-semibold text-white">{announcement.published_by}</p>
                      </div>
                      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Yayın Tarihi</p>
                        <p className="text-sm font-semibold text-white">{formatDate(announcement.published_at)}</p>
                      </div>
                    </div>

                    <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5">
                      <p className="text-gray-100 whitespace-pre-wrap leading-relaxed">
                        {announcement.description}
                      </p>
                    </div>
                  </>
                )}

                <div className="flex gap-4 pt-4 border-t border-gray-700">
                  {isAdminOrModerator && !isEditing && (
                    <Button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
                    >
                      Düzenle
                    </Button>
                  )}

                  {isEditing && (
                    <>
                      <Button
                        type="button"
                        onClick={handleSave}
                        loading={isSaving}
                        disabled={isSaving || isDeleting}
                        className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
                      >
                        Kaydet
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setEditTitle(announcement.title);
                          setEditDescription(announcement.description);
                        }}
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:bg-gray-800 flex-1"
                        disabled={isSaving || isDeleting}
                      >
                        Vazgeç
                      </Button>
                    </>
                  )}

                  {!isEditing && (
                    <Button
                      type="button"
                      onClick={onClose}
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800 flex-1"
                      disabled={isSaving || isDeleting}
                    >
                      Kapat
                    </Button>
                  )}

                  {isAdmin && !isEditing && (
                    <Button
                      type="button"
                      onClick={handleDelete}
                      loading={isDeleting}
                      disabled={isDeleting || isSaving}
                      variant="destructive"
                      className="flex-1"
                    >
                      Sil
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-white text-lg">Duyuru bulunamadı</p>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </div>,
    document.body
  );
};

export default AnnouncementDetailsModal;
