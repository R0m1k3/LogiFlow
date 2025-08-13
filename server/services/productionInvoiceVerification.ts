import { IStorage } from "../storage";

interface VerificationResult {
  exists: boolean;
  matchType: string;
  invoiceReference?: string;
  invoiceAmount?: number;
  errorMessage?: string;
}

export class ProductionInvoiceVerificationService {
  constructor(private storage: IStorage) {}

  // Vérifie une référence facture (avec cache)
  async verifyInvoiceReference(
    groupId: number, 
    invoiceReference: string, 
    supplierName?: string
  ): Promise<VerificationResult> {
    console.log(`🔍 Production Verification - Invoice: ${invoiceReference}, Group: ${groupId}, Supplier: ${supplierName}`);
    
    // 1. Vérifier d'abord dans les vérifications existantes 
    const existingVerifications = await this.storage.getInvoiceVerifications();
    const existing = existingVerifications.find(v => 
      v.groupId === groupId && 
      v.invoiceReference === invoiceReference &&
      (!supplierName || v.supplierName === supplierName)
    );
    
    if (existing) {
      console.log(`✅ Production Cache Hit - Found existing verification: ${existing.exists}`);
      return {
        exists: existing.exists,
        matchType: existing.matchType || 'direct',
        invoiceReference: existing.invoiceReference
      };
    }

    // 2. Vérifier dans le cache
    const cacheKey = `${groupId}_${invoiceReference}_${supplierName || 'any'}`;
    const cache = await this.storage.getInvoiceVerificationCache(cacheKey);
    
    if (cache && cache.expiresAt > new Date()) {
      console.log(`⚡ Production Cache Hit - Using cached result: ${cache.exists}`);
      return {
        exists: cache.exists,
        matchType: cache.matchType,
        invoiceReference: cache.invoiceReference
      };
    }

    // 3. Faire la vérification réelle via NocoDB
    try {
      const result = await this.verifyWithNocoDB(groupId, invoiceReference, supplierName);
      
      // 4. Sauvegarder dans le cache
      await this.saveToCaches(groupId, invoiceReference, supplierName, result, 'delivery_verification');
      
      return result;
    } catch (error) {
      console.error(`❌ Production NocoDB Error:`, error);
      
      // Sauvegarder l'erreur dans le cache
      const errorResult: VerificationResult = {
        exists: false,
        matchType: 'error',
        errorMessage: error instanceof Error ? error.message : 'Erreur de vérification'
      };
      
      await this.saveToCaches(groupId, invoiceReference, supplierName, errorResult, 'error');
      return errorResult;
    }
  }

  // Recherche par numéro BL (avec cache)
  async searchByBLNumber(
    groupId: number, 
    blNumber: string, 
    supplierName?: string
  ): Promise<VerificationResult> {
    console.log(`🔍 Production BL Search - BL: ${blNumber}, Group: ${groupId}, Supplier: ${supplierName}`);
    
    // Vérifier dans le cache BL
    const cacheKey = `bl_${groupId}_${blNumber}_${supplierName || 'any'}`;
    const cache = await this.storage.getInvoiceVerificationCache(cacheKey);
    
    if (cache && cache.expiresAt > new Date()) {
      console.log(`⚡ Production BL Cache Hit: ${cache.exists}`);
      return {
        exists: cache.exists,
        matchType: cache.matchType,
        invoiceReference: cache.invoiceReference,
        invoiceAmount: cache.apiCallTime // On stocke le montant dans ce champ temporairement
      };
    }

    // Faire la recherche réelle via NocoDB
    try {
      const result = await this.searchBLWithNocoDB(groupId, blNumber, supplierName);
      
      // Sauvegarder dans le cache
      await this.saveToCaches(groupId, blNumber, supplierName, result, 'bl_search');
      
      return result;
    } catch (error) {
      console.error(`❌ Production BL Search Error:`, error);
      
      const errorResult: VerificationResult = {
        exists: false,
        matchType: 'error',
        errorMessage: error instanceof Error ? error.message : 'Erreur de recherche BL'
      };
      
      await this.saveToCaches(groupId, blNumber, supplierName, errorResult, 'bl_error');
      return errorResult;
    }
  }

  // Vérification réelle avec NocoDB
  private async verifyWithNocoDB(
    groupId: number, 
    invoiceReference: string, 
    supplierName?: string
  ): Promise<VerificationResult> {
    // Récupérer la configuration du groupe
    const group = await this.storage.getGroup(groupId);
    if (!group || !group.nocodbConfigId || !group.nocodbTableName) {
      throw new Error(`Configuration NocoDB manquante pour le groupe ${groupId}`);
    }

    // Récupérer la configuration NocoDB
    const nocodbConfig = await this.storage.getNocodbConfig(group.nocodbConfigId);
    if (!nocodbConfig || !nocodbConfig.isActive) {
      throw new Error(`Configuration NocoDB inactive ou introuvable (ID: ${group.nocodbConfigId})`);
    }

    console.log(`🌐 Production NocoDB Call - Table: ${group.nocodbTableName}, Invoice: ${invoiceReference}`);

    // Construire la requête NocoDB
    const baseUrl = nocodbConfig.baseUrl.replace(/\/+$/, ''); // Enlever les trailing slashes
    const tableUrl = `${baseUrl}/api/v1/db/data/${nocodbConfig.projectId}/${group.nocodbTableName}`;
    
    // Construire les conditions de recherche
    const invoiceColumn = group.invoiceColumnName || 'invoice_reference';
    const supplierColumn = group.nocodbSupplierColumnName || 'supplier';
    
    let whereClause = `(${invoiceColumn},eq,${invoiceReference})`;
    if (supplierName && supplierColumn) {
      whereClause += `~and(${supplierColumn},eq,${supplierName})`;
    }
    
    const searchUrl = `${tableUrl}?where=${encodeURIComponent(whereClause)}&limit=1`;
    
    console.log(`🌐 Production NocoDB URL: ${searchUrl}`);

    // Faire l'appel API
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'xc-token': nocodbConfig.apiToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`NocoDB API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Production NocoDB Response:`, data);

    const exists = data.list && data.list.length > 0;
    
    return {
      exists,
      matchType: 'direct',
      invoiceReference
    };
  }

  // Recherche BL avec NocoDB
  private async searchBLWithNocoDB(
    groupId: number, 
    blNumber: string, 
    supplierName?: string
  ): Promise<VerificationResult> {
    // Récupérer la configuration du groupe
    const group = await this.storage.getGroup(groupId);
    if (!group || !group.nocodbConfigId || !group.nocodbTableName) {
      throw new Error(`Configuration NocoDB manquante pour le groupe ${groupId}`);
    }

    // Récupérer la configuration NocoDB
    const nocodbConfig = await this.storage.getNocodbConfig(group.nocodbConfigId);
    if (!nocodbConfig || !nocodbConfig.isActive) {
      throw new Error(`Configuration NocoDB inactive ou introuvable (ID: ${group.nocodbConfigId})`);
    }

    console.log(`🌐 Production NocoDB BL Search - Table: ${group.nocodbTableName}, BL: ${blNumber}`);

    // Construire la requête NocoDB pour recherche BL
    const baseUrl = nocodbConfig.baseUrl.replace(/\/+$/, '');
    const tableUrl = `${baseUrl}/api/v1/db/data/${nocodbConfig.projectId}/${group.nocodbTableName}`;
    
    const blColumn = group.nocodbBlColumnName || 'bl_number';
    const supplierColumn = group.nocodbSupplierColumnName || 'supplier';
    const invoiceColumn = group.invoiceColumnName || 'invoice_reference';
    const amountColumn = group.nocodbAmountColumnName || 'amount';
    
    let whereClause = `(${blColumn},eq,${blNumber})`;
    if (supplierName && supplierColumn) {
      whereClause += `~and(${supplierColumn},eq,${supplierName})`;
    }
    
    const searchUrl = `${tableUrl}?where=${encodeURIComponent(whereClause)}&limit=1`;
    
    console.log(`🌐 Production NocoDB BL URL: ${searchUrl}`);

    // Faire l'appel API
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'xc-token': nocodbConfig.apiToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`NocoDB API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Production NocoDB BL Response:`, data);

    if (data.list && data.list.length > 0) {
      const record = data.list[0];
      return {
        exists: true,
        matchType: 'bl_search',
        invoiceReference: record[invoiceColumn],
        invoiceAmount: parseFloat(record[amountColumn]) || undefined
      };
    }

    return {
      exists: false,
      matchType: 'bl_search'
    };
  }

  // Sauvegarder dans les caches
  private async saveToCaches(
    groupId: number,
    reference: string,
    supplierName: string | undefined,
    result: VerificationResult,
    context: string
  ): Promise<void> {
    try {
      // 1. Sauvegarder dans le cache avec expiration
      const cacheKey = context.startsWith('bl_') 
        ? `bl_${groupId}_${reference}_${supplierName || 'any'}`
        : `${groupId}_${reference}_${supplierName || 'any'}`;
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Cache 1 heure
      
      await this.storage.createInvoiceVerificationCache({
        cacheKey,
        groupId,
        invoiceReference: reference,
        supplierName: supplierName || null,
        exists: result.exists,
        matchType: result.matchType,
        errorMessage: result.errorMessage || null,
        cacheHit: false,
        apiCallTime: result.invoiceAmount ? Math.round(result.invoiceAmount) : undefined,
        expiresAt
      });

      // 2. Si c'est une vérification de livraison réussie, sauvegarder aussi dans les vérifications permanentes
      if (context === 'delivery_verification' && result.exists) {
        // On a besoin du deliveryId, pour l'instant on utilise 0 comme placeholder
        await this.storage.createInvoiceVerification({
          deliveryId: 0, // Sera mis à jour par l'API route
          groupId,
          invoiceReference: reference,
          supplierName: supplierName || null,
          exists: result.exists,
          matchType: result.matchType,
          isValid: true
        });
      }

      console.log(`💾 Production Cache Saved - Key: ${cacheKey}, Exists: ${result.exists}`);
    } catch (error) {
      console.error(`❌ Production Cache Save Error:`, error);
    }
  }
}