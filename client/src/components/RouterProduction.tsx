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
import CustomerOrders from "@/pages/CustomerOrders";
import RoleManagement from "@/pages/RoleManagement";
import DlcPage from "@/pages/DlcPage";
import Tasks from "@/pages/Tasks";
import TasksSimplified from "@/pages/TasksSimplified";
import Layout from "@/components/Layout";

function RouterProduction() {
  const { isAuthenticated, isLoading, user, environment, error } = useAuthUnified();
  
  // Debug complet pour la production
  console.log('🔍 RouterProduction Debug:', {
    environment,
    isAuthenticated,
    isLoading,
    hasUser: !!user,
    userId: user?.id,
    username: user?.username,
    error: error?.message
  });
  
  // Debug minimal basé sur l'environnement
  if (environment === 'production' && error) {
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
        <Route path="/roles" component={RoleManagement} />
        <Route path="/role-management" component={RoleManagement} />
        <Route path="/bl-reconciliation" component={BLReconciliation} />
        <Route path="/publicities" component={Publicities} />
        <Route path="/customer-orders" component={CustomerOrders} />
        <Route path="/dlc" component={DlcPage} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/nocodb-config" component={NocoDBConfig} />
        <Route path="/" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default RouterProduction;