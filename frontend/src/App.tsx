import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AgentDashboardPage } from './pages/AgentDashboardPage';
import { ElectionMonitoringPage } from './pages/ElectionMonitoringPage';
import { SituationRoomPage } from './pages/SituationRoomPage';
import { PollingUnitsImportPage } from './pages/PollingUnitsImportPage';
import { ElectionAssignmentsPage } from './pages/ElectionAssignmentsPage';
import { ElectionTargetsPage } from './pages/ElectionTargetsPage';
import { PartiesCandidatesPage } from './pages/PartiesCandidatesPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { CustomerCreatePage } from './pages/CustomerCreatePage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { CustomerEditPage } from './pages/CustomerEditPage';
import { CustomersImportPage } from './pages/CustomersImportPage';
import { CustomersListPage } from './pages/CustomersListPage';
import { HomeRedirectPage } from './pages/HomeRedirectPage';
import { LoginPage } from './pages/LoginPage';
import { CampaignsListPage } from './pages/CampaignsListPage';
import { CampaignCreateEditPage } from './pages/CampaignCreateEditPage';
import { CampaignDetailPage } from './pages/CampaignDetailPage';
import { AgentCreateEditPage } from './pages/AgentCreateEditPage';
import { AgentsListPage } from './pages/AgentsListPage';
import { AssignmentPage } from './pages/AssignmentPage';
import { NextCustomerPage } from './pages/NextCustomerPage';
import { ModemsListPage } from './pages/ModemsListPage';
import { SupervisorDashboardPage } from './pages/SupervisorDashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomeRedirectPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<RequireAuth roles={['ADMIN']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/customers" element={<CustomersListPage />} />
            <Route path="/admin/customers/new" element={<CustomerCreatePage />} />
            <Route path="/admin/customers/import" element={<CustomersImportPage />} />
            <Route path="/admin/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/admin/customers/:id/edit" element={<CustomerEditPage />} />
            <Route path="/admin/campaigns" element={<CampaignsListPage />} />
            <Route path="/admin/campaigns/new" element={<CampaignCreateEditPage />} />
            <Route path="/admin/campaigns/:id" element={<CampaignDetailPage />} />
            <Route path="/admin/campaigns/:id/edit" element={<CampaignCreateEditPage />} />
            <Route path="/admin/agents" element={<AgentsListPage />} />
            <Route path="/admin/agents/new" element={<AgentCreateEditPage />} />
            <Route path="/admin/agents/:id/edit" element={<AgentCreateEditPage />} />
            <Route path="/admin/assignments" element={<AssignmentPage />} />
            <Route path="/admin/modems" element={<ModemsListPage />} />
            <Route path="/admin/supervisor" element={<SupervisorDashboardPage />} />
            <Route path="/admin/reports" element={<ReportsPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
          </Route>
          <Route element={<RequireAuth roles={['ADMIN', 'SUPERVISOR']} />}>
            <Route path="/admin/election" element={<SituationRoomPage />} />
            <Route path="/admin/election/polling-units/import" element={<PollingUnitsImportPage />} />
            <Route path="/admin/election/assignments" element={<ElectionAssignmentsPage />} />
            <Route path="/admin/election/targets" element={<ElectionTargetsPage />} />
            <Route path="/admin/election/parties" element={<PartiesCandidatesPage />} />
          </Route>
          <Route element={<RequireAuth roles={['AGENT']} />}>
            <Route path="/agent/dashboard" element={<AgentDashboardPage />} />
            <Route path="/agent/next-customer" element={<NextCustomerPage />} />
            <Route path="/agent/election" element={<ElectionMonitoringPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
