import React from 'react';
import { Modal } from '../ui/Modal';
import { ExternalLink, Sparkles } from 'lucide-react';

const CHROME_EXTENSION_URL = 'https://chromewebstore.google.com/detail/habbo-j%C3%B6h-y%C3%B6netim/goobfniojmociianafkipafphiffogjb';
const STORAGE_KEY = 'joh-chrome-announcement-date';
const TZ = 'Europe/Istanbul';

/** Bugünün tarihini Türkiye saatine göre YYYY-MM-DD döndürür */
export function getTodayTurkeyDate(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

/** Bu gün duyuru daha önce gösterildi mi? */
export function wasChromeAnnouncementShownToday(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === getTodayTurkeyDate();
  } catch {
    return false;
  }
}

/** Duyurunun bugün gösterildiğini işaretle */
export function markChromeAnnouncementShownToday(): void {
  try {
    localStorage.setItem(STORAGE_KEY, getTodayTurkeyDate());
  } catch {}
}

interface ChromeExtensionAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChromeExtensionAnnouncementModal({ isOpen, onClose }: ChromeExtensionAnnouncementModalProps) {
  const handleClose = () => {
    markChromeAnnouncementShownToday();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Chrome Eklentisi Duyurusu" size="lg">
      <div className="space-y-5">
        <div className="flex items-center gap-3 text-amber-400">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-white">
            Habbo JÖH Chrome Eklentisi Duyuruldu!
          </h2>
        </div>

        <p className="text-gray-300 leading-relaxed">
          Evet, yanlış duymadınız — Habbo JÖH Chrome eklentimiz resmi olarak yayımlandı.
          Bu eklenti sayesinde siteye girmeden işlemlerinizi tek tıkla halledebilirsiniz;
          çalışma sürelerine ve daha fazlasına anında erişim artık tarayıcınızda.
        </p>

        <p className="text-gray-400 text-sm leading-relaxed">
          Tüm JÖH çalışanlarının işini kolaylaştıran bu eklentiyi kullanmanızı öneririz.
        </p>

        <a
          href={CHROME_EXTENSION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500/20 px-4 py-3 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-colors font-medium"
        >
          <ExternalLink className="h-4 w-4" />
          Chrome Web Store&apos;da Eklentiyi Aç
        </a>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-gray-700 px-4 py-2.5 text-white hover:bg-gray-600 transition-colors font-medium min-h-[44px]"
          >
            Tamam
          </button>
        </div>
      </div>
    </Modal>
  );
}
