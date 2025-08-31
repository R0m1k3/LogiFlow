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
      console.log('🔍 [CACHE] Recherche cache pour:', { invoiceReference, groupId, cacheKey });
      
      const cached = await storage.getInvoiceVerificationCache(cacheKey);
      console.log('🔍 [CACHE] Résultat cache:', { 
        found: !!cached, 
        isReconciled: cached?.isReconciled,
        expired: cached ? new Date() >= new Date(cached.expiresAt) : 'N/A',
        expiresAt: cached?.expiresAt,
        currentTime: new Date().toISOString()
      });
      
      // Cache permanent si facture validée (isReconciled = true)
      if (cached && cached.isReconciled) {
        console.log('✅ [CACHE] Cache PERMANENT pour facture validée:', { invoiceReference, groupId, exists: cached.exists });
        return {
          exists: cached.exists,
          matchType: cached.matchType,
          errorMessage: cached.errorMessage,
          invoiceReference: cached.invoiceReference,
          supplierName: cached.supplierName,
          fromCache: true,
          permanent: true
        };
      }
      
      // Cache temporaire non expiré
      if (cached && new Date() < new Date(cached.expiresAt)) {
        console.log('✅ [CACHE] Cache temporaire hit pour:', { invoiceReference, groupId, exists: cached.exists });
        return {
          exists: cached.exists,
          matchType: cached.matchType,
          errorMessage: cached.errorMessage,
          invoiceReference: cached.invoiceReference,
          supplierName: cached.supplierName,
          fromCache: true,
          permanent: false
        };
      }
      
      if (cached && new Date() >= new Date(cached.expiresAt)) {
        console.log('⏰ [CACHE] Cache temporaire expiré pour:', { invoiceReference, groupId });
      } else {
        console.log('❌ [CACHE] Cache miss pour:', { invoiceReference, groupId });
      }
      
      return null;
    } catch (error) {
      console.error('❌ [CACHE] Erreur lecture cache:', error);
      return null;
    }
  }

  /**
   * Sauvegarder dans le cache avec durée adaptative
   */
  async saveToCache(invoiceReference: string, groupId: number, result: any, supplierName?: string, isReconciled: boolean = false): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(invoiceReference, groupId);
      
      // Durée de cache adaptative selon les cas
      const expiresAt = new Date();
      let cacheDescription = '';
      
      if (isReconciled) {
        // Cache PERMANENT pour factures validées - expire dans 50 ans
        expiresAt.setFullYear(expiresAt.getFullYear() + 50);
        cacheDescription = 'PERMANENT (validé)';
      } else if (result.exists) {
        // Facture trouvée mais non validée - cache 6h pour permettre corrections
        expiresAt.setHours(expiresAt.getHours() + 6);
        cacheDescription = 'temporaire 6h (trouvé)';
      } else {
        // Facture non trouvée - cache 12h pour éviter spam
        expiresAt.setHours(expiresAt.getHours() + 12);
        cacheDescription = 'temporaire 12h (pas trouvé)';
      }
      
      console.log('💾 [CACHE] Tentative sauvegarde:', { 
        invoiceReference, 
        groupId, 
        cacheKey, 
        exists: result.exists,
        isReconciled,
        cacheType: cacheDescription,
        expiresAt: expiresAt.toISOString() 
      });
      
      const cacheData = {
        cacheKey,
        groupId,
        invoiceReference,
        supplierName: supplierName || null,
        exists: result.exists,
        matchType: result.matchType,
        errorMessage: result.errorMessage || null,
        cacheHit: false,
        apiCallTime: null,
        isReconciled, // Nouveau champ pour cache permanent
        expiresAt
      };
      
      const savedCache = await storage.saveInvoiceVerificationCache(cacheData);
      
      console.log('✅ [CACHE] Résultat sauvé en cache:', { 
        id: savedCache.id,
        invoiceReference, 
        groupId, 
        exists: result.exists,
        isReconciled,
        cacheType: cacheDescription,
        cacheKey
      });
    } catch (error) {
      // Gérer spécifiquement les erreurs de contrainte unique (duplicate key)
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        console.log('🔄 [CACHE] Cache déjà existant pour cette clé, ignoré:', { invoiceReference, groupId });
        return;
      }
      console.error('❌ [CACHE] Erreur sauvegarde cache:', error);
      console.error('❌ [CACHE] Détails erreur:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack'
      });
    }
  }

  /**
   * Vérifie une référence de facture pour un groupe donné
   */
  async verifyInvoice(invoiceReference: string, groupId: number, forceRefresh: boolean = false, isReconciled: boolean = false): Promise<{
    exists: boolean;
    matchType: 'invoice_reference' | 'bl_number' | 'none';
    errorMessage?: string;
    invoiceReference?: string;
    invoiceAmount?: number;
    supplierName?: string;
    fromCache?: boolean;
  }> {
    try {
      console.log('🔍 [INVOICE] Début vérification facture:', { invoiceReference, groupId, forceRefresh });
      
      if (!invoiceReference || !invoiceReference.trim()) {
        return {
          exists: false,
          matchType: 'none',
          errorMessage: 'Référence de facture vide'
        };
      }

      // Vérifier le cache d'abord (sauf si refresh forcé)
      if (!forceRefresh) {
        console.log('🔍 [INVOICE] Vérification cache...');
        const cachedResult = await this.checkCache(invoiceReference, groupId);
        if (cachedResult) {
          console.log('✅ [INVOICE] Résultat depuis cache:', cachedResult);
          return cachedResult;
        }
        console.log('🔍 [INVOICE] Pas de cache, requête API...');
      } else {
        console.log('🔄 [INVOICE] Refresh forcé, ignorant le cache');
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
          const result = {
            exists: true,
            matchType: 'invoice_reference',
            invoiceReference: invoiceReference,
            invoiceAmount: 123.45,
            supplierName: 'Fournisseur Test'
          };
          
          // Sauvegarder en cache
          await this.saveToCache(invoiceReference, groupId, result, result.supplierName, isReconciled);
          return result;
        }
        
        if (invoiceReference.toLowerCase().includes('bl')) {
          const result = {
            exists: true,
            matchType: 'bl_number',
            invoiceReference: `FACT_${invoiceReference}`,
            invoiceAmount: 67.89,
            supplierName: 'Fournisseur BL'
          };
          
          // Sauvegarder en cache
          await this.saveToCache(invoiceReference, groupId, result, result.supplierName, isReconciled);
          return result;
        }

        const result = {
          exists: false,
          matchType: 'none',
          errorMessage: 'Facture non trouvée (mode développement)'
        };
        
        // Sauvegarder même les résultats "non trouvé" pour éviter les rappels répétés
        await this.saveToCache(invoiceReference, groupId, result, undefined, isReconciled);
        return result;
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

        // Gérer les erreurs d'API spécifiques
        if (matchResult.error) {
          const result = {
            exists: false,
            matchType: 'none' as const,
            errorMessage: matchResult.error
          };
          
          // Sauvegarder en cache même les erreurs pour éviter les rappels répétés
          await this.saveToCache(invoiceReference, groupId, result, undefined, isReconciled);
          return result;
        }

        if (matchResult.found) {
          const result = {
            exists: true,
            matchType: 'invoice_reference' as const,
            invoiceReference: matchResult.data.invoice_reference || invoiceReference,
            invoiceAmount: parseFloat(matchResult.data[group.nocodbAmountColumnName || 'amount'] || '0'),
            supplierName: matchResult.data[group.nocodbSupplierColumnName || 'supplier'] || 'Inconnu'
          };
          
          // Sauvegarder en cache si succès
          await this.saveToCache(invoiceReference, groupId, result, result.supplierName, isReconciled);
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

          // Gérer les erreurs d'API pour la recherche BL
          if (matchResult.error) {
            const result = {
              exists: false,
              matchType: 'none' as const,
              errorMessage: matchResult.error
            };
            
            // Sauvegarder en cache même les erreurs
            await this.saveToCache(invoiceReference, groupId, result, undefined, isReconciled);
            return result;
          }

          if (matchResult.found) {
            const result = {
              exists: true,
              matchType: 'bl_number' as const,
              invoiceReference: matchResult.data.invoice_reference || `BL_${invoiceReference}`,
              invoiceAmount: parseFloat(matchResult.data[group.nocodbAmountColumnName || 'amount'] || '0'),
              supplierName: matchResult.data[group.nocodbSupplierColumnName || 'supplier'] || 'Inconnu'
            };
            
            // Sauvegarder en cache si succès
            await this.saveToCache(invoiceReference, groupId, result, result.supplierName, isReconciled);
            return result;
          }
        }

        // Aucune correspondance trouvée
        const notFoundResult = {
          exists: false,
          matchType: 'none' as const,
          errorMessage: 'Aucune correspondance trouvée dans NocoDB'
        };
        
        // Sauvegarder même les résultats "non trouvé" pour éviter les rappels répétés
        await this.saveToCache(invoiceReference, groupId, notFoundResult, undefined, isReconciled);
        return notFoundResult;

      } catch (error) {
        const errorMessage = `Erreur NocoDB: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
        
        // Log condensé en production
        if (process.env.NODE_ENV === 'production') {
          console.error('❌ Erreur vérification NocoDB:', error instanceof Error ? error.message : 'Erreur inconnue');
        } else {
          console.error('❌ Erreur lors de la vérification NocoDB:', error);
        }
        
        const errorResult = {
          exists: false,
          matchType: 'none' as const,
          errorMessage
        };
        
        // Sauvegarder les erreurs en cache pour éviter les rappels répétés
        await this.saveToCache(invoiceReference, groupId, errorResult, undefined, isReconciled);
        return errorResult;
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
   * Recherche dans NocoDB avec protection contre les erreurs
   */
  private async searchInNocoDB(
    searchValue: string, 
    columnName: string, 
    config: any, 
    tableId: string
  ): Promise<{ found: boolean; data?: any; error?: string }> {
    try {
      // Protection contre les appels avec des paramètres invalides
      if (!searchValue || !columnName || !config || !tableId) {
        return { found: false, error: 'Paramètres invalides' };
      }

      // Utiliser directement l'ID de table fourni  
      const searchUrl = `${config.baseUrl}/api/v1/db/data/v1/${config.projectId}/${tableId}`;
      
      // Log condensé en production pour éviter le spam
      if (process.env.NODE_ENV === 'production') {
        console.log('🔍 Recherche NocoDB:', { tableId, column: columnName });
      } else {
        console.log('🔍 Recherche NocoDB:', {
          url: searchUrl,
          tableId: tableId,
          column: columnName,
          value: searchValue
        });
      }

      // Créer un AbortController pour le timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes timeout

      try {
        const response = await fetch(`${searchUrl}?where=(${columnName},eq,${encodeURIComponent(searchValue)})`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'xc-token': config.apiToken
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          console.error('❌ Erreur réponse NocoDB:', errorMsg);
          return { found: false, error: errorMsg };
        }

        const result = await response.json();
        
        // Log condensé en production
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ Réponse NocoDB:', result);
        }

        if (result.list && result.list.length > 0) {
          return {
            found: true,
            data: result.list[0]
          };
        }

        return { found: false };

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Gestion spécifique des erreurs réseau
        if (fetchError.name === 'AbortError') {
          const timeoutMsg = 'Timeout - API NocoDB non accessible';
          console.error('⏱️ Timeout NocoDB:', timeoutMsg);
          return { found: false, error: timeoutMsg };
        }
        
        if (fetchError.code === 'ERR_CERT_VERIFIER_CHANGED' || fetchError.message?.includes('certificate')) {
          const certMsg = 'Erreur certificat SSL - Vérifiez la configuration NocoDB';
          console.error('🔒 Erreur certificat NocoDB:', certMsg);
          return { found: false, error: certMsg };
        }

        if (fetchError.code === 'ENOTFOUND' || fetchError.code === 'ECONNREFUSED') {
          const connMsg = 'NocoDB non accessible - Vérifiez la connectivité réseau';
          console.error('🌐 Erreur connexion NocoDB:', connMsg);
          return { found: false, error: connMsg };
        }

        throw fetchError; // Relancer les autres erreurs
      }

    } catch (error: any) {
      // Log d'erreur condensé en production
      const errorMsg = error?.message || 'Erreur inconnue';
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ Erreur NocoDB:', errorMsg);
      } else {
        console.error('❌ Erreur appel NocoDB:', error);
      }
      
      return { found: false, error: errorMsg };
    }
  }

  /**
   * Vérifie une facture par numéro de BL et nom de fournisseur
   */
  async verifyInvoiceByBL(blNumber: string, supplierName: string, groupId: number, forceRefresh: boolean = false, isReconciled: boolean = false): Promise<{
    exists: boolean;
    matchType: 'invoice_reference' | 'bl_number' | 'none';
    errorMessage?: string;
    invoiceReference?: string;
    invoiceAmount?: number;
    supplierName?: string;
    fromCache?: boolean;
  }> {
    try {
      console.log('🔍 Début vérification facture par BL:', { blNumber, supplierName, groupId, forceRefresh });
      
      if (!blNumber || !blNumber.trim()) {
        return {
          exists: false,
          matchType: 'none',
          errorMessage: 'Numéro BL vide'
        };
      }

      // Générer une clé de cache pour le BL
      const cacheKey = `bl_${groupId}_${blNumber.trim().toLowerCase()}_${supplierName.toLowerCase()}`;
      
      // Vérifier le cache d'abord (sauf si refresh forcé)
      if (!forceRefresh) {
        try {
          const cached = await storage.getInvoiceVerificationCache(cacheKey);
          if (cached && new Date() < new Date(cached.expiresAt)) {
            console.log('💾 Cache hit pour BL:', { blNumber, groupId });
            return {
              exists: cached.exists,
              matchType: cached.matchType as 'invoice_reference' | 'bl_number' | 'none',
              errorMessage: cached.errorMessage || undefined,
              invoiceReference: cached.invoiceReference || undefined,
              supplierName: cached.supplierName || undefined,
              fromCache: true
            };
          }
        } catch (error) {
          console.error('❌ Erreur lecture cache BL:', error);
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

      console.log('🔧 Configuration groupe pour BL:', {
        groupName: group.name,
        hasNocodbConfig: !!group.nocodbConfigId,
        hasTableName: !!group.nocodbTableName,
        hasWebhook: !!group.webhookUrl,
        blColumnName: group.nocodbBlColumnName
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
        console.log('🔧 Mode développement - simulation vérification BL');
        
        if (blNumber && blNumber.trim()) {
          const result = {
            exists: true,
            matchType: 'bl_number' as const,
            invoiceReference: `FACT_${blNumber}`,
            invoiceAmount: 156.78,
            supplierName: supplierName
          };
          
          // Sauvegarder en cache
          try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            
            await storage.saveInvoiceVerificationCache({
              cacheKey,
              groupId,
              invoiceReference: result.invoiceReference,
              supplierName: supplierName,
              exists: result.exists,
              matchType: result.matchType,
              errorMessage: null,
              cacheHit: false,
              apiCallTime: null,
              expiresAt
            });
          } catch (error) {
            console.error('❌ Erreur sauvegarde cache BL:', error);
          }
          
          return result;
        }
        
        return {
          exists: false,
          matchType: 'none',
          errorMessage: 'BL non trouvé (mode développement)'
        };
      }

      // En production, faire l'appel réel à NocoDB
      console.log('🔍 Vérification BL NocoDB en production...');
      
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

        // Utiliser l'ID de table configuré dans le groupe
        const tableId = group.nocodbTableId || 'mrr733dfb8wtt9b';
        console.log('🔧 Utilisation table ID pour BL:', { 
          groupTable: group.nocodbTableName, 
          configuredId: group.nocodbTableId,
          resolvedId: tableId 
        });

        // Rechercher par numéro de BL
        const blColumnName = group.nocodbBlColumnName || 'Numero_BL';
        let matchResult = await this.searchInNocoDB(
          blNumber, 
          blColumnName,
          nocodbConfig,
          tableId
        );

        // Gérer les erreurs d'API spécifiques
        if (matchResult.error) {
          const result = {
            exists: false,
            matchType: 'none' as const,
            errorMessage: matchResult.error
          };
          
          // Sauvegarder en cache même les erreurs
          try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            
            await storage.saveInvoiceVerificationCache({
              cacheKey,
              groupId,
              invoiceReference: blNumber,
              supplierName: supplierName,
              exists: false,
              matchType: 'none',
              errorMessage: result.errorMessage,
              cacheHit: false,
              apiCallTime: null,
              isReconciled,
              expiresAt
            });
          } catch (error) {
            console.error('❌ Erreur sauvegarde cache erreur BL:', error);
          }
          
          return result;
        }

        if (matchResult.found) {
          // Vérifier que le fournisseur correspond
          const foundSupplier = matchResult.data[group.nocodbSupplierColumnName || 'supplier'] || '';
          const supplierMatch = foundSupplier.toLowerCase().includes(supplierName.toLowerCase()) || 
                               supplierName.toLowerCase().includes(foundSupplier.toLowerCase());
          
          if (!supplierMatch) {
            console.log('⚠️ Fournisseur ne correspond pas:', { 
              expected: supplierName, 
              found: foundSupplier 
            });
            return {
              exists: false,
              matchType: 'none',
              errorMessage: `BL trouvé mais fournisseur différent: ${foundSupplier} vs ${supplierName}`
            };
          }
          
          const result = {
            exists: true,
            matchType: 'bl_number' as const,
            invoiceReference: matchResult.data[group.invoiceColumnName || 'RefFacture'] || `BL_${blNumber}`,
            invoiceAmount: parseFloat(matchResult.data[group.nocodbAmountColumnName || 'amount'] || '0'),
            supplierName: foundSupplier || supplierName
          };
          
          // Sauvegarder en cache si succès
          try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            
            await storage.saveInvoiceVerificationCache({
              cacheKey,
              groupId,
              invoiceReference: result.invoiceReference,
              supplierName: result.supplierName,
              exists: true,
              matchType: 'bl_number',
              errorMessage: null,
              cacheHit: false,
              apiCallTime: null,
              isReconciled,
              expiresAt
            });
          } catch (error) {
            console.error('❌ Erreur sauvegarde cache succès BL:', error);
          }
          
          return result;
        }

        // Aucune correspondance trouvée
        const notFoundResult = {
          exists: false,
          matchType: 'none' as const,
          errorMessage: 'Aucun BL correspondant trouvé dans NocoDB'
        };
        
        // Sauvegarder même les résultats "non trouvé"
        try {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);
          
          await storage.saveInvoiceVerificationCache({
            cacheKey,
            groupId,
            invoiceReference: blNumber,
            supplierName: supplierName,
            exists: false,
            matchType: 'none',
            errorMessage: notFoundResult.errorMessage,
            cacheHit: false,
            apiCallTime: null,
            isReconciled,
            expiresAt
          });
        } catch (error) {
          console.error('❌ Erreur sauvegarde cache not found BL:', error);
        }
        
        return notFoundResult;

      } catch (error) {
        const errorMessage = `Erreur NocoDB BL: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
        
        console.error('❌ Erreur lors de la vérification BL NocoDB:', error);
        
        const errorResult = {
          exists: false,
          matchType: 'none' as const,
          errorMessage
        };
        
        // Sauvegarder les erreurs en cache
        try {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);
          
          await storage.saveInvoiceVerificationCache({
            cacheKey,
            groupId,
            invoiceReference: blNumber,
            supplierName: supplierName,
            exists: false,
            matchType: 'none',
            errorMessage: errorResult.errorMessage,
            cacheHit: false,
            apiCallTime: null,
            isReconciled,
            expiresAt
          });
        } catch (error) {
          console.error('❌ Erreur sauvegarde cache erreur BL:', error);
        }
        
        return errorResult;
      }

    } catch (error) {
      console.error('❌ Erreur vérification facture par BL:', error);
      return {
        exists: false,
        matchType: 'none',
        errorMessage: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Recherche par numéro de BL (méthode simplifiée pour compatibilité)
   */
  async searchByBLNumber(blNumber: string, groupId: number): Promise<any> {
    console.log('🔍 Recherche par BL (legacy):', { blNumber, groupId });
    
    const result = await this.verifyInvoiceByBL(blNumber, '', groupId, false);
    
    if (result.exists) {
      return {
        found: true,
        data: {
          invoiceReference: result.invoiceReference,
          amount: result.invoiceAmount,
          supplier: result.supplierName
        }
      };
    } else {
      return {
        found: false,
        error: result.errorMessage || 'BL non trouvé'
      };
    }
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