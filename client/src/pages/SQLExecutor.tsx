import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, Play, Copy, AlertTriangle, Database } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function SQLExecutor() {
  const { toast } = useToast();
  const [sqlContent, setSqlContent] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const executeMutation = useMutation({
    mutationFn: async (sql: string) => {
      setLogs([]);
      setIsExecuting(true);
      
      const response = await fetch('/api/admin/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'exécution SQL');
      }

      return response.json();
    },
    onSuccess: (result) => {
      setLogs(prev => [...prev, '✅ Exécution SQL terminée avec succès']);
      if (result.logs) {
        setLogs(prev => [...prev, ...result.logs]);
      }
      if (result.results) {
        setLogs(prev => [...prev, `📊 Résultats: ${JSON.stringify(result.results, null, 2)}`]);
      }
      
      toast({
        title: "Succès",
        description: "SQL exécuté avec succès",
      });
    },
    onError: (error: any) => {
      setLogs(prev => [...prev, `❌ Erreur: ${error.message}`]);
      
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsExecuting(false);
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.sql')) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier .sql",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setSqlContent(content);
      setLogs([`📁 Fichier ${file.name} chargé (${content.length} caractères)`]);
    };
    reader.readAsText(file);
  };

  const handleExecuteSQL = () => {
    if (!sqlContent.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir du SQL à exécuter",
        variant: "destructive",
      });
      return;
    }

    setLogs([`🔄 Début de l'exécution SQL...`]);
    executeMutation.mutate(sqlContent);
  };

  const handleCopyWebhookSQL = () => {
    const webhookSQL = `-- Script pour créer la table webhook_bap_config
CREATE TABLE IF NOT EXISTS webhook_bap_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Configuration BAP',
  webhook_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adresse du webhook : à renseigner dans Paramètres > Configuration BAP

-- Commentaire sur la table
COMMENT ON TABLE webhook_bap_config IS 'Configuration pour webhook BAP n8n';

-- Vérification finale
SELECT 'Table webhook_bap_config créée!' AS message;
SELECT COUNT(*) AS nb_configs FROM webhook_bap_config;`;

    setSqlContent(webhookSQL);
    navigator.clipboard.writeText(webhookSQL);
    
    toast({
      title: "SQL copié",
      description: "Le script webhook BAP a été copié et collé",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Exécution SQL</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Avertissement de Sécurité
          </CardTitle>
          <CardDescription>
            Cette fonctionnalité permet d'exécuter du SQL directement sur la base de données. 
            Utilisez-la avec précaution et uniquement pour des opérations de maintenance.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Script SQL</CardTitle>
            <CardDescription>
              Collez votre SQL ou uploadez un fichier .sql
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Charger fichier SQL
              </Button>
              
              <Button
                variant="outline"
                onClick={handleCopyWebhookSQL}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                SQL Webhook BAP
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".sql"
              onChange={handleFileUpload}
              className="hidden"
            />

            <Textarea
              placeholder="-- Collez votre SQL ici ou utilisez le bouton pour charger un fichier..."
              value={sqlContent}
              onChange={(e) => setSqlContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />

            <Button 
              onClick={handleExecuteSQL}
              disabled={!sqlContent.trim() || isExecuting}
              className="w-full flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isExecuting ? 'Exécution en cours...' : 'Exécuter SQL'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs d'exécution</CardTitle>
            <CardDescription>
              Résultats et messages de l'exécution SQL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded-md min-h-[300px] font-mono text-sm overflow-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">Aucun log pour l'instant...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}