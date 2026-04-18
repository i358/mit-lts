import { TimeReset } from '../../../components/dashboard/TimeReset';
import { DashboardLayout } from '../../../components/layouts/DashboardLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { hasPermission } from '../../../utils/permissions';
import { TIME } from '../../../constants/permissions';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function TimeResetPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission(TIME.RESET)) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Süre Sıfırlama"
        description="Kullanıcı çalışma sürelerini sıfırla"
      />
      <TimeReset />
    </DashboardLayout>
  );
}