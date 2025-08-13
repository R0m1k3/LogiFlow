import { storage } from "../storage";

interface NocodbConfig {
  id: number;
  baseUrl: string;
  apiToken: string;
  projectId: string;
  isActive: boolean;
}

interface GroupConfig {
  nocodbConfigId?: number;
  nocodbTableName?: string;
  invoiceColumnName?: string;
  nocodbBlColumnName?: string;
  nocodbAmountColumnName?: string;
  nocodbSupplierColumnName?: string;
}

class NocodbVerificationService {
  private async getNocodbConfig(configId: number): Promise<NocodbConfig | null> {
    try {
      return await storage.getNocodbConfig(configId);
    } catch (error) {
      console.error('Erreur récupération config NocoDB:', error);
      return null;
    }
  }

  private async getGroupConfig(groupId: number): Promise<GroupConfig | null> {
    try {
      const group = await storage.getGroup(groupId);
      if (!group) return null;

      return {
        nocodbConfigId: group.nocodbConfigId || undefined,
        nocodbTableName: group.nocodbTableName || undefined,
        invoiceColumnName: group.invoiceColumnName || 'invoice_reference',
        nocodbBlColumnName: group.nocodbBlColumnName || 'bl_number',
        nocodbAmountColumnName: group.nocodbAmountColumnName || 'amount',
        nocodbSupplierColumnName: group.nocodbSupplierColumnName || 'supplier'
      };
    } catch (error) {
      console.error('Erreur récupération config groupe:', error);
      return null;
    }
  }

  private async makeNocodbRequest(
    config: NocodbConfig,
    tableName: string,
    queryParams: Record<string, any>
  ): Promise<any> {
    try {
      const params = new URLSearchParams();
      
      // Construire les filtres NocoDB
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(`where`, `(${key},eq,${value})`);
        }
      });

      const url = `${config.baseUrl}/api/v1/db/data/${config.projectId}/${tableName}?${params.toString()}`;
      
      console.log('🔍 Requête NocoDB:', { url, table: tableName, filters: queryParams });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xc-auth': config.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Réponse NocoDB:', { count: data.list?.length || 0 });
      
      return data;
    } catch (error) {
      console.error('❌ Erreur requête NocoDB:', error);
      throw error;
    }
  }

  async verifyInvoiceReference(
    groupId: number,
    invoiceReference: string,
    supplierName: string
  ): Promise<{ found: boolean; supplierMatch: boolean; data?: any }> {
    try {
      console.log('🔍 Vérification facture:', { groupId, invoiceReference, supplierName });

      // Récupérer la configuration du groupe
      const groupConfig = await this.getGroupConfig(groupId);
      if (!groupConfig?.nocodbConfigId || !groupConfig?.nocodbTableName) {
        console.log('⚠️ Configuration NocoDB manquante pour le groupe', groupId);
        return { found: false, supplierMatch: false };
      }

      // Récupérer la configuration NocoDB
      const nocodbConfig = await this.getNocodbConfig(groupConfig.nocodbConfigId);
      if (!nocodbConfig || !nocodbConfig.isActive) {
        console.log('⚠️ Configuration NocoDB inactive ou manquante');
        return { found: false, supplierMatch: false };
      }

      // Effectuer la recherche
      const queryParams = {
        [groupConfig.invoiceColumnName!]: invoiceReference
      };

      const response = await this.makeNocodbRequest(
        nocodbConfig,
        groupConfig.nocodbTableName,
        queryParams
      );

      const records = response.list || response.rows || [];
      
      if (records.length === 0) {
        return { found: false, supplierMatch: false };
      }

      // Vérifier la correspondance du fournisseur
      const record = records[0];
      const recordSupplier = record[groupConfig.nocodbSupplierColumnName!];
      
      const supplierMatch = recordSupplier && 
        recordSupplier.toString().toLowerCase().includes(supplierName.toLowerCase());

      return {
        found: true,
        supplierMatch: !!supplierMatch,
        data: record
      };

    } catch (error) {
      console.error('❌ Erreur vérification facture:', error);
      return { found: false, supplierMatch: false };
    }
  }

  async searchByBLNumber(
    groupId: number,
    blNumber: string,
    supplierName: string
  ): Promise<{ found: boolean; invoiceReference?: string; invoiceAmount?: number; data?: any }> {
    try {
      console.log('🔍 Recherche par BL:', { groupId, blNumber, supplierName });

      // Récupérer la configuration du groupe
      const groupConfig = await this.getGroupConfig(groupId);
      if (!groupConfig?.nocodbConfigId || !groupConfig?.nocodbTableName) {
        console.log('⚠️ Configuration NocoDB manquante pour le groupe', groupId);
        return { found: false };
      }

      // Récupérer la configuration NocoDB
      const nocodbConfig = await this.getNocodbConfig(groupConfig.nocodbConfigId);
      if (!nocodbConfig || !nocodbConfig.isActive) {
        console.log('⚠️ Configuration NocoDB inactive ou manquante');
        return { found: false };
      }

      // Effectuer la recherche par BL
      const queryParams = {
        [groupConfig.nocodbBlColumnName!]: blNumber,
        [groupConfig.nocodbSupplierColumnName!]: supplierName
      };

      const response = await this.makeNocodbRequest(
        nocodbConfig,
        groupConfig.nocodbTableName,
        queryParams
      );

      const records = response.list || response.rows || [];
      
      if (records.length === 0) {
        return { found: false };
      }

      const record = records[0];
      const invoiceReference = record[groupConfig.invoiceColumnName!];
      const invoiceAmount = record[groupConfig.nocodbAmountColumnName!];

      return {
        found: true,
        invoiceReference: invoiceReference?.toString(),
        invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount.toString()) : undefined,
        data: record
      };

    } catch (error) {
      console.error('❌ Erreur recherche par BL:', error);
      return { found: false };
    }
  }
}

export const nocodbVerificationService = new NocodbVerificationService();