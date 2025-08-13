import { db } from './db.js';
import { groups, nocodbConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from './storage.js';

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
  private async getActiveNocodbConfig(): Promise<any> {
    try {
      const config = await storage.getActiveNocodbConfig();
      console.log('🔧 Configuration NocoDB active:', config);
      return config;
    } catch (error) {
      console.error('❌ Erreur récupération config NocoDB:', error);
      return null;
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

  async verifyInvoice(invoiceRef: string, groupId: number): Promise<InvoiceVerificationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Début vérification facture:', { invoiceRef, groupId });

      // 1. Récupérer la configuration NocoDB active
      const config = await this.getActiveNocodbConfig();
      if (!config) {
        throw new Error('Aucune configuration NocoDB active trouvée');
      }

      // 2. Récupérer les informations du groupe
      const [group] = await db
        .select()
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1);
      
      if (!group) {
        throw new Error('Groupe non trouvé');
      }

      console.log('🏪 Groupe trouvé:', { id: group.id, name: group.name });

      // 3. Test de connexion à NocoDB avec une requête simple
      const testUrl = `${config.baseUrl}/api/v2/meta/projects`;
      console.log('🧪 Test connexion NocoDB:', testUrl);
      
      const testResponse = await fetch(testUrl, {
        headers: {
          'xc-token': config.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!testResponse.ok) {
        throw new Error(`Erreur connexion NocoDB: ${testResponse.status} ${testResponse.statusText}`);
      }

      console.log('✅ Connexion NocoDB réussie');

      // 4. Recherche de la facture (simulation pour le moment)
      const result: InvoiceVerificationResult = {
        exists: Math.random() > 0.5, // Simulation aléatoire pour test
        matchType: 'invoice_ref',
        invoiceReference: invoiceRef,
        supplierMatch: true,
        cacheHit: false,
        apiCallTime: Date.now() - startTime
      };

      console.log('📊 Résultat vérification:', result);

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