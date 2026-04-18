import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { mitAPI } from '../../services/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, Send, Bell } from 'lucide-react';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: () => void;
}

interface AnnouncementType {
  type: string;
  name: string;
  subtypes: Array<{ id: string; name: string }>;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  isOpen,
  onClose,
  onPublish
}) => {
  const [types, setTypes] = useState<AnnouncementType[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedSubType, setSelectedSubType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  // Duyuru türlerini yükle
  useEffect(() => {
    if (isOpen && types.length === 0) {
      loadTypes();
    }
  }, [isOpen]);

  const loadTypes = async () => {
    try {
      setIsLoadingTypes(true);
      const response = await mitAPI.getAnnouncementTypes();
      if (response.success) {
        setTypes(response.data);
        if (response.data.length > 0) {
          setSelectedType(response.data[0].type);
          setSelectedSubType(response.data[0].subtypes[0]?.id || '');
        }
      }
    } catch (error) {
      console.error('Error loading types:', error);
      toast.error('Duyuru türleri yüklenemedi');
    } finally {
      setIsLoadingTypes(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !description.trim() || !selectedType || !selectedSubType) {
      toast.error('Lütfen tüm alanları doldurunuz');
      return;
    }

    try {
      setIsLoading(true);
      const response = await mitAPI.publishAnnouncement({
        type: selectedType as 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS',
        sub_type: selectedSubType,
        title,
        description
      });

      if (response.success) {
        toast.success('Duyuru başarıyla yayınlandı!');
        setTitle('');
        setDescription('');
        onPublish();
        onClose();
      } else {
        toast.error(response.error || 'Duyuru yayınlanırken hata oluştu');
      }
    } catch (error: any) {
      console.error('Error publishing announcement:', error);
      toast.error(error.message || 'Duyuru yayınlanırken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentType = types.find(t => t.type === selectedType);
  const subtypes = currentType?.subtypes || [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl"
      >
        <Card className="bg-gray-900 border-gray-700 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Yeni Duyuru</h2>
                <p className="text-sm text-gray-400">Duyuru yayınlamak için alanları doldurun</p>
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

          <div className="p-6 space-y-6">
            {/* Duyuru Türü */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Duyuru Türü</label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  const newType = types.find(t => t.type === e.target.value);
                  setSelectedSubType(newType?.subtypes[0]?.id || '');
                }}
                disabled={isLoadingTypes}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:ring-red-500/20 transition-colors"
              >
                {types.map((type) => (
                  <option key={type.type} value={type.type}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Alt Türü */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Alt Kategorisi</label>
              <select
                value={selectedSubType}
                onChange={(e) => setSelectedSubType(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:ring-red-500/20 transition-colors"
              >
                {subtypes.map((subtype) => (
                  <option key={subtype.id} value={subtype.id}>
                    {subtype.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Başlık */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Başlık</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Duyuru başlığı girin"
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">{title.length}/100</p>
            </div>

            {/* Açıklama */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Açıklama</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Duyuru açıklaması girin"
                maxLength={1000}
                rows={6}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-red-500 focus:ring-red-500/20 transition-colors resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">{description.length}/1000</p>
            </div>

            {/* Butonlar */}
            <div className="flex gap-4 pt-4 border-t border-gray-700">
              <Button
                onClick={handlePublish}
                loading={isLoading}
                disabled={isLoading || isLoadingTypes}
                icon={Send}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
              >
                {isLoading ? 'Yayınlanıyor...' : 'Yayınla'}
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
                disabled={isLoading}
              >
                İptal
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default AnnouncementModal;
