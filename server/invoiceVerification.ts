import { db } from './db.js';
import { nocodbConfig, invoiceVerificationCache, groups } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

interface InvoiceVerificationResult {
  exists: boolean;
  matchType: 'invoice_ref' | 'bl_number' | 'none';
  invoiceReference?: string;
  invoiceAmount?: string;
  supplierMatch: boolean;
  errorMessage?: string;
  apiCallTime?: number;
  cacheHit: boolean;
}

interface NocodbInvoice {
  Id: number;
  [key: string]: any; // Pour les colonnes dynamiques
}

class InvoiceVerificationService {
  private async getNocodbConfig(): Promise<any> {
    try {
      const [config] = await db
        .select()
        .from(nocodbConfig)
        .where(eq(nocodbConfig.isActive, true))
        .limit(1);
      
      if (!config) {
        console.log('⚠️ Aucune configuration NocoDB active trouvée dans la table nocodb_config');
        throw new Error('Aucune configuration NocoDB active trouvée');
      }
      
      console.log('✅ Configuration NocoDB trouvée:', {
        id: config.id,
        name: config.name,
        baseUrl: config.baseUrl,
        projectId: config.projectId
      });
      
      return config;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de la configuration NocoDB:', error);
      throw error;
    }
  }

  private generateCacheKey(groupId: number, invoiceRef: string, supplierName: string): string {
    return `${groupId}:${invoiceRef}:${supplierName}`.toLowerCase();
  }

  private async getCachedResult(cacheKey: string): Promise<InvoiceVerificationResult | null> {
    try {
      const [cached] = await db
        .select()
        .from(invoiceVerificationCache)
        .where(and(
          eq(invoiceVerificationCache.cacheKey, cacheKey),
          // Cache valide pour 24 heures
          eq(invoiceVerificationCache.expiresAt, new Date(Date.now() + 24 * 60 * 60 * 1000))
        ))
        .limit(1);

      if (cached && new Date() < new Date(cached.expiresAt)) {
        console.log('🎯 Cache hit pour:', cacheKey);
        return {
          exists: cached.exists,
          matchType: cached.matchType as any,
          invoiceReference: cached.invoiceReference,
          supplierMatch: !!cached.supplierName,
          cacheHit: true,
          apiCallTime: cached.apiCallTime || 0
        };
      }
    } catch (error) {
      console.error('❌ Erreur lors de la lecture du cache:', error);
    }
    
    return null;
  }

  private async setCachedResult(
    cacheKey: string, 
    groupId: number, 
    result: InvoiceVerificationResult,
    invoiceRef: string,
    supplierName: string
  ): Promise<void> {
    try {
      await db.insert(invoiceVerificationCache).values({
        cacheKey,
        groupId,
        invoiceReference: invoiceRef,
        supplierName,
        exists: result.exists,
        matchType: result.matchType,
        errorMessage: result.errorMessage,
        cacheHit: false,
        apiCallTime: result.apiCallTime || 0,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
      });
      
      console.log('💾 Résultat mis en cache:', cacheKey);
    } catch (error) {
      console.error('❌ Erreur lors de la mise en cache:', error);
    }
  }

  private async searchInNocodb(
    config: any, 
    group: any, 
    searchValue: string, 
    searchType: 'invoice' | 'bl'
  ): Promise<{ found: boolean; invoice?: any }> {
    const startTime = Date.now();
    
    try {
      // Définir la colonne de recherche selon le groupe
      const searchColumn = searchType === 'invoice' 
        ? group.invoiceColumnName 
        : group.nocodbBlColumnName;
      
      if (!searchColumn) {
        throw new Error(`Colonne ${searchType} non configurée pour ce magasin`);
      }

      const url = `${config.baseUrl}/api/v2/tables/${group.nocodbTableName}/records`;
      const params = new URLSearchParams({
        where: `(${searchColumn},eq,${searchValue})`
      });

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'xc-token': config.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`NocoDB API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const invoices = data.list || [];
      
      console.log(`🔍 Recherche NocoDB ${searchType}:`, {
        searchValue,
        found: invoices.length > 0,
        table: group.nocodbTableName,
        column: searchColumn,
        apiTime: Date.now() - startTime
      });

      return {
        found: invoices.length > 0,
        invoice: invoices[0] || null
      };
    } catch (error) {
      console.error(`❌ Erreur recherche NocoDB ${searchType}:`, error);
      throw error;
    }
  }

  async verifyInvoiceReference(
    invoiceRef: string,
    blNumber: string,
    supplierName: string,
    groupId: number
  ): Promise<InvoiceVerificationResult> {
    const startTime = Date.now();
    
    try {
      // 1. Vérifier le cache d'abord
      const cacheKey = this.generateCacheKey(groupId, invoiceRef, supplierName);
      const cachedResult = await this.getCachedResult(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // 2. Récupérer la configuration NocoDB
      const config = await this.getNocodbConfig();
      
      // 3. Récupérer les informations du groupe
      const [group] = await db
        .select()
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1);
      
      if (!group || !group.nocodbTableName) {
        throw new Error('Configuration NocoDB manquante pour ce magasin');
      }

      let result: InvoiceVerificationResult = {
        exists: false,
        matchType: 'none',
        supplierMatch: false,
        cacheHit: false,
        apiCallTime: 0
      };

      // 4. Recherche primaire : par référence facture
      if (invoiceRef && invoiceRef.trim()) {
        const searchResult = await this.searchInNocodb(config, group, invoiceRef, 'invoice');
        
        if (searchResult.found) {
          // Vérifier la correspondance du fournisseur
          const supplierColumn = group.nocodbSupplierColumnName;
          const invoiceSupplier = supplierColumn ? searchResult.invoice[supplierColumn] : '';
          const supplierMatch = !supplierColumn || 
            invoiceSupplier.toLowerCase().includes(supplierName.toLowerCase()) ||
            supplierName.toLowerCase().includes(invoiceSupplier.toLowerCase());

          if (supplierMatch) {
            result = {
              exists: true,
              matchType: 'invoice_ref',
              invoiceReference: invoiceRef,
              invoiceAmount: group.nocodbAmountColumnName ? 
                searchResult.invoice[group.nocodbAmountColumnName] : undefined,
              supplierMatch: true,
              cacheHit: false,
              apiCallTime: Date.now() - startTime
            };
          } else {
            result.errorMessage = 'Référence trouvée mais fournisseur ne correspond pas';
          }
        }
      }

      // 5. Recherche secondaire : par numéro de BL si pas de résultat avec la facture
      if (!result.exists && blNumber && blNumber.trim()) {
        const searchResult = await this.searchInNocodb(config, group, blNumber, 'bl');
        
        if (searchResult.found) {
          // Vérifier la correspondance du fournisseur
          const supplierColumn = group.nocodbSupplierColumnName;
          const invoiceSupplier = supplierColumn ? searchResult.invoice[supplierColumn] : '';
          const supplierMatch = !supplierColumn || 
            invoiceSupplier.toLowerCase().includes(supplierName.toLowerCase()) ||
            supplierName.toLowerCase().includes(invoiceSupplier.toLowerCase());

          if (supplierMatch) {
            const foundInvoiceRef = group.invoiceColumnName ? 
              searchResult.invoice[group.invoiceColumnName] : '';
            const foundAmount = group.nocodbAmountColumnName ? 
              searchResult.invoice[group.nocodbAmountColumnName] : '';

            result = {
              exists: true,
              matchType: 'bl_number',
              invoiceReference: foundInvoiceRef,
              invoiceAmount: foundAmount,
              supplierMatch: true,
              cacheHit: false,
              apiCallTime: Date.now() - startTime
            };
          } else {
            result.errorMessage = 'BL trouvé mais fournisseur ne correspond pas';
          }
        }
      }

      // Si rien trouvé
      if (!result.exists) {
        result.apiCallTime = Date.now() - startTime;
        result.errorMessage = result.errorMessage || 'Aucune correspondance trouvée';
      }

      // 6. Mettre en cache le résultat
      await this.setCachedResult(cacheKey, groupId, result, invoiceRef, supplierName);

      return result;

    } catch (error) {
      console.error('❌ Erreur vérification facture:', error);
      return {
        exists: false,
        matchType: 'none',
        supplierMatch: false,
        cacheHit: false,
        errorMessage: error instanceof Error ? error.message : 'Erreur inconnue',
        apiCallTime: Date.now() - startTime
      };
    }
  }
}

export const invoiceVerificationService = new InvoiceVerificationService();