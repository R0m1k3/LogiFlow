import { db } from './db.js';
import { groups } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
  private getNocodbConfigFromGroup(group: any): any {
    // Configuration NocoDB stockée directement dans le groupe
    // Vous devez renseigner ces valeurs dans votre table groups en production
    return {
      baseUrl: process.env.NOCODB_BASE_URL || 'https://your-nocodb-instance.com',
      apiToken: process.env.NOCODB_API_TOKEN || '',
      projectId: process.env.NOCODB_PROJECT_ID || ''
    };
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
    groupId: number,
    groupConfig?: any
  ): Promise<InvoiceVerificationResult> {
    const startTime = Date.now();
    
    try {

      // 2. Utiliser la configuration du groupe passée en paramètre ou la récupérer
      let group = groupConfig;
      if (!group) {
        const [groupFromDb] = await db
          .select()
          .from(groups)
          .where(eq(groups.id, groupId))
          .limit(1);
        group = groupFromDb;
      }
      
      if (!group || !group.nocodbTableName) {
        throw new Error('Configuration NocoDB manquante pour ce magasin');
      }

      // 3. Récupérer la configuration NocoDB à partir des variables d'environnement
      const config = this.getNocodbConfigFromGroup(group);

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