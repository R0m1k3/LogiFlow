import { Switch, Route } from "wouter";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useScreenSize } from "@/hooks/use-screen-size";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Orders from "@/pages/Orders";
import Deliveries from "@/pages/Deliveries";
import Suppliers from "@/pages/Suppliers";
import Groups from "@/pages/Groups";
import Users from "@/pages/Users";
import BLReconciliation from "@/pages/BLReconciliation";
import Publicities from "@/pages/Publicities";

import NocoDBConfig from "@/pages/NocoDBConfig";
import DatabaseDebug from "@/pages/DatabaseDebug";
import CustomerOrders from "@/pages/CustomerOrders";

import DlcPage from "@/pages/DlcPage";
import BackupManager from "@/pages/BackupManager";
import Utilities from "@/pages/Utilities";
import Tasks from "@/pages/Tasks";
import SavTickets from "@/pages/SavTickets";
import Avoirs from "@/pages/Avoirs";
import WeatherSettings from "@/pages/WeatherSettings";
import Analytics from "@/pages/Analytics";
import SalesAnalysisPage from "@/pages/SalesAnalysisPage";
import PaymentSchedulePage from "@/pages/PaymentSchedulePage";
import Layout from "@/components/Layout";

// Mobile pages
import MobileApp from "@/pages/mobile/MobileApp";
import MobileDashboardPage from "@/pages/mobile/DashboardPage";
import MobileOrdersPage from "@/pages/mobile/OrdersPage";
import MobileDeliveriesPage from "@/pages/mobile/DeliveriesPage";
import MobileCalendarPage from "@/pages/mobile/CalendarPage";
import MobileTasksPage from "@/pages/mobile/TasksPage";

function RouterProduction() {
  const { isAuthenticated, isLoading, user, environment, error } = useAuthUnified();
  const { isMobile } = useScreenSize();

  // Debug uniquement en développement
  if (import.meta.env.DEV) {
    console.log('🔍 RouterProduction Debug:', {
      environment,
      isAuthenticated,
      isLoading,
      hasUser: !!user,
      userId: user?.id,
      username: user?.username,
      isMobile,
      error: error?.message
    });
  }

  // Debug minimal basé sur l'environnement
  if (environment === 'production' && error && import.meta.env.DEV) {
    console.error('🚨 Production Auth Error:', error);
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    if (import.meta.env.DEV) {
      console.log('🔐 Not authenticated, showing auth routes');
    }
    return (
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // ===== MOBILE ROUTES (avec MobileApp pour StoreProvider) =====
  if (isMobile) {
    return (
      <MobileApp>
        <Switch>
          <Route path="/calendar" component={MobileCalendarPage} />
          <Route path="/dashboard" component={MobileDashboardPage} />
          <Route path="/orders" component={MobileOrdersPage} />
          <Route path="/deliveries" component={MobileDeliveriesPage} />
          <Route path="/tasks" component={MobileTasksPage} />

          {/* Pages sans version mobile - utiliser version desktop pour l'instant */}
          <Route path="/suppliers" component={Suppliers} />
          <Route path="/groups" component={Groups} />
          <Route path="/users" component={Users} />
          <Route path="/bl-reconciliation" component={BLReconciliation} />
          <Route path="/publicities" component={Publicities} />
          <Route path="/customer-orders" component={CustomerOrders} />
          <Route path="/dlc" component={DlcPage} />
          <Route path="/utilities" component={Utilities} />
          <Route path="/sav" component={SavTickets} />
          <Route path="/avoirs" component={Avoirs} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/sales-analysis" component={SalesAnalysisPage} />
          <Route path="/payment-schedule" component={PaymentSchedulePage} />

          {/* Redirection /auth vers dashboard */}
          <Route path="/auth">
            {() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
              }
              return <MobileDashboardPage />;
            }}
          </Route>

          <Route path="/" component={MobileDashboardPage} />
          <Route component={NotFound} />
        </Switch>
      </MobileApp>
    );
  }

  // ===== DESKTOP ROUTES (avec Layout standard) =====
  return (
    <Layout>
      <Switch>
        <Route path="/calendar" component={Calendar} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/orders" component={Orders} />
        <Route path="/deliveries" component={Deliveries} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/groups" component={Groups} />
        <Route path="/users" component={Users} />

        <Route path="/bl-reconciliation" component={BLReconciliation} />
        <Route path="/publicities" component={Publicities} />
        <Route path="/customer-orders" component={CustomerOrders} />
        <Route path="/dlc" component={DlcPage} />
        <Route path="/utilities" component={Utilities} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/sav" component={SavTickets} />
        <Route path="/avoirs" component={Avoirs} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/sales-analysis" component={SalesAnalysisPage} />
        <Route path="/payment-schedule" component={PaymentSchedulePage} />

        {/* Routes de compatibilité - redirection vers utilities */}
        <Route path="/backup" component={Utilities} />
        <Route path="/nocodb-config" component={Utilities} />
        <Route path="/database-debug" component={Utilities} />
        <Route path="/weather-settings" component={Utilities} />

        {/* Redirection depuis /auth vers dashboard après authentification */}
        <Route path="/auth">
          {() => {
            if (typeof window !== 'undefined') {
              if (import.meta.env.DEV) {
                console.log('🔄 Authenticated user on /auth, redirecting to dashboard');
              }
              window.location.href = '/';
            }
            return <Dashboard />;
          }}
        </Route>

        <Route path="/" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default RouterProduction;