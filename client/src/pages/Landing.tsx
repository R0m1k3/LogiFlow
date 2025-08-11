import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, Truck, Package, BarChart3 } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">LogiFlow</h1>
                <p className="text-sm text-gray-500">La Foir'Fouille</p>
              </div>
            </div>
            <Button onClick={handleLogin} className="bg-primary hover:bg-blue-700">
              Se connecter
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Système de Gestion Logistique
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Gérez efficacement vos commandes et livraisons avec notre plateforme 
            centralisée pour tous vos magasins La Foir'Fouille.
          </p>
          <Button 
            onClick={handleLogin} 
            size="lg" 
            className="bg-primary hover:bg-blue-700 text-white px-8 py-3 text-lg"
          >
            Commencer maintenant
          </Button>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <Package className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Gestion des Commandes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Suivez et gérez toutes vos commandes fournisseurs en temps réel
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Suivi des Livraisons</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Planifiez et validez vos livraisons avec quantités précises
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Tableaux de Bord</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Analysez vos performances avec des statistiques détaillées
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-delivered rounded-lg flex items-center justify-center mx-auto mb-4">
                <Store className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Multi-Magasins</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Gérez plusieurs magasins avec des permissions granulaires
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="mt-20 text-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Prêt à optimiser votre logistique ?
            </h2>
            <p className="text-gray-600 mb-6">
              Connectez-vous pour accéder à votre tableau de bord personnalisé et 
              commencer à gérer vos commandes et livraisons dès maintenant.
            </p>
            <Button 
              onClick={handleLogin} 
              size="lg" 
              className="bg-primary hover:bg-blue-700 text-white px-8 py-3"
            >
              Accéder à LogiFlow
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
