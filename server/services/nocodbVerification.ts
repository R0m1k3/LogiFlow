import { storage } from '../storage';

export interface InvoiceVerificationResult {
  found: boolean;
  invoiceReference?: string;
  invoiceAmount?: string;
  supplierMatch: boolean;
  error?: string;
}

export interface BLSearchResult {
  found: boolean;
  invoiceReference?: string;
  invoiceAmount?: string;
  error?: string;
}

export class NocoDBVerificationService {
  
  /**
   * Vérifie l'existence d'une référence de facture dans NocoDB pour un magasin donné
   */
  async verifyInvoiceReference(
    groupId: number,
    invoiceReference: string,
    supplierName: string
  ): Promise<InvoiceVerificationResult> {
    try {
      console.log(`🔍 Vérification facture ${invoiceReference} pour fournisseur ${supplierName} (magasin ${groupId})`);
      
      // Récupérer la configuration du magasin
      const group = await storage.getGroup(groupId);
      if (!group?.nocodbConfigId || !group.nocodbTableName) {
        console.log(`❌ Pas de configuration NocoDB pour le magasin ${groupId}`);
        return {
          found: false,
          supplierMatch: false,
          error: 'Configuration NocoDB manquante pour ce magasin'
        };
      }

      // Récupérer la configuration NocoDB globale
      const nocodbConfig = await storage.getNocodbConfig(group.nocodbConfigId);
      if (!nocodbConfig) {
        return {
          found: false,
          supplierMatch: false,
          error: 'Configuration NocoDB introuvable'
        };
      }

      // Construire l'URL de l'API NocoDB
      const apiUrl = `${nocodbConfig.baseUrl}/api/v1/db/data/v1/${nocodbConfig.projectId}/${group.nocodbTableName}`;
      
      // Construire les paramètres de recherche
      const searchParams = new URLSearchParams();
      if (group.invoiceColumnName) {
        searchParams.append('where', `(${group.invoiceColumnName},eq,${invoiceReference})`);
      }

      const finalUrl = `${apiUrl}?${searchParams.toString()}`;
      console.log(`🌐 Requête NocoDB: ${finalUrl}`);

      // Faire la requête à NocoDB
      const response = await fetch(finalUrl, {
        headers: {
          'xc-token': nocodbConfig.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ Erreur NocoDB (${response.status}):`, await response.text());
        return {
          found: false,
          supplierMatch: false,
          error: `Erreur NocoDB: ${response.status}`
        };
      }

      const data = await response.json();
      console.log(`📊 Réponse NocoDB:`, { found: data.list?.length > 0, count: data.list?.length });

      if (data.list && data.list.length > 0) {
        const record = data.list[0];
        
        // Vérifier si le fournisseur correspond
        let supplierMatch = true;
        if (group.nocodbSupplierColumnName) {
          const nocodbSupplier = record[group.nocodbSupplierColumnName];
          supplierMatch = nocodbSupplier === supplierName;
          console.log(`🏷️ Vérification fournisseur:`, { 
            expected: supplierName, 
            found: nocodbSupplier, 
            match: supplierMatch 
          });
        }

        return {
          found: true,
          invoiceReference,
          invoiceAmount: group.nocodbAmountColumnName ? record[group.nocodbAmountColumnName]?.toString() : undefined,
          supplierMatch
        };
      }

      return {
        found: false,
        supplierMatch: false
      };

    } catch (error) {
      console.error('❌ Erreur lors de la vérification facture:', error);
      return {
        found: false,
        supplierMatch: false,
        error: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      };
    }
  }

  /**
   * Recherche une facture par numéro de BL et fournisseur
   */
  async searchByBLNumber(
    groupId: number,
    blNumber: string,
    supplierName: string
  ): Promise<BLSearchResult> {
    try {
      console.log(`🔍 Recherche par BL ${blNumber} pour fournisseur ${supplierName} (magasin ${groupId})`);
      
      // Récupérer la configuration du magasin
      const group = await storage.getGroup(groupId);
      if (!group?.nocodbConfigId || !group.nocodbTableName || !group.nocodbBlColumnName) {
        console.log(`❌ Configuration BL manquante pour le magasin ${groupId}`);
        return {
          found: false,
          error: 'Configuration NocoDB pour recherche BL manquante'
        };
      }

      // Récupérer la configuration NocoDB globale
      const nocodbConfig = await storage.getNocodbConfig(group.nocodbConfigId);
      if (!nocodbConfig) {
        return {
          found: false,
          error: 'Configuration NocoDB introuvable'
        };
      }

      // Construire l'URL de l'API NocoDB pour recherche par BL
      const apiUrl = `${nocodbConfig.baseUrl}/api/v1/db/data/v1/${nocodbConfig.projectId}/${group.nocodbTableName}`;
      
      // Construire les paramètres de recherche par BL et éventuellement fournisseur
      const searchParams = new URLSearchParams();
      let whereClause = `(${group.nocodbBlColumnName},eq,${blNumber})`;
      
      // Ajouter la condition fournisseur si configurée
      if (group.nocodbSupplierColumnName) {
        whereClause += `~and(${group.nocodbSupplierColumnName},eq,${supplierName})`;
      }
      
      searchParams.append('where', whereClause);

      const finalUrl = `${apiUrl}?${searchParams.toString()}`;
      console.log(`🌐 Requête NocoDB recherche BL: ${finalUrl}`);

      // Faire la requête à NocoDB
      const response = await fetch(finalUrl, {
        headers: {
          'xc-token': nocodbConfig.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ Erreur NocoDB recherche BL (${response.status}):`, await response.text());
        return {
          found: false,
          error: `Erreur NocoDB: ${response.status}`
        };
      }

      const data = await response.json();
      console.log(`📊 Réponse NocoDB recherche BL:`, { found: data.list?.length > 0, count: data.list?.length });

      if (data.list && data.list.length > 0) {
        const record = data.list[0];
        
        return {
          found: true,
          invoiceReference: group.invoiceColumnName ? record[group.invoiceColumnName] : undefined,
          invoiceAmount: group.nocodbAmountColumnName ? record[group.nocodbAmountColumnName]?.toString() : undefined
        };
      }

      return {
        found: false
      };

    } catch (error) {
      console.error('❌ Erreur lors de la recherche par BL:', error);
      return {
        found: false,
        error: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      };
    }
  }
}

export const nocodbVerificationService = new NocoDBVerificationService();