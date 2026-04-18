import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, Send, Bug } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BugReportData {
  title: string;
  description: string;
  category: string;
  priority: string;
}

const categories = [
  'Genel Hata',
  'UI/UX Sorunu',
  'Performans',
  'API Hatası',
  'Veritabanı',
  'Güvenlik',
  'Diğer'
];

const priorities = [
  { value: 'low', label: 'Düşük', color: 'text-gray-400' },
  { value: 'medium', label: 'Orta', color: 'text-yellow-400' },
  { value: 'high', label: 'Yüksek', color: 'text-red-400' },
  { value: 'critical', label: 'Kritik', color: 'text-red-600' }
];

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const [formData, setFormData] = useState<BugReportData>({
    title: '',
    description: '',
    category: 'Genel Hata',
    priority: 'medium'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Lütfen başlık ve açıklama alanlarını doldurun!');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/bug-report', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        priority: formData.priority,
        timestamp: new Date().toISOString()
      });

      if (response.data.success === 1) {
        toast.success('Hata raporu başarıyla gönderildi!');
        setFormData({
          title: '',
          description: '',
          category: 'Genel Hata',
          priority: 'medium'
        });
        onClose();
      } else {
        toast.error(response.data.error || 'Hata raporu gönderilemedi!');
      }
    } catch (error: any) {
      console.error('Bug report error:', error);
      toast.error(error.response?.data?.error || 'Hata raporu gönderilirken bir sorun oluştu!');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof BugReportData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

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
                <Bug className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Hata Bildir</h2>
                <p className="text-sm text-gray-400">Karşılaştığınız sorunu detaylıca açıklayın</p>
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Başlık <span className="text-red-400">*</span>
              </label>
              <Input
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Hatanın kısa bir açıklaması..."
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-500"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Kategori
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-blue-500/20 transition-colors"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Öncelik
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {priorities.map(priority => (
                  <button
                    key={priority.value}
                    type="button"
                    onClick={() => handleChange('priority', priority.value)}
                    className={`px-4 py-2 rounded-lg border transition-all ${
                      formData.priority === priority.value
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                    }`}
                  >
                    <span className={priority.color}>{priority.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Açıklama <span className="text-red-400">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Hatanın nasıl oluştuğunu, ne zaman meydana geldiğini ve etkilerini detaylıca açıklayın..."
                rows={6}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/20 transition-colors resize-none"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-gray-700">
              <Button
                type="submit"
                loading={loading}
                disabled={loading || !formData.title.trim() || !formData.description.trim()}
                icon={Send}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
              >
                {loading ? 'Gönderiliyor...' : 'Raporu Gönder'}
              </Button>
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                İptal
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
