import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Clock, FileUp, Send } from "lucide-react";

// URL utilisée quand aucun webhook BAP n'est configuré dans les paramètres
const DEFAULT_BAP_WEBHOOK_URL = "https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d";

interface BapUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Envoi d'un bon à payer (PDF) au workflow configuré, avec fenêtre d'attente
export default function BapUploadModal({ open, onOpenChange }: BapUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const stopProcessingTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => stopProcessingTimer, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier PDF",
        variant: "destructive",
      });
    }
  };

  const startProcessingTimer = () => {
    stopProcessingTimer();
    setProcessingSeconds(0);
    timerRef.current = setInterval(() => {
      setProcessingSeconds(prev => {
        if (prev >= 60) {
          stopProcessingTimer();
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handleCloseWaitingModal = () => {
    setShowWaitingModal(false);
    setProcessingSeconds(0);
    stopProcessingTimer();
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendBap = async () => {
    if (!selectedFile || !selectedRecipient) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier PDF et un destinataire",
        variant: "destructive",
      });
      return;
    }

    // Récupérer l'URL webhook configurée
    let webhookUrl = '';
    try {
      const configResponse = await fetch('/api/webhook-bap-config', {
        credentials: 'include'
      });

      if (configResponse.ok) {
        const config = await configResponse.json();
        webhookUrl = config?.webhookUrl;
      }
    } catch (error) {
      console.warn('Impossible de récupérer la config webhook, utilisation URL par défaut');
    }

    if (!webhookUrl) {
      webhookUrl = DEFAULT_BAP_WEBHOOK_URL;
    }

    // Fermer la fenêtre de sélection et ouvrir celle d'attente
    onOpenChange(false);
    setShowWaitingModal(true);
    setIsUploading(true);
    startProcessingTimer();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('recipient', selectedRecipient);
      formData.append('type', 'BAP');
      formData.append('fileName', selectedFile.name);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes

      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      handleCloseWaitingModal();

      toast({
        title: "Succès",
        description: "Fichier BAP envoyé avec succès",
      });

      clearSelectedFile();
      setSelectedRecipient('');

    } catch (error: any) {
      handleCloseWaitingModal();

      let errorMessage = "Impossible d'envoyer le fichier BAP";
      if (error.name === 'AbortError') {
        errorMessage = "Le traitement a pris trop de temps (timeout de 60 secondes)";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });

      // Réouvrir la fenêtre de sélection en cas d'erreur
      onOpenChange(true);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-blue-600" />
              Envoyer un bon à payer (BAP)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-800">Fichier PDF</Label>

              {!selectedFile ? (
                <button
                  type="button"
                  className="w-full border-2 border-dashed border-blue-300 rounded-xl p-8 bg-blue-50 hover:bg-blue-100 transition-colors group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-center space-y-4">
                    <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-700 transition-colors">
                      <FileUp className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-800 mb-2">
                        Choisir un fichier PDF
                      </p>
                      <p className="text-sm text-gray-600">
                        Cliquez pour parcourir vos fichiers
                      </p>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="border-2 border-green-300 rounded-xl p-6 bg-green-50">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-green-600 rounded-full flex items-center justify-center">
                      <FileUp className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-green-800 truncate">{selectedFile.name}</p>
                      <p className="text-sm text-green-700">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} Mo • PDF
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelectedFile}
                      className="border-green-300 text-green-700 hover:bg-green-100"
                    >
                      Changer
                    </Button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-800">Envoyer à</Label>
              <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                <SelectTrigger className="h-12 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                  <SelectValue placeholder="Choisir le destinataire" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Laurie" className="py-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-purple-600">L</span>
                      </div>
                      <span className="font-medium">Laurie</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="Jeremy" className="py-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">J</span>
                      </div>
                      <span className="font-medium">Jeremy</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-12 border-2 border-gray-200 hover:border-gray-300"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSendBap}
                disabled={!selectedFile || !selectedRecipient || isUploading}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer le BAP
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fenêtre d'attente pendant l'envoi */}
      <Dialog open={showWaitingModal} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Traitement en cours...
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <div className="text-sm text-gray-600">
              Envoi du fichier vers le workflow...
            </div>
            <div className="text-sm text-gray-500">
              {processingSeconds < 60
                ? `${processingSeconds}s écoulées`
                : '60s+ écoulées'
              }
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
