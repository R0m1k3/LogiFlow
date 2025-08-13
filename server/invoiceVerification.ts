import { storage } from "./storage";

/**
 * Service de vérification des factures avec NocoDB
 * Gère la vérification automatique des références de factures
 */
class InvoiceVerificationService {
  
  /**
   * Vérifie une référence de facture pour un groupe donné
   */
  async verifyInvoice(invoiceReference: string, groupId: number): Promise<{
    exists: boolean;
    matchType: 'invoice_reference' | 'bl_number' | 'none';
    errorMessage?: string;
    invoiceReference?: string;
    invoiceAmount?: number;
    supplierName?: string;
  }> {
    try {
      console.log('🔍 Début vérification facture:', { invoiceReference, groupId });
      
      if (!invoiceReference || !invoiceReference.trim()) {
        return {
          exists: false,
          matchType: 'none',
          errorMessage: 'Référence de facture vide'
        };
      }

      // Récupérer la configuration du groupe
      const group = await storage.getGroup(groupId);
      if (!group) {
        return {
          exists: false,
          matchType: 'none',
          errorMessage: 'Groupe non trouvé'
        };
      }

      console.log('🔧 Configuration groupe:', {
        groupName: group.name,
        hasNocodbConfig: !!group.nocodbConfigId,
        hasTableName: !!group.nocodbTableName,
        hasWebhook: !!group.webhookUrl
      });

      // Si pas de configuration NocoDB, retourner un résultat par défaut
      if (!group.nocodbConfigId && !group.nocodbTableName && !group.webhookUrl) {
        console.log('⚠️ Pas de configuration NocoDB pour ce groupe');
        return {
          exists: false,
          matchType: 'none',
          errorMessage: 'Configuration NocoDB manquante pour ce magasin'
        };
      }

      // Pour le développement, simuler une vérification
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Mode développement - simulation vérification');
        
        // Simuler différents cas selon la référence
        if (invoiceReference.toLowerCase().includes('test')) {
          return {
            exists: true,
            matchType: 'invoice_reference',
            invoiceReference: invoiceReference,
            invoiceAmount: 123.45,
            supplierName: 'Fournisseur Test'
          };
        }
        
        if (invoiceReference.toLowerCase().includes('bl')) {
          return {
            exists: true,
            matchType: 'bl_number',
            invoiceReference: `FACT_${invoiceReference}`,
            invoiceAmount: 67.89,
            supplierName: 'Fournisseur BL'
          };
        }

        return {
          exists: false,
          matchType: 'none',
          errorMessage: 'Facture non trouvée (mode développement)'
        };
      }

      // En production, on devrait faire l'appel réel à NocoDB
      // Pour l'instant, retourner un résultat par défaut
      console.log('⚠️ Vérification NocoDB non implémentée en production');
      return {
        exists: false,
        matchType: 'none',
        errorMessage: 'Service de vérification NocoDB en cours de configuration'
      };

    } catch (error) {
      console.error('❌ Erreur vérification facture:', error);
      return {
        exists: false,
        matchType: 'none',
        errorMessage: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Recherche par numéro de BL
   */
  async searchByBLNumber(blNumber: string, groupId: number): Promise<any> {
    console.log('🔍 Recherche par BL:', { blNumber, groupId });
    
    // Pour le développement, simuler une recherche
    if (process.env.NODE_ENV === 'development') {
      if (blNumber && blNumber.trim()) {
        return {
          found: true,
          data: {
            invoiceReference: `FACT_${blNumber}`,
            amount: 156.78,
            supplier: 'Fournisseur BL'
          }
        };
      }
    }
    
    return {
      found: false,
      error: 'BL non trouvé'
    };
  }

  /**
   * Validation d'une référence de facture
   */
  validateInvoiceReference(reference: string): boolean {
    if (!reference || typeof reference !== 'string') {
      return false;
    }
    
    const trimmed = reference.trim();
    return trimmed.length > 0 && trimmed.length <= 100;
  }

  /**
   * Nettoyage d'une référence de facture
   */
  cleanInvoiceReference(reference: string): string {
    if (!reference || typeof reference !== 'string') {
      return '';
    }
    
    return reference.trim().toUpperCase();
  }
}

// Instance unique du service
export const invoiceVerificationService = new InvoiceVerificationService();