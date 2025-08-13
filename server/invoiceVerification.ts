import { storage } from "./storage.js";

/**
 * Service de vérification des factures avec NocoDB
 * Gère la vérification automatique des références de factures
 */
export class InvoiceVerificationService {
  
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

      // En production, faire l'appel réel à NocoDB
      console.log('🔍 Vérification NocoDB en production...');
      
      try {
        // Récupérer la configuration NocoDB active
        const nocodbConfig = await storage.getActiveNocodbConfig();
        if (!nocodbConfig) {
          console.log('⚠️ Pas de configuration NocoDB active');
          return {
            exists: false,
            matchType: 'none',
            errorMessage: 'Configuration NocoDB non trouvée'
          };
        }

        console.log('🔧 Configuration NocoDB trouvée:', {
          configName: nocodbConfig.name,
          baseUrl: nocodbConfig.baseUrl,
          projectId: nocodbConfig.projectId,
          hasToken: !!nocodbConfig.apiToken
        });

        // Vérifier d'abord par référence de facture
        let matchResult = await this.searchInNocoDB(
          invoiceReference, 
          group.invoiceColumnName || 'invoice_reference',
          nocodbConfig,
          group.nocodbTableName || 'invoices'
        );

        if (matchResult.found) {
          return {
            exists: true,
            matchType: 'invoice_reference',
            invoiceReference: matchResult.data.invoice_reference || invoiceReference,
            invoiceAmount: parseFloat(matchResult.data[group.nocodbAmountColumnName || 'amount'] || '0'),
            supplierName: matchResult.data[group.nocodbSupplierColumnName || 'supplier'] || 'Inconnu'
          };
        }

        // Si pas trouvé par référence de facture, chercher par numéro de BL
        if (group.nocodbBlColumnName) {
          matchResult = await this.searchInNocoDB(
            invoiceReference, 
            group.nocodbBlColumnName,
            nocodbConfig,
            group.nocodbTableName || 'invoices'
          );

          if (matchResult.found) {
            return {
              exists: true,
              matchType: 'bl_number',
              invoiceReference: matchResult.data.invoice_reference || `BL_${invoiceReference}`,
              invoiceAmount: parseFloat(matchResult.data[group.nocodbAmountColumnName || 'amount'] || '0'),
              supplierName: matchResult.data[group.nocodbSupplierColumnName || 'supplier'] || 'Inconnu'
            };
          }
        }

        // Aucune correspondance trouvée
        return {
          exists: false,
          matchType: 'none',
          errorMessage: 'Aucune correspondance trouvée dans NocoDB'
        };

      } catch (error) {
        console.error('❌ Erreur lors de la vérification NocoDB:', error);
        return {
          exists: false,
          matchType: 'none',
          errorMessage: `Erreur NocoDB: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
        };
      }

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
   * Recherche dans NocoDB
   */
  private async searchInNocoDB(
    searchValue: string, 
    columnName: string, 
    config: any, 
    tableName: string
  ): Promise<{ found: boolean; data?: any }> {
    try {
      const searchUrl = `${config.baseUrl}/api/v1/db/data/v1/${config.projectId}/${tableName}`;
      
      console.log('🔍 Recherche NocoDB:', {
        url: searchUrl,
        column: columnName,
        value: searchValue
      });

      const response = await fetch(`${searchUrl}?where=(${columnName},eq,${encodeURIComponent(searchValue)})`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'xc-token': config.apiToken
        }
      });

      if (!response.ok) {
        console.error('❌ Erreur réponse NocoDB:', response.status, response.statusText);
        return { found: false };
      }

      const result = await response.json();
      console.log('✅ Réponse NocoDB:', result);

      if (result.list && result.list.length > 0) {
        return {
          found: true,
          data: result.list[0]
        };
      }

      return { found: false };

    } catch (error) {
      console.error('❌ Erreur appel NocoDB:', error);
      return { found: false };
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