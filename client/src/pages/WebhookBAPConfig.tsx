import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send, Globe, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface WebhookBapConfig {
  id: number;
  name: string;
  webhookUrl: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function WebhookBAPConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "Configuration BAP",
    webhookUrl: "",
    description: "",
    isActive: true
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['/api/webhook-bap-config'],
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!formData.webhookUrl) {
        throw new Error("URL webhook requise pour le test");
      }
      
      const response = await fetch('/api/webhook-bap-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: formData.webhookUrl }),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors du test');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test réussi",
        description: "Le webhook BAP répond correctement",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Échec du test",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('/api/webhook-bap-config', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhook-bap-config'] });
      toast({
        title: "Configuration sauvegardée",
        description: "La configuration du webhook BAP a été mise à jour",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de sauvegarde",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (config) {
      // Gérer à la fois les cas où l'API retourne un objet ou un array
      const configData = Array.isArray(config) && config.length > 0 ? config[0] : config;
      if (configData && typeof configData === 'object') {
        setFormData({
          name: configData.name || "Configuration BAP",
          webhookUrl: configData.webhookUrl || "",
          description: configData.description || "",
          isActive: configData.isActive ?? true
        });
      }
    }
  }, [config]);

  const handleSave = () => {
    if (!formData.webhookUrl.trim()) {
      toast({
        title: "Erreur",
        description: "L'URL du webhook est requise",
        variant: "destructive",
      });
      return;
    }

    if (!formData.webhookUrl.startsWith('http')) {
      toast({
        title: "Erreur",
        description: "L'URL doit commencer par http:// ou https://",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(formData);
  };

  const handleTest = () => {
    if (!formData.webhookUrl.trim()) {
      toast({
        title: "Erreur",
        description: "L'URL du webhook est requise pour effectuer le test",
        variant: "destructive",
      });
      return;
    }
    testMutation.mutate();
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(formData.webhookUrl);
    toast({
      title: "URL copiée",
      description: "L'URL a été copiée dans le presse-papiers",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Chargement de la configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            Configuration Webhook BAP
          </CardTitle>
          <CardDescription>
            Configurez l'URL du webhook n8n pour l'envoi des fichiers BAP vers Prissela et Célia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de la configuration</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Configuration BAP"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookUrl">URL du Webhook n8n *</Label>
            <div className="flex gap-2">
              <Input
                id="webhookUrl"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                placeholder="https://workflow.ffnancy.fr/webhook/..."
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={copyUrl} disabled={!formData.webhookUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              URL complète du webhook n8n qui recevra les fichiers PDF BAP
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description optionnelle de cette configuration..."
              className="h-20"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
            <Label htmlFor="isActive">Configuration active</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-green-600" />
            Test de Connexion
          </CardTitle>
          <CardDescription>
            Testez la connectivité avec le webhook n8n configuré
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleTest}
              disabled={testMutation.isPending || !formData.webhookUrl}
              className="flex items-center gap-2"
            >
              {testMutation.isPending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Test en cours...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Tester le Webhook
                </>
              )}
            </Button>
            
            {testMutation.isSuccess && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">Connexion réussie</span>
              </div>
            )}
            
            {testMutation.isError && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Échec de la connexion</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button 
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2"
        >
          {saveMutation.isPending ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Sauvegarde...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Sauvegarder
            </>
          )}
        </Button>
      </div>
    </div>
  );
}