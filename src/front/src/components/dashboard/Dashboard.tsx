import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ActivityProvider } from '../../contexts/ActivityContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DashboardHome } from './DashboardHome';
import { PromotionForm } from './PromotionForm';
import { DemotionForm } from './DemotionForm';
import { SalaryForm } from './SalaryForm';
import { BulkPromotionForm } from './BulkPromotionForm';
import { BulkPromotionArchiveView } from './BulkPromotionArchiveView';
import { BulkPromotionScheduleView } from './BulkPromotionScheduleView';
import { BulkPromotionChatView } from './BulkPromotionChatView';
import { WeeklyTimeQueryView } from './WeeklyTimeQueryView';
import { LicenseForm } from './LicenseForm';
import { TrainingView } from './TrainingView';
import { TransferInForm } from './TransferInForm';
import { TransferOutForm } from './TransferOutForm';
import { ActiveUsers } from './ActiveUsers';
import { ArchiveView } from './ArchiveView';
import { DiscordLinkView } from './DiscordLinkView';
import { AdminPanel } from './AdminPanel';
import { UserManagement } from './UserManagement';
import { useAppStore } from '../../store/useAppStore';
import { TimeManagement } from './TimeManagement';
import { BugReportModal } from './BugReportModal';
import { Announcements } from './Announcements';
import { WordleView } from './WordleView';
import { KredinerView } from './KredinerView';
import {
  ChromeExtensionAnnouncementModal,
  wasChromeAnnouncementShownToday
} from './ChromeExtensionAnnouncementModal';

export function Dashboard() {
  const { currentPage, sidebarCollapsed, setCurrentPage, user } = useAppStore();
  const [showChromeAnnouncement, setShowChromeAnnouncement] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!wasChromeAnnouncementShownToday()) {
      setShowChromeAnnouncement(true);
    }
  }, [user]);

  if (user?.hasCodeName === false) {
    return (
      <div className="min-h-screen bg-gray-950">
        <div className="p-6 pt-24">
          <DiscordLinkView
            codeOnly
            onCodeSet={() => {
              setCurrentPage('home');
            }}
          />
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'home':
        return <DashboardHome />;
      case 'discord-link':
        return <DiscordLinkView />;
      case 'promotion':
        return <PromotionForm />;
      case 'demotion':
        return <DemotionForm />;
      case 'salary':
        return <SalaryForm />;
      case 'bulk-promotion-schedule':
        return <BulkPromotionScheduleView />;
      case 'weekly-time-query':
        return <WeeklyTimeQueryView />;
      case 'bulk-promotion-chat':
        return <BulkPromotionChatView />;
      case 'bulk-promotion':
        return <BulkPromotionForm />;
      case 'bulk-promotion-archive':
        return <BulkPromotionArchiveView />;
      case 'license':
        return <LicenseForm />;
      case 'education':
        return <TrainingView />;
      case 'transfer-in':
        return <TransferInForm />;
      case 'transfer-out':
        return <TransferOutForm />;
      case 'active-users':
        return <ActiveUsers />;
      case 'archive':
        return <ArchiveView />;
      case 'admin':
        return <AdminPanel />;
      case 'admin-users':
        return <UserManagement />;
      case 'admin-time':
        return <TimeManagement />;
      case 'announcements':
        return <Announcements userRoles={user?.permissions?.roles} />;
      case 'wordle':
        return <WordleView />;
      case 'krediner':
        return <KredinerView />;
      case 'bug-report':
        return (
          <>
            <DashboardHome />
            <BugReportModal isOpen={true} onClose={() => setCurrentPage('home')} />
          </>
        );
      default:
        return <DashboardHome />;
    }
  };

  return (
    <ActivityProvider>
      <div className="min-h-screen bg-gray-950">
        <Sidebar />
        <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-80'}`}>
          <Header />
          <main className="p-6 pt-24">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </main>
        </div>
        <ChromeExtensionAnnouncementModal
          isOpen={showChromeAnnouncement}
          onClose={() => setShowChromeAnnouncement(false)}
        />
      </div>
    </ActivityProvider>
  );
}