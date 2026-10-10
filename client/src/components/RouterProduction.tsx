import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { useScreenSize } from "@/hooks/use-screen-size";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import Layout from "@/components/Layout";

// Mobile : coque et page d'accueil chargées immédiatement
import MobileApp from "@/pages/mobile/MobileApp";
import MobileDashboardPage from "@/pages/mobile/DashboardPage";
import MobileLayout from "@/pages/mobile/MobileLayout";

// Les autres pages sont chargées à la demande (un fichier JS par page) : l'écran
// de connexion et le tableau de bord n'attendent plus le code de toutes les pages
// ni la bibliothèque de graphiques. Le <Suspense> est placé dans la zone de
// contenu de Layout et de MobileApp, le menu et l'en-tête restent affichés.
const Calendar = lazy(() => import("@/pages/Calendar"));
const Orders = lazy(() => import("@/pages/Orders"));
const Deliveries = lazy(() => import("@/pages/Deliveries"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const Groups = lazy(() => import("@/pages/Groups"));
const Users = lazy(() => import("@/pages/Users"));
const BLReconciliation = lazy(() => import("@/pages/BLReconciliation"));
const Publicities = lazy(() => import("@/pages/Publicities"));
const CustomerOrders = lazy(() => import("@/pages/CustomerOrders"));
const DlcPage = lazy(() => import("@/pages/DlcPage"));
const Utilities = lazy(() => import("@/pages/Utilities"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const SavTickets = lazy(() => import("@/pages/SavTickets"));
const Avoirs = lazy(() => import("@/pages/Avoirs"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const PaymentSchedulePage = lazy(() => import("@/pages/PaymentSchedulePage"));
const Contacts = lazy(() => import("@/pages/Contacts"));

// Pages mobiles chargées à la demande
const MobileOrdersPage = lazy(() => import("@/pages/mobile/OrdersPage"));
const MobileDeliveriesPage = lazy(() => import("@/pages/mobile/DeliveriesPage"));
const MobileCalendarPage = lazy(() => import("@/pages/mobile/CalendarPage"));
const MobileTasksPage = lazy(() => import("@/pages/mobile/TasksPage"));
const MobilePublicitiesPage = lazy(() => import("@/pages/mobile/PublicitiesPage"));
const MobileCustomerOrdersPage = lazy(() => import("@/pages/mobile/CustomerOrdersPage"));
const MobileDlcPage = lazy(() => import("@/pages/mobile/DlcPage"));
const MobileSavPage = lazy(() => import("@/pages/mobile/SavPage"));
const MobileAvoirsPage = lazy(() => import("@/pages/mobile/AvoirsPage"));

// Pages sans version mobile : affichées dans le cadre téléphone (en-tête, barre
// du bas et menu) pour ne jamais laisser une page sans navigation
function withMobileFrame(Page: ComponentType) {
  return function MobileFramedPage() {
    return (
      <MobileLayout>
        <div className="p-3">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          }>
            <Page />
          </Suspense>
        </div>
      </MobileLayout>
    );
  };
}

const MobileFramedContacts = withMobileFrame(Contacts);
const MobileFramedSuppliers = withMobileFrame(Suppliers);
const MobileFramedGroups = withMobileFrame(Groups);
const MobileFramedUsers = withMobileFrame(Users);
const MobileFramedBLReconciliation = withMobileFrame(BLReconciliation);
const MobileFramedUtilities = withMobileFrame(Utilities);
const MobileFramedAnalytics = withMobileFrame(Analytics);
const MobileFramedPaymentSchedule = withMobileFrame(PaymentSchedulePage);
const MobileFramedNotFound = withMobileFrame(NotFound);

// Helper component to handle redirection
const RedirectToAuth = () => {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/auth");
  }, [setLocation]);
  return <AuthPage />;
};

function RouterProduction() {
  const { isAuthenticated, isLoading, user } = useAuthUnified();
  const { isMobile } = useScreenSize();

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
    return (
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/" component={AuthPage} />
        {/* Redirect all other routes to auth */}
        <Route component={RedirectToAuth} />
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

          {/* Pages sans version mobile : version PC dans le cadre téléphone */}
          <Route path="/contacts" component={MobileFramedContacts} />
          <Route path="/suppliers" component={MobileFramedSuppliers} />
          <Route path="/groups" component={MobileFramedGroups} />
          <Route path="/users" component={MobileFramedUsers} />
          <Route path="/bl-reconciliation" component={MobileFramedBLReconciliation} />
          <Route path="/publicities" component={MobilePublicitiesPage} />
          <Route path="/customer-orders" component={MobileCustomerOrdersPage} />
          <Route path="/dlc" component={MobileDlcPage} />
          <Route path="/utilities" component={MobileFramedUtilities} />
          <Route path="/sav" component={MobileSavPage} />
          <Route path="/avoirs" component={MobileAvoirsPage} />
          <Route path="/analytics" component={MobileFramedAnalytics} />
          <Route path="/payment-schedule" component={MobileFramedPaymentSchedule} />

          {/* Redirection /auth vers dashboard (navigation interne, sans rechargement) */}
          <Route path="/auth">
            <Redirect to="/dashboard" replace />
          </Route>

          <Route path="/" component={MobileDashboardPage} />
          <Route component={MobileFramedNotFound} />
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
        <Route path="/contacts" component={Contacts} />
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
        <Route path="/payment-schedule" component={PaymentSchedulePage} />

        {/* Routes de compatibilité - redirection vers utilities */}
        <Route path="/backup" component={Utilities} />
        <Route path="/nocodb-config" component={Utilities} />
        <Route path="/database-debug" component={Utilities} />
        <Route path="/weather-settings" component={Utilities} />

        {/* Redirection depuis /auth vers dashboard après authentification
            (navigation interne, sans rechargement complet de l'application) */}
        <Route path="/auth">
          <Redirect to="/" replace />
        </Route>

        <Route path="/" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default RouterProduction;