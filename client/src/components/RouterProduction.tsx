import { Switch, Route } from "wouter";
import { useAuthUnified } from "@/hooks/useAuthUnified";
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
import Layout from "@/components/Layout";

function RouterProduction() {
  const { isAuthenticated, isLoading, user, environment, error } = useAuthUnified();
  
  // Debug uniquement en développement
  if (import.meta.env.DEV) {
    console.log('🔍 RouterProduction Debug:', {
      environment,
      isAuthenticated,
      isLoading,
      hasUser: !!user,
      userId: user?.id,
      username: user?.username,
      error: error?.message
    });
  }
  
  // Debug minimal basé sur l'environnement
  if (environment === 'production' && error && import.meta.env.DEV) {
    console.error('🚨 Production Auth Error:', error);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirection automatique vers la page d'authentification
    if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
      if (import.meta.env.DEV) {
        console.log('🔄 User not authenticated, redirecting to auth page');
      }
      window.location.href = '/auth';
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-surface">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Redirection...</p>
          </div>
        </div>
      );
    }
    
    return (
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

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