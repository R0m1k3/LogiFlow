import { storage } from "./storage.js";

/**
 * Service de vérification des factures avec NocoDB
 * Gère la vérification automatique des références de factures
 */
export class InvoiceVerificationService {
  
  /**
   * Générer une clé de cache unique
   */
  private generateCacheKey(invoiceReference: string, groupId: number): string {
    return `${groupId}_${invoiceReference.trim().toLowerCase()}`;
  }

  /**
   * Vérifier dans le cache d'abord
   */
  async checkCache(invoiceReference: string, groupId: number): Promise<any | null> {
    try {
      const cacheKey = this.generateCacheKey(invoiceReference, groupId);
      const cached = await storage.getInvoiceVerificationCache(cacheKey);
      
      if (cached && new Date() < new Date(cached.expiresAt)) {
        console.log('💾 Cache hit pour:', { invoiceReference, groupId });
        return {
          exists: cached.exists,
          matchType: cached.matchType,
          errorMessage: cached.errorMessage,
          invoiceReference: cached.invoiceReference,
          supplierName: cached.supplierName,
          fromCache: true
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur lecture cache:', error);
      return null;
    }
  }

  /**
   * Sauvegarder dans le cache
   */
  async saveToCache(invoiceReference: string, groupId: number, result: any, supplierName?: string): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(invoiceReference, groupId);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Cache pendant 24h
      
      await storage.saveInvoiceVerificationCache({
        cacheKey,
        groupId,
        invoiceReference,
        supplierName: supplierName || null,
        exists: result.exists,
        matchType: result.matchType,
        errorMessage: result.errorMessage || null,
        cacheHit: false,
        apiCallTime: null,
        expiresAt
      });
      
      console.log('💾 Résultat sauvé en cache:', { invoiceReference, groupId, exists: result.exists });
    } catch (error) {
      console.error('❌ Erreur sauvegarde cache:', error);
    }
  }

  /**
   * Vérifie une référence de facture pour un groupe donné
   */
  async verifyInvoice(invoiceReference: string, groupId: number, forceRefresh: boolean = false): Promise<{
    exists: boolean;
    matchType: 'invoice_reference' | 'bl_number' | 'none';
    errorMessage?: string;
    invoiceReference?: string;
    invoiceAmount?: number;
    supplierName?: string;
    fromCache?: boolean;
  }> {
    try {
      console.log('🔍 Début vérification facture:', { invoiceReference, groupId, forceRefresh });
      
      if (!invoiceReference || !invoiceReference.trim()) {
        return {
          exists: false,
          matchType: 'none',
          errorMessage: 'Référence de facture vide'
        };
      }

      // Vérifier le cache d'abord (sauf si refresh forcé)
      if (!forceRefresh) {
        const cachedResult = await this.checkCache(invoiceReference, groupId);
        if (cachedResult) {
          return cachedResult;
        }
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

        // Utiliser l'ID de table configuré dans le groupe
        const tableId = group.nocodbTableId || 'mrr733dfb8wtt9b'; // Fallback par défaut
        console.log('🔧 Utilisation table ID:', { 
          groupTable: group.nocodbTableName, 
          configuredId: group.nocodbTableId,
          resolvedId: tableId 
        });

        // Vérifier d'abord par référence de facture
        let matchResult = await this.searchInNocoDB(
          invoiceReference, 
          group.invoiceColumnName || 'RefFacture',
          nocodbConfig,
          tableId
        );

        if (matchResult.found) {
          const result = {
            exists: true,
            matchType: 'invoice_reference' as const,
            invoiceReference: matchResult.data.invoice_reference || invoiceReference,
            invoiceAmount: parseFloat(matchResult.data[group.nocodbAmountColumnName || 'amount'] || '0'),
            supplierName: matchResult.data[group.nocodbSupplierColumnName || 'supplier'] || 'Inconnu'
          };
          
          // Sauvegarder en cache si succès
          await this.saveToCache(invoiceReference, groupId, result, result.supplierName);
          return result;
        }

        // Si pas trouvé par référence de facture, chercher par numéro de BL
        if (group.nocodbBlColumnName) {
          matchResult = await this.searchInNocoDB(
            invoiceReference, 
            group.nocodbBlColumnName || 'Numero_BL',
            nocodbConfig,
            tableId
          );

          if (matchResult.found) {
            const result = {
              exists: true,
              matchType: 'bl_number' as const,
              invoiceReference: matchResult.data.invoice_reference || `BL_${invoiceReference}`,
              invoiceAmount: parseFloat(matchResult.data[group.nocodbAmountColumnName || 'amount'] || '0'),
              supplierName: matchResult.data[group.nocodbSupplierColumnName || 'supplier'] || 'Inconnu'
            };
            
            // Sauvegarder en cache si succès
            await this.saveToCache(invoiceReference, groupId, result, result.supplierName);
            return result;
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
    tableId: string
  ): Promise<{ found: boolean; data?: any }> {
    try {
      // Utiliser directement l'ID de table fourni  
      const searchUrl = `${config.baseUrl}/api/v1/db/data/v1/${config.projectId}/${tableId}`;
      
      console.log('🔍 Recherche NocoDB:', {
        url: searchUrl,
        tableId: tableId,
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