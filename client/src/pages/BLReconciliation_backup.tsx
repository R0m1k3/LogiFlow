import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { safeFormat } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/components/Layout";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { Search, Plus, Edit, FileText, Euro, Calendar, Building2, CheckCircle, X, Trash2, RefreshCw, Loader2, Settings, Eye, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format as formatDate } from "date-fns";
import { DayPicker } from "react-day-picker";
import ConfirmDeleteModal from "@/components/modals/ConfirmDeleteModal";

const reconciliationSchema = z.object({
  blNumber: z.string().optional(),
  blAmount: z.string().optional().refine((val) => !val || val === '' || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "Le montant BL doit être un nombre positif ou vide",
  }),
  invoiceReference: z.string().optional(),
  invoiceAmount: z.string().optional().refine((val) => !val || val === '' || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "Le montant facture doit être un nombre positif ou vide",
  }),
});

type ReconciliationForm = z.infer<typeof reconciliationSchema>;

// Composant pour les filtres réutilisables
const ReconciliationFilters = ({ 
  searchTerm, 
  setSearchTerm, 
  selectedDate, 
  setSelectedDate,
  isDatePickerOpen,
  setIsDatePickerOpen,
  isVerifyingInvoices,
  verifyAllInvoices 
}: {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  isVerifyingInvoices?: boolean;
  verifyAllInvoices?: () => void;
}) => (
  <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
    <div className="flex items-center space-x-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Rechercher par fournisseur, BL ou facture..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 border border-gray-300 shadow-sm"
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal border border-gray-300 shadow-sm",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {selectedDate ? formatDate(selectedDate, "d MMMM yyyy", { locale: fr }) : "Filtrer par date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setIsDatePickerOpen(false);
              }}
              locale={fr}
              className="rounded-md border"
            />
          </PopoverContent>
        </Popover>
        
        {selectedDate && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(null)}
            className="h-9 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        
        {verifyAllInvoices && (
          <Button
            variant="outline"
            size="sm"
            onClick={verifyAllInvoices}
            disabled={isVerifyingInvoices}
            className="h-9 px-3"
            title="Vérifier toutes les factures avec NocoDB"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isVerifyingInvoices ? 'animate-spin' : ''}`} />
            Vérifier factures
          </Button>
        )}
      </div>
    </div>
  </div>
);

// Composant pour la table des rapprochements manuels
const ManualReconciliationTab = ({ 
  deliveries, 
  searchTerm, 
  setSearchTerm,
  selectedDate,
  setSelectedDate,
  isDatePickerOpen,
  setIsDatePickerOpen,
  invoiceVerifications,
  isVerifyingInvoices,
  verifyAllInvoices,
  handleEditReconciliation,
  handleDeleteDelivery,
  updateReconciliationMutation,
  deleteDeliveryMutation,
  calculateDifference 
}: any) => {
  // Filtrage des livraisons
  const filteredDeliveries = deliveries.filter((delivery: any) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      delivery.supplier?.name?.toLowerCase().includes(searchLower) ||
      delivery.blNumber?.toLowerCase().includes(searchLower) ||
      delivery.invoiceReference?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, paginatedItems: paginatedDeliveries, totalPages, totalItems } = usePagination(filteredDeliveries, 20);

  return (
    <div className="space-y-6">
      <ReconciliationFilters 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isDatePickerOpen={isDatePickerOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
        isVerifyingInvoices={isVerifyingInvoices}
        verifyAllInvoices={verifyAllInvoices}
      />

      {totalItems === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun rapprochement manuel trouvé
          </h3>
          <p className="text-gray-600">
            Les livraisons de fournisseurs en mode manuel apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-lg overflow-hidden rounded-lg">
          {totalItems > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              className="px-4 py-3 border-b border-gray-200"
            />
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fournisseur
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    N° BL
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Livr.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant BL
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ref. Facture
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant Fact.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Écart
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Magasin
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedDeliveries.map((delivery: any) => {
                  const difference = calculateDifference(
                    parseFloat(delivery.blAmount || '0'),
                    delivery.invoiceAmount ? parseFloat(delivery.invoiceAmount) : undefined
                  );
                  
                  return (
                    <tr 
                      key={delivery.id} 
                      className="hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 text-sm">
                        <div className="font-medium text-gray-900 truncate max-w-32">
                          {delivery.supplier?.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900">
                          {delivery.blNumber || (
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400 italic text-xs">Non renseigné</span>
                              <button
                                onClick={() => handleEditReconciliation(delivery)}
                                disabled={updateReconciliationMutation.isPending}
                                className="text-gray-400 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center w-5 h-5 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Ajouter un numéro de BL"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900">
                          {safeFormat(delivery.scheduledDate, 'dd/MM/yy')}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="font-medium text-gray-900">
                          {delivery.blAmount ? 
                            `${parseFloat(delivery.blAmount).toFixed(2)}€` :
                            (
                              <div className="flex items-center space-x-1">
                                <span className="text-gray-400 italic text-xs">Non renseigné</span>
                                <button
                                  onClick={() => handleEditReconciliation(delivery)}
                                  disabled={updateReconciliationMutation.isPending}
                                  className="text-gray-400 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center w-5 h-5 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Ajouter un montant BL"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )
                          }
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900">
                          {delivery.invoiceReference ? (
                            <div className="flex items-center space-x-1">
                              <span className="truncate max-w-28">{delivery.invoiceReference}</span>
                              {invoiceVerifications[delivery.id] && (
                                <div className="flex items-center">
                                  {invoiceVerifications[delivery.id].exists ? (
                                    <CheckCircle className="w-3 h-3 text-green-600" title="Facture trouvée" />
                                  ) : (
                                    <X className="w-3 h-3 text-red-600" title="Facture non trouvée" />
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditReconciliation(delivery)}
                              disabled={updateReconciliationMutation.isPending}
                              className="text-gray-400 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center w-6 h-6 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Ajouter une référence facture"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900">
                          {delivery.invoiceAmount ? 
                            `${parseFloat(delivery.invoiceAmount).toFixed(2)}€` : 
                            <button
                              onClick={() => handleEditReconciliation(delivery)}
                              disabled={updateReconciliationMutation.isPending}
                              className="text-gray-400 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center w-5 h-5 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Ajouter un montant facture"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          }
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className={`font-medium ${difference?.color || ''}`}>
                          {difference?.display || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900">
                          {delivery.group?.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditReconciliation(delivery)}
                            disabled={updateReconciliationMutation.isPending}
                            className="text-gray-600 hover:text-blue-600 transition-colors duration-200 p-1 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDelivery(delivery)}
                            disabled={deleteDeliveryMutation.isPending}
                            className="text-gray-600 hover:text-red-600 transition-colors duration-200 p-1 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalItems > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              className="px-4 py-3 border-t border-gray-200"
            />
          )}
        </div>
      )}
    </div>
  );
};

// Composant pour la table des rapprochements automatiques
const AutomaticReconciliationTab = ({ 
  deliveries, 
  searchTerm, 
  setSearchTerm,
  selectedDate,
  setSelectedDate,
  isDatePickerOpen,
  setIsDatePickerOpen,
  invoiceVerifications,
  user,
  calculateDifference,
  handleDevalidateAutoReconciliation 
}: any) => {
  // Filtrage des livraisons
  const filteredDeliveries = deliveries.filter((delivery: any) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      delivery.supplier?.name?.toLowerCase().includes(searchLower) ||
      delivery.blNumber?.toLowerCase().includes(searchLower) ||
      delivery.invoiceReference?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, paginatedItems: paginatedDeliveries, totalPages, totalItems } = usePagination(filteredDeliveries, 20);

  const canModify = user?.role === 'directeur' || user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Message d'information */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Mode rapprochement automatique</h4>
            <p className="text-sm text-blue-700 mt-1">
              Les livraisons de fournisseurs en mode automatique sont validées automatiquement lorsqu'elles ont le statut "delivered" et un numéro de BL.
              {canModify ? (
                " Vous pouvez dévalider ou supprimer ces rapprochements si nécessaire."
              ) : (
                " Seuls les directeurs et administrateurs peuvent modifier ces rapprochements."
              )}
            </p>
          </div>
        </div>
      </div>

      <ReconciliationFilters 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isDatePickerOpen={isDatePickerOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
      />

      {totalItems === 0 ? (
        <div className="text-center py-12">
          <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun rapprochement automatique trouvé
          </h3>
          <p className="text-gray-600">
            Les livraisons de fournisseurs en mode automatique apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-lg overflow-hidden rounded-lg">
          {totalItems > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              className="px-4 py-3 border-b border-gray-200"
            />
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fournisseur
                    <Badge variant="secondary" className="ml-2 text-xs">AUTO</Badge>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    N° BL
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Livr.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Valid.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant BL
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ref. Facture
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant Fact.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Écart
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Magasin
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedDeliveries.map((delivery: any) => {
                  const difference = calculateDifference(
                    parseFloat(delivery.blAmount || '0'),
                    delivery.invoiceAmount ? parseFloat(delivery.invoiceAmount) : undefined
                  );
                  
                  return (
                    <tr 
                      key={delivery.id} 
                      className="hover:bg-gray-50 bg-green-50"
                    >
                      <td className="px-3 py-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <div className="font-medium text-gray-900 truncate max-w-32">
                            {delivery.supplier?.name}
                          </div>
                          <Settings className="w-3 h-3 text-blue-500" title="Mode automatique" />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900 font-medium">
                          {delivery.blNumber || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900">
                          {safeFormat(delivery.scheduledDate, 'dd/MM/yy')}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900">
                          {delivery.reconciled && delivery.updatedAt ? 
                            safeFormat(delivery.updatedAt, 'dd/MM/yy') : 
                            '-'
                          }
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="font-medium text-gray-900">
                          {delivery.blAmount ? 
                            `${parseFloat(delivery.blAmount).toFixed(2)}€` :
                            '-'
                          }
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900">
                          {delivery.invoiceReference ? (
                            <div className="flex items-center space-x-1">
                              <span className="truncate max-w-28">{delivery.invoiceReference}</span>
                              {invoiceVerifications[delivery.id] && (
                                <div className="flex items-center">
                                  {invoiceVerifications[delivery.id].exists ? (
                                    <CheckCircle className="w-3 h-3 text-green-600" title="Facture trouvée" />
                                  ) : (
                                    <X className="w-3 h-3 text-red-600" title="Facture non trouvée" />
                                  )}
                                </div>
                              )}
                            </div>
                          ) : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900">
                          {delivery.invoiceAmount ? 
                            `${parseFloat(delivery.invoiceAmount).toFixed(2)}€` : 
                            '-'
                          }
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className={`font-medium ${difference?.color || ''}`}>
                          {difference?.display || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="text-gray-900">
                          {delivery.group?.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex items-center space-x-2">
                          {canModify ? (
                            <>
                              <button
                                className="text-gray-600 hover:text-blue-600 transition-colors duration-200 p-1 hover:bg-blue-50"
                                title="Voir les détails"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDevalidateAutoReconciliation(delivery.id)}
                                className="text-gray-600 hover:text-orange-600 transition-colors duration-200 p-1 hover:bg-orange-50"
                                title="Dévalider le rapprochement automatique"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              className="text-gray-600 hover:text-blue-600 transition-colors duration-200 p-1 hover:bg-blue-50"
                              title="Voir les détails"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalItems > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              className="px-4 py-3 border-t border-gray-200"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default function BLReconciliation() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Redirection pour les employés
  if (user?.role === 'employee') {
    return (
      <div className="p-6">
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FileText className="h-5 w-5 text-orange-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-orange-700">
                <strong>Accès restreint</strong><br />
                Seuls les managers et administrateurs peuvent accéder au module de rapprochement BL/Factures.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const [activeTab, setActiveTab] = useState("manual");
  const [searchTerm, setSearchTerm] = useState("");
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<any>(null);
  const [invoiceVerifications, setInvoiceVerifications] = useState<Record<number, { exists: boolean; error?: string }>>({});
  const [isVerifyingInvoices, setIsVerifyingInvoices] = useState(false);
  const [isVerifyingCurrentInvoice, setIsVerifyingCurrentInvoice] = useState(false);

  // Récupérer les fournisseurs pour la logique automatique
  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
  });

  // Récupérer les livraisons validées avec BL
  const { data: deliveriesWithBL = [], isLoading } = useQuery({
    queryKey: ['/api/deliveries/bl', selectedStoreId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({});
      if (selectedStoreId && user?.role === 'admin') {
        params.append('storeId', selectedStoreId.toString());
      }
      
      if (selectedDate) {
        const dateStr = formatDate(selectedDate, 'yyyy-MM-dd');
        params.append('startDate', dateStr);
        params.append('endDate', dateStr);
      }
      
      const response = await fetch(`/api/deliveries?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch deliveries');
      }
      
      const deliveries = await response.json();
      const filtered = Array.isArray(deliveries) ? deliveries.filter((d: any) => d.status === 'delivered') : [];
      
      return filtered.sort((a: any, b: any) => new Date(b.deliveredDate).getTime() - new Date(a.deliveredDate).getTime());
    },
  });

  // Séparer les livraisons selon le mode de rapprochement du fournisseur
  const manualReconciliationDeliveries = deliveriesWithBL.filter((delivery: any) => {
    const supplier = suppliers.find((s: any) => s.id === delivery.supplierId);
    return !supplier?.automaticReconciliation;
  });

  const automaticReconciliationDeliveries = deliveriesWithBL.filter((delivery: any) => {
    const supplier = suppliers.find((s: any) => s.id === delivery.supplierId);
    return supplier?.automaticReconciliation;
  });

  // Fonction pour dévalider un rapprochement automatique (directeurs et admins uniquement)
  const handleDevalidateAutoReconciliation = async (deliveryId: number) => {
    if (user?.role !== 'directeur' && user?.role !== 'admin') {
      toast({
        title: "Accès refusé",
        description: "Seuls les directeurs et administrateurs peuvent dévalider les rapprochements automatiques",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest(`/api/deliveries/${deliveryId}`, "PUT", {
        reconciled: false,
        validatedAt: null
      });
      
      toast({
        title: "Succès",
        description: "Rapprochement automatique dévalidé avec succès",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de dévalider le rapprochement",
        variant: "destructive",
      });
    }
  };

  // Fonctions réutilisées de l'ancien composant
  const calculateDifference = (blAmount: number, invoiceAmount?: number) => {
    if (!invoiceAmount || invoiceAmount === 0) return null;
    
    const diff = blAmount - invoiceAmount;
    const tolerance = 0.01;
    
    if (Math.abs(diff) < tolerance) {
      return { display: '0.00€', color: 'text-green-600' };
    } else if (diff > 0) {
      return { display: `+${diff.toFixed(2)}€`, color: 'text-red-600' };
    } else {
      return { display: `${diff.toFixed(2)}€`, color: 'text-red-600' };
    }
  };

  const form = useForm<ReconciliationForm>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: {
      blNumber: "",
      blAmount: "",
      invoiceReference: "",
      invoiceAmount: "",
    },
  });

  const updateReconciliationMutation = useMutation({
    mutationFn: async (data: { id: number; blNumber: string; blAmount: string; invoiceReference: string; invoiceAmount: string }) => {
      const response = await apiRequest(`/api/deliveries/${data.id}`, "PUT", {
        blNumber: data.blNumber,
        blAmount: data.blAmount,
        invoiceReference: data.invoiceReference,
        invoiceAmount: data.invoiceAmount,
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Données de rapprochement mises à jour avec succès",
      });
      setShowReconciliationModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les données de rapprochement",
        variant: "destructive",
      });
    },
  });

  const deleteDeliveryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/deliveries/${id}`, "DELETE");
      return id;
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Livraison supprimée avec succès",
      });
      setShowDeleteModal(false);
      setDeliveryToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries/bl'] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la livraison",
        variant: "destructive",
      });
    },
  });

  const handleEditReconciliation = (delivery: any) => {
    setSelectedDelivery(delivery);
    form.reset({
      blNumber: delivery.blNumber || "",
      blAmount: delivery.blAmount || "",
      invoiceReference: delivery.invoiceReference || "",
      invoiceAmount: delivery.invoiceAmount || "",
    });
    setShowReconciliationModal(true);
  };

  const handleDeleteDelivery = (delivery: any) => {
    setDeliveryToDelete(delivery);
    setShowDeleteModal(true);
  };

  const confirmDeleteDelivery = () => {
    if (deliveryToDelete) {
      deleteDeliveryMutation.mutate(deliveryToDelete.id);
    }
  };

  const onSubmit = (data: ReconciliationForm) => {
    if (!selectedDelivery) return;
    
    updateReconciliationMutation.mutate({
      id: selectedDelivery.id,
      blNumber: data.blNumber || "",
      blAmount: data.blAmount || "",
      invoiceReference: data.invoiceReference || "",
      invoiceAmount: data.invoiceAmount || "",
    });
  };

  const verifyAllInvoices = async () => {
    // Implémentation similaire à l'ancien composant
    console.log("Verification des factures...");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header avec onglets */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm -m-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <FileText className="w-6 h-6 mr-3 text-blue-600" />
              Rapprochement BL/Factures
            </h2>
            <p className="text-gray-600 mt-1">
              Gestion des rapprochements manuels et automatiques
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-sm border border-gray-300">
              {manualReconciliationDeliveries.length} rapprochements manuels
            </Badge>
            <Badge variant="outline" className="text-sm border border-gray-300 bg-blue-50">
              {automaticReconciliationDeliveries.length} rapprochements automatiques
            </Badge>
          </div>
        </div>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="flex items-center space-x-2">
              <Edit className="w-4 h-4" />
              <span>Rapprochement Manuel</span>
              <Badge variant="secondary" className="ml-2">
                {manualReconciliationDeliveries.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="automatic" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Rapprochement Automatique</span>
              <Badge variant="secondary" className="ml-2">
                {automaticReconciliationDeliveries.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Contenu des onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="manual" className="space-y-6">
          <ManualReconciliationTab 
            deliveries={manualReconciliationDeliveries}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            isDatePickerOpen={isDatePickerOpen}
            setIsDatePickerOpen={setIsDatePickerOpen}
            invoiceVerifications={invoiceVerifications}
            isVerifyingInvoices={isVerifyingInvoices}
            verifyAllInvoices={verifyAllInvoices}
            handleEditReconciliation={handleEditReconciliation}
            handleDeleteDelivery={handleDeleteDelivery}
            updateReconciliationMutation={updateReconciliationMutation}
            deleteDeliveryMutation={deleteDeliveryMutation}
            calculateDifference={calculateDifference}
          />
        </TabsContent>
        
        <TabsContent value="automatic" className="space-y-6">
          <AutomaticReconciliationTab 
            deliveries={automaticReconciliationDeliveries}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            isDatePickerOpen={isDatePickerOpen}
            setIsDatePickerOpen={setIsDatePickerOpen}
            invoiceVerifications={invoiceVerifications}
            user={user}
            calculateDifference={calculateDifference}
            handleDevalidateAutoReconciliation={handleDevalidateAutoReconciliation}
          />
        </TabsContent>
      </Tabs>

      {/* Modal de modification des données de rapprochement */}
      <Dialog open={showReconciliationModal} onOpenChange={setShowReconciliationModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Données de rapprochement - {selectedDelivery?.supplier?.name}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Données BL */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 border-b pb-2">Bon de Livraison</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="blNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro BL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: BL-2024-001"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="blAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant BL (€)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="Ex: 1250.50"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Données facture */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 border-b pb-2">Facture</h4>
                
                <FormField
                  control={form.control}
                  name="invoiceReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Référence Facture</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: FAC-2024-001"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="invoiceAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant Facture (€)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          placeholder="Ex: 1250.50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Aperçu de l'écart */}
              {form.watch("blAmount") && form.watch("invoiceAmount") && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-gray-900">Aperçu de l'écart</h4>
                  <div className="text-sm">
                    <p><strong>Montant BL:</strong> {parseFloat(form.watch("blAmount") || "0").toFixed(2)} €</p>
                    <p><strong>Montant Facture:</strong> {parseFloat(form.watch("invoiceAmount") || "0").toFixed(2)} €</p>
                    <p className={`font-medium ${
                      Math.abs(parseFloat(form.watch("blAmount") || "0") - parseFloat(form.watch("invoiceAmount") || "0")) < 0.01 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      <strong>Écart:</strong> {(parseFloat(form.watch("blAmount") || "0") - parseFloat(form.watch("invoiceAmount") || "0")).toFixed(2)} €
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowReconciliationModal(false)}
                  disabled={updateReconciliationMutation.isPending}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit"
                  disabled={updateReconciliationMutation.isPending}
                >
                  {updateReconciliationMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmation de suppression */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeliveryToDelete(null);
        }}
        onConfirm={confirmDeleteDelivery}
        title="Supprimer la livraison"
        description="Êtes-vous sûr de vouloir supprimer cette livraison du module rapprochement ?"
        itemName={deliveryToDelete ? `${deliveryToDelete.supplier?.name} - BL ${deliveryToDelete.blNumber}` : undefined}
        isLoading={deleteDeliveryMutation.isPending}
      />
    </div>
  );
}