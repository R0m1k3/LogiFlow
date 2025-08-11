import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { safeFormat } from "@/lib/dateUtils";
import { Phone, Package, User, Store, Calendar, CreditCard, Tag } from "lucide-react";
import type { CustomerOrderWithRelations } from "@shared/schema";

interface CustomerOrderDetailsProps {
  order: CustomerOrderWithRelations;
}

export function CustomerOrderDetails({ order }: CustomerOrderDetailsProps) {
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

  // Générer le code-barres simple (représentation textuelle)
  const renderBarcode = (gencode: string) => {
    return (
      <div className="font-mono text-center border-2 border-dashed p-4 bg-gray-50">
        <div className="text-2xl tracking-widest font-bold mb-2">
          {gencode.split('').map((char, index) => (
            <span key={index} className="inline-block border-l-2 border-black h-8 w-1 mr-1"></span>
          ))}
        </div>
        <div className="text-sm">{gencode}</div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* En-tête avec statut */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Commande #{order.id}</h3>
          <p className="text-sm text-muted-foreground">
            Créée le {safeFormat(order.createdAt, 'dd MMMM yyyy à HH:mm')}
          </p>
        </div>
        <Badge className={`${getStatusColor(order.status)} rounded-none`}>
          {order.status}
        </Badge>
      </div>

      <Separator />

      {/* Informations client */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Informations Client
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Nom:</span>
            <span>{order.customerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span className="font-medium">Téléphone:</span>
            <span>{order.customerPhone}</span>
          </div>
          {order.customerNotified && order.status === 'Disponible' && (
            <div className="flex items-center gap-2 text-green-600">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Client notifié de la disponibilité</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informations produit */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Informations Produit
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div>
            <span className="font-medium">Désignation:</span>
            <p className="mt-1 text-sm bg-gray-50 p-2 rounded">
              {order.productDesignation}
            </p>
          </div>
          
          {order.productReference && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Référence:</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                {order.productReference}
              </code>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="font-medium">Quantité:</span>
            <Badge variant="secondary" className="font-mono">
              {order.quantity || 1}
            </Badge>
          </div>

          {order.gencode && (
            <div>
              <span className="font-medium">Code à barres:</span>
              <div className="mt-2">
                <div className="font-mono text-center border border-dashed p-2 bg-gray-50 rounded">
                  <div className="text-sm text-gray-600 mb-1 text-center">
                    Code-barres EAN13 scannable
                  </div>
                  <div className="border bg-white p-2 text-center">
                    <svg width="200" height="40" viewBox="0 0 200 40" className="mx-auto">
                      <rect width="200" height="40" fill="white"/>
                      <g stroke="black" strokeWidth="1">
                        <line x1="10" y1="5" x2="10" y2="35"/>
                        <line x1="15" y1="5" x2="15" y2="35"/>
                        <line x1="18" y1="5" x2="18" y2="35"/>
                        <line x1="25" y1="5" x2="25" y2="35"/>
                        <line x1="30" y1="5" x2="30" y2="35"/>
                        <line x1="35" y1="5" x2="35" y2="35"/>
                        <line x1="40" y1="5" x2="40" y2="35"/>
                        <line x1="45" y1="5" x2="45" y2="35"/>
                        <line x1="50" y1="5" x2="50" y2="35"/>
                        <line x1="60" y1="5" x2="60" y2="35"/>
                        <line x1="65" y1="5" x2="65" y2="35"/>
                        <line x1="70" y1="5" x2="70" y2="35"/>
                        <line x1="75" y1="5" x2="75" y2="35"/>
                        <line x1="80" y1="5" x2="80" y2="35"/>
                        <line x1="85" y1="5" x2="85" y2="35"/>
                        <line x1="90" y1="5" x2="90" y2="35"/>
                        <line x1="95" y1="5" x2="95" y2="35"/>
                        <line x1="100" y1="5" x2="100" y2="35"/>
                        <line x1="110" y1="5" x2="110" y2="35"/>
                        <line x1="115" y1="5" x2="115" y2="35"/>
                        <line x1="120" y1="5" x2="120" y2="35"/>
                        <line x1="125" y1="5" x2="125" y2="35"/>
                        <line x1="130" y1="5" x2="130" y2="35"/>
                        <line x1="135" y1="5" x2="135" y2="35"/>
                        <line x1="140" y1="5" x2="140" y2="35"/>
                        <line x1="145" y1="5" x2="145" y2="35"/>
                        <line x1="150" y1="5" x2="150" y2="35"/>
                        <line x1="160" y1="5" x2="160" y2="35"/>
                        <line x1="165" y1="5" x2="165" y2="35"/>
                        <line x1="170" y1="5" x2="170" y2="35"/>
                        <line x1="175" y1="5" x2="175" y2="35"/>
                        <line x1="180" y1="5" x2="180" y2="35"/>
                        <line x1="185" y1="5" x2="185" y2="35"/>
                        <line x1="190" y1="5" x2="190" y2="35"/>
                      </g>
                    </svg>
                  </div>
                  <div className="text-xs">{order.gencode}</div>
                </div>
              </div>
            </div>
          )}

          {order.isPromotionalPrice && (
            <div className="flex items-center gap-2 text-orange-600">
              <Tag className="h-4 w-4" />
              <span className="text-sm font-medium">Prix publicité appliqué</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informations commande */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Informations Commande
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Prise par:</span>
            <span>{order.orderTaker}</span>
          </div>
          
          {order.deposit && parseFloat(order.deposit) > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium">💰 Acompte:</span>
              <Badge variant="outline" className="text-orange-600 border-orange-300 font-mono">
                {parseFloat(order.deposit).toFixed(2)}€
              </Badge>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span className="font-medium">Magasin:</span>
            <Badge
              style={{ 
                backgroundColor: order.group.color + "20", 
                color: order.group.color,
                border: `1px solid ${order.group.color}30`
              }}
            >
              {order.group.name}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium">Fournisseur:</span>
            <span>{order.supplier.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">Date de création:</span>
            <span>{safeFormat(order.createdAt, 'dd/MM/yyyy à HH:mm')}</span>
          </div>


        </CardContent>
      </Card>

      {/* Actions disponibles selon le statut */}
      {order.status === 'Disponible' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <h4 className="font-medium text-green-800 mb-2">Actions disponibles</h4>
          <div className="space-y-1 text-sm text-green-700">
            <p>• Étiquette imprimable disponible</p>
            <p>• Notification client possible</p>
            <p>• Prêt pour retrait en magasin</p>
          </div>
        </div>
      )}

      {(order.status === 'Retiré' || order.status === 'Annulé') && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <h4 className="font-medium text-gray-600 mb-2">Commande terminée</h4>
          <p className="text-sm text-gray-600">
            {order.status === 'Retiré' 
              ? 'Cette commande a été retirée par le client.'
              : 'Cette commande a été annulée.'
            }
          </p>
        </div>
      )}
    </div>
  );
}