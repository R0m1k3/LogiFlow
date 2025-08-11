import { Info, ExternalLink, Lock, Mail } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AuthInfo() {
  // En production (pas sur Replit), toujours utiliser l'auth locale
  const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('replit');
  const USE_LOCAL_AUTH = import.meta.env.VITE_USE_LOCAL_AUTH === 'true' || isProduction;

  if (USE_LOCAL_AUTH) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-900">
            <Lock className="w-5 h-5" />
            Authentification locale activée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm text-green-800">
            <div>
              <Badge variant="outline" className="mb-2">Étape 1</Badge>
              <p>L'utilisateur recevra ses identifiants par email ou communication sécurisée</p>
            </div>
            
            <div>
              <Badge variant="outline" className="mb-2">Étape 2</Badge>
              <p>Il se connecte avec son email et mot de passe sur l'application</p>
            </div>
            
            <div>
              <Badge variant="outline" className="mb-2">Étape 3</Badge>
              <p>Le système applique automatiquement ses permissions configurées</p>
            </div>
          </div>
          
          <div className="pt-3 border-t border-green-200">
            <p className="text-sm text-green-700 font-medium mb-2">
              Sécurité :
            </p>
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Mail className="w-4 h-4" />
              <span>Le mot de passe initial sera communiqué de manière sécurisée à l'utilisateur</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Info className="w-5 h-5" />
          Système d'authentification Replit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm text-blue-800">
          <div>
            <Badge variant="outline" className="mb-2">Étape 1</Badge>
            <p>L'utilisateur doit posséder un compte Replit avec l'email spécifié</p>
          </div>
          
          <div>
            <Badge variant="outline" className="mb-2">Étape 2</Badge>
            <p>Il accède à l'application et clique sur "Se connecter"</p>
          </div>
          
          <div>
            <Badge variant="outline" className="mb-2">Étape 3</Badge>
            <p>Le système reconnaît automatiquement l'email et applique les permissions configurées</p>
          </div>
        </div>
        
        <div className="pt-3 border-t border-blue-200">
          <p className="text-sm text-blue-700 font-medium mb-2">
            Si l'utilisateur n'a pas de compte Replit :
          </p>
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <ExternalLink className="w-4 h-4" />
            <span>Il peut en créer un gratuitement sur</span>
            <a 
              href="https://replit.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-blue-900"
            >
              replit.com
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}