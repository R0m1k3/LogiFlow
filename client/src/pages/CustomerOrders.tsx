import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthUnified } from "@/hooks/useAuthUnified";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Plus, Edit, Trash2, Phone, PhoneCall, Printer, Eye, Package } from "lucide-react";
import JsBarcode from 'jsbarcode';
import { safeFormat, safeDate } from "@/lib/dateUtils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type { CustomerOrderWithRelations, Group } from "@shared/schema";
import { CustomerOrderForm } from "@/components/CustomerOrderForm";
import { CustomerOrderDetails } from "@/components/CustomerOrderDetails";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useStore } from "@/components/Layout";

export default function CustomerOrders() {
  const { user } = useAuthUnified();
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderWithRelations | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "status" | "supplier">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Fetch groups for store filter
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
  });

  // Fetch suppliers for filter
  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
  });

  // Fetch customer orders with store filtering for admins
  const customerOrdersUrl = `/api/customer-orders${selectedStoreId && user?.role === 'admin' ? `?storeId=${selectedStoreId}` : ''}`;
  const { data: customerOrders = [], isLoading } = useQuery<CustomerOrderWithRelations[]>({
    queryKey: [customerOrdersUrl, selectedStoreId],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/customer-orders', 'POST', data),
    onSuccess: () => {
      // Force refresh of the query with store context
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().includes('/api/customer-orders') });
      queryClient.refetchQueries({ predicate: (query) => query.queryKey[0]?.toString().includes('/api/customer-orders') });
      setShowCreateModal(false);
      toast({
        title: "Succès",
        description: "Commande client créée avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création de la commande",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(`/api/customer-orders/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().includes('/api/customer-orders') });
      setShowEditModal(false);
      setSelectedOrder(null);
      toast({
        title: "Succès",
        description: "Commande client mise à jour avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la mise à jour de la commande",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/customer-orders/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().includes('/api/customer-orders') });
      setShowDeleteModal(false);
      setSelectedOrder(null);
      toast({
        title: "Succès",
        description: "Commande client supprimée avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression de la commande",
        variant: "destructive",
      });
    },
  });

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/customer-orders/${id}`, 'PUT', { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().includes('/api/customer-orders') });
      toast({
        title: "Succès",
        description: "Statut de la commande mis à jour",
      });
    },
  });

  // Notification mutation
  const notificationMutation = useMutation({
    mutationFn: ({ id, customerNotified }: { id: number; customerNotified: boolean }) =>
      apiRequest(`/api/customer-orders/${id}`, 'PUT', { customerNotified }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().includes('/api/customer-orders') });
      toast({
        title: "Succès",
        description: "Statut de notification mis à jour",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "En attente de Commande":
        return "bg-yellow-50 text-yellow-700 border border-yellow-200";
      case "Commande en Cours":
        return "bg-blue-50 text-blue-700 border border-blue-200";
      case "Disponible":
        return "bg-green-50 text-green-700 border border-green-200";
      case "Retiré":
        return "bg-gray-50 text-gray-700 border border-gray-200";
      case "Annulé":
        return "bg-red-50 text-red-700 border border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border border-gray-200";
    }
  };

  const isGrayedOut = (status: string) => {
    return status === "Retiré" || status === "Annulé";
  };

  const canShowButtons = (status: string) => {
    return status === "Disponible";
  };

  const statusOptions = [
    "En attente de Commande",
    "Commande en Cours", 
    "Disponible",
    "Retiré",
    "Annulé"
  ];

  const handleStatusChange = (id: number, newStatus: string) => {
    statusMutation.mutate({ id, status: newStatus });
  };

  const handleCreateOrder = (data: any) => {
    createMutation.mutate(data);
  };

  const handleEditOrder = (data: any) => {
    if (selectedOrder) {
      updateMutation.mutate({ id: selectedOrder.id, data });
    }
  };

  const openEditModal = (order: CustomerOrderWithRelations) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  const openDetailsModal = (order: CustomerOrderWithRelations) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const openDeleteModal = (order: CustomerOrderWithRelations) => {
    setSelectedOrder(order);
    setShowDeleteModal(true);
  };

  const openStatusModal = (order: CustomerOrderWithRelations) => {
    setSelectedOrder(order);
    setShowStatusModal(true);
  };

  const handleNotificationToggle = (order: CustomerOrderWithRelations) => {
    notificationMutation.mutate({
      id: order.id,
      customerNotified: !order.customerNotified
    });
  };

  // Fonction pour calculer le checksum EAN13
  const calculateEAN13Checksum = (code: string): string => {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return checksum.toString();
  };

  // Fonction pour générer un code-barres scannable
  const generateEAN13Barcode = (code: string): string => {
    try {
      // Créer un canvas temporaire
      const canvas = document.createElement('canvas');
      
      let processedCode = code.replace(/[^0-9]/g, ''); // Garder que les chiffres
      
      // Gérer différentes longueurs de codes
      if (processedCode.length < 12) {
        processedCode = processedCode.padStart(12, '0');
      } else if (processedCode.length > 13) {
        processedCode = processedCode.substring(0, 12);
      } else if (processedCode.length === 13) {
        processedCode = processedCode.substring(0, 12);
      }
      
      // Ajouter le checksum pour avoir un EAN13 valide
      const checksum = calculateEAN13Checksum(processedCode);
      const ean13 = processedCode + checksum;
      
      console.log('Code original:', code, 'EAN13 généré:', ean13);
      
      // Générer le code-barres avec jsbarcode
      JsBarcode(canvas, ean13, {
        format: "EAN13",
        width: 2,
        height: 60,
        displayValue: false,
        background: "#ffffff",
        lineColor: "#000000",
        margin: 5
      });
      
      // Retourner l'image en base64
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Erreur génération code-barres:', error);
      // Fallback SVG professionnel
      return 'data:image/svg+xml;base64,' + btoa(`
        <svg width="250" height="60" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="250" height="60" fill="white" stroke="#ddd"/>
          <g stroke="black" stroke-width="2">
            <line x1="15" y1="10" x2="15" y2="45"/>
            <line x1="20" y1="10" x2="20" y2="45"/>
            <line x1="25" y1="10" x2="25" y2="45"/>
            <line x1="35" y1="10" x2="35" y2="45"/>
            <line x1="40" y1="10" x2="40" y2="45"/>
            <line x1="50" y1="10" x2="50" y2="45"/>
            <line x1="55" y1="10" x2="55" y2="45"/>
            <line x1="65" y1="10" x2="65" y2="45"/>
            <line x1="70" y1="10" x2="70" y2="45"/>
            <line x1="80" y1="10" x2="80" y2="45"/>
            <line x1="85" y1="10" x2="85" y2="45"/>
            <line x1="95" y1="10" x2="95" y2="45"/>
            <line x1="100" y1="10" x2="100" y2="45"/>
            <line x1="110" y1="10" x2="110" y2="45"/>
            <line x1="115" y1="10" x2="115" y2="45"/>
            <line x1="125" y1="10" x2="125" y2="45"/>
            <line x1="130" y1="10" x2="130" y2="45"/>
            <line x1="140" y1="10" x2="140" y2="45"/>
            <line x1="145" y1="10" x2="145" y2="45"/>
            <line x1="155" y1="10" x2="155" y2="45"/>
            <line x1="160" y1="10" x2="160" y2="45"/>
            <line x1="170" y1="10" x2="170" y2="45"/>
            <line x1="175" y1="10" x2="175" y2="45"/>
            <line x1="185" y1="10" x2="185" y2="45"/>
            <line x1="190" y1="10" x2="190" y2="45"/>
            <line x1="200" y1="10" x2="200" y2="45"/>
            <line x1="205" y1="10" x2="205" y2="45"/>
            <line x1="215" y1="10" x2="215" y2="45"/>
            <line x1="220" y1="10" x2="220" y2="45"/>
            <line x1="230" y1="10" x2="230" y2="45"/>
            <line x1="235" y1="10" x2="235" y2="45"/>
          </g>
          <text x="125" y="55" text-anchor="middle" font-family="monospace" font-size="10" fill="black">${code}</text>
        </svg>
      `);
    }
  };

  const handlePrintLabel = (order: CustomerOrderWithRelations) => {
    // Ouvrir une nouvelle fenêtre pour imprimer l'étiquette
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const barcodeDisplay = order.gencode ? generateEAN13Barcode(order.gencode) : '';
      const isImageBarcode = barcodeDisplay.startsWith('data:');
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Commande #${order.id}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
                background-color: #f5f5f5;
                margin: 0;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              }
              .header { 
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #e5e7eb;
              }
              .title {
                font-size: 20px;
                font-weight: bold;
                color: #111827;
              }
              .status-badge {
                background-color: #fef3c7;
                color: #92400e;
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
              }
              .section {
                margin-bottom: 20px;
                padding: 15px;
                background-color: #f9fafb;
                border-radius: 6px;
                border: 1px solid #e5e7eb;
              }
              .section-title {
                font-size: 16px;
                font-weight: 600;
                color: #374151;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              .section-content {
                color: #1f2937;
                line-height: 1.6;
              }
              .field-row {
                display: flex;
                margin-bottom: 8px;
              }
              .field-label {
                font-weight: 500;
                color: #374151;
                min-width: 120px;
                margin-right: 8px;
              }
              .field-value {
                color: #111827;
              }
              .reference-code {
                background-color: #f3f4f6;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
                font-size: 13px;
                color: #374151;
              }
              .quantity-badge {
                background-color: #10b981;
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                display: inline-block;
              }
              .barcode-section {
                text-align: center;
                margin: 15px 0;
              }
              .barcode {
                font-family: 'Courier New', monospace;
                font-size: 14px;
                font-weight: bold;
                color: #000000;
                letter-spacing: -1px;
                margin: 15px 0;
                line-height: 0.8;
                background: white;
                padding: 8px 12px;
                border: 1px solid #ddd;
                text-align: center;
                word-spacing: -2px;
              }
              .barcode-image {
                max-width: 300px;
                height: auto;
                margin: 10px 0;
                border: 1px solid #ddd;
              }
              .barcode-number {
                font-size: 14px;
                color: #6b7280;
                margin-top: 5px;
              }
              .store-badge {
                background-color: #dbeafe;
                color: #1e40af;
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                display: inline-block;
              }
              .creation-date {
                color: #6b7280;
                font-size: 13px;
              }
              .deposit-info {
                background-color: #fef3c7;
                color: #92400e;
                padding: 8px 12px;
                border-radius: 6px;
                font-weight: 600;
                margin: 10px 0;
                border: 1px solid #fbbf24;
              }
              .promo-badge {
                background-color: #fef2f2;
                color: #dc2626;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
                display: inline-block;
                border: 1px solid #fecaca;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="title">Commande #${order.id}</div>
                <div class="status-badge">${order.status}</div>
              </div>
              <div class="creation-date">Créée le ${safeFormat(order.createdAt, 'dd MMMM yyyy')} à ${safeFormat(order.createdAt, 'HH:mm')}</div>
              
              <div class="section">
                <div class="section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Informations Client
                </div>
                <div class="section-content">
                  <div class="field-row">
                    <span class="field-label">Nom:</span>
                    <span class="field-value">${order.customerName}</span>
                  </div>
                  <div class="field-row">
                    <span class="field-label">📞 Téléphone:</span>
                    <span class="field-value">${order.customerPhone}</span>
                  </div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                  Informations Produit
                </div>
                <div class="section-content">
                  <div class="field-row">
                    <span class="field-label">Désignation:</span>
                  </div>
                  <div style="background-color: #f3f4f6; padding: 8px; border-radius: 4px; margin-bottom: 12px;">
                    ${order.productDesignation}
                  </div>
                  ${order.productReference ? `
                  <div class="field-row">
                    <span class="field-label">Référence:</span>
                    <span class="field-value">
                      <span class="reference-code">${order.productReference}</span>
                    </span>
                  </div>` : ''}
                  <div class="field-row">
                    <span class="field-label">Quantité:</span>
                    <span class="field-value">
                      <span class="quantity-badge">${order.quantity || 1}</span>
                    </span>
                  </div>
                  ${order.deposit && parseFloat(order.deposit) > 0 ? `
                  <div class="deposit-info">
                    💰 Acompte versé: ${parseFloat(order.deposit).toFixed(2)}€
                  </div>` : ''}
                  ${order.isPromotionalPrice ? `
                  <div class="field-row">
                    <span class="field-label">Prix:</span>
                    <span class="field-value">
                      <span class="promo-badge">🏷️ PRIX PUBLICITÉ</span>
                    </span>
                  </div>` : ''}
                  ${order.gencode ? `
                  <div class="field-row">
                    <span class="field-label">Code à barres EAN13:</span>
                  </div>
                  <div class="barcode-section">
                    ${isImageBarcode ? 
                      `<img src="${barcodeDisplay}" alt="Code-barres EAN13" class="barcode-image" style="max-width: 250px; height: auto; margin: 10px auto; display: block;" />` :
                      `<div class="barcode">${barcodeDisplay}</div>`
                    }
                    <div class="barcode-number">${order.gencode}</div>
                  </div>` : ''}
                </div>
              </div>

              <div class="section">
                <div class="section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Informations Commande
                </div>
                <div class="section-content">
                  <div class="field-row">
                    <span class="field-label">Prise par:</span>
                    <span class="field-value">${order.orderTaker}</span>
                  </div>
                  <div class="field-row">
                    <span class="field-label">🏪 Magasin:</span>
                    <span class="field-value">
                      <span class="store-badge">${order.group.name}</span>
                    </span>
                  </div>
                  <div class="field-row">
                    <span class="field-label">📅 Date de création:</span>
                    <span class="field-value">${safeFormat(order.createdAt, 'dd/MM/yyyy')} à ${safeFormat(order.createdAt, 'HH:mm')}</span>
                  </div>
                </div>
              </div>
            </div>
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
    }
  };

  // Filter orders based on search term, supplier, and status
  const filteredOrders = Array.isArray(customerOrders) ? customerOrders.filter(order => {
    // Search term filter
    const matchesSearch = !searchTerm || 
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productDesignation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerPhone.includes(searchTerm) ||
      (order.productReference && order.productReference.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.gencode && order.gencode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.supplier && order.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Supplier filter
    const matchesSupplier = filterSupplier === "all" || 
      (order.supplier && order.supplier.id.toString() === filterSupplier);
    
    // Status filter
    const matchesStatus = filterStatus === "all" || order.status === filterStatus;
    
    return matchesSearch && matchesSupplier && matchesStatus;
  }) : [];

  // Sort orders
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortBy) {
      case "date":
        const dateA = safeDate(a.createdAt);
        const dateB = safeDate(b.createdAt);
        aValue = dateA ? dateA.getTime() : 0;
        bValue = dateB ? dateB.getTime() : 0;
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
      case "supplier":
        aValue = a.supplier?.name || "";
        bValue = b.supplier?.name || "";
        break;
      default:
        const defaultDateA = safeDate(a.createdAt);
        const defaultDateB = safeDate(b.createdAt);
        aValue = defaultDateA ? defaultDateA.getTime() : 0;
        bValue = defaultDateB ? defaultDateB.getTime() : 0;
    }

    if (sortOrder === "desc") {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    } else {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    }
  });

  // Pagination
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedData: paginatedOrders,
    totalItems
  } = usePagination(sortedOrders, 10);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm -m-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <Package className="w-6 h-6 mr-3 text-blue-600" />
              Commandes Client
            </h2>
            <p className="text-gray-600 mt-1">
              Gestion des commandes clients et étiquettes
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Commande
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recherche et Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Nom client, produit, téléphone, référence, gencode, fournisseur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <div className="flex gap-2">
              <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Fournisseurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Fournisseurs</SelectItem>
                  {suppliers.map((supplier: any) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Status</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Commandes ({totalItems})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Chargement...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Gencode</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className={isGrayedOut(order.status) ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">
                      {order.customerName}
                    </TableCell>
                    <TableCell>{order.customerPhone}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{order.productDesignation}</div>
                        {order.productReference && (
                          <div className="text-sm text-muted-foreground">
                            Ref: {order.productReference}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono">
                        {order.quantity || 1}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {order.supplier?.name || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                        {order.gencode || "-"}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={`${getStatusColor(order.status)} cursor-pointer hover:opacity-80 transition-opacity rounded-none`}
                        onClick={() => openStatusModal(order)}
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {safeFormat(order.createdAt, 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetailsModal(order)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(order)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {canShowButtons(order.status) && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintLabel(order)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNotificationToggle(order)}
                              className={order.customerNotified ? "bg-green-100" : ""}
                            >
                              {order.customerNotified ? (
                                <PhoneCall className="h-4 w-4" />
                              ) : (
                                <Phone className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                        {user?.role === 'admin' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteModal(order)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Pagination */}
          {totalItems > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              className="mt-4 border-t border-gray-200 pt-4"
            />
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl" style={{ height: 'auto', maxHeight: 'none' }}>
          <DialogHeader>
            <DialogTitle>Nouvelle Commande Client</DialogTitle>
          </DialogHeader>
          <div style={{ transform: 'scale(0.9)', transformOrigin: 'top left', width: '111%' }}>
            <CustomerOrderForm
              onSubmit={handleCreateOrder}
              onCancel={() => setShowCreateModal(false)}
              isLoading={createMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-3xl" style={{ height: 'auto', maxHeight: 'none' }}>
          <DialogHeader>
            <DialogTitle>Modifier la Commande</DialogTitle>
          </DialogHeader>
          <div style={{ transform: 'scale(0.9)', transformOrigin: 'top left', width: '111%' }}>
            {selectedOrder && (
              <CustomerOrderForm
                order={selectedOrder}
                onSubmit={handleEditOrder}
                onCancel={() => setShowEditModal(false)}
                isLoading={updateMutation.isPending}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la Commande</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <CustomerOrderDetails order={selectedOrder} />
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
            <DialogDescription>
              Sélectionnez un nouveau statut pour cette commande client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Commande: <span className="font-medium">{selectedOrder?.productDesignation}</span>
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Client: <span className="font-medium">{selectedOrder?.customerName}</span>
              </p>
            </div>
            
            <div className="grid gap-2">
              {statusOptions.map((status) => (
                <Button
                  key={status}
                  variant={selectedOrder?.status === status ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => {
                    if (selectedOrder) {
                      handleStatusChange(selectedOrder.id, status);
                      setShowStatusModal(false);
                    }
                  }}
                  disabled={statusMutation.isPending}
                >
                  <Badge className={`${getStatusColor(status)} mr-2 rounded-none`}>
                    {status}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={() => selectedOrder && deleteMutation.mutate(selectedOrder.id)}
        title="Supprimer la commande"
        description={`Êtes-vous sûr de vouloir supprimer la commande de ${selectedOrder?.customerName} ? Cette action est irréversible.`}
        confirmText="Supprimer"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}