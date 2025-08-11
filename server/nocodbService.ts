// Service for interacting with NocoDB
import { storage } from "./storage";

export interface InvoiceVerificationResult {
  exists: boolean;
  error?: string;
}

export async function verifyInvoiceReference(
  groupId: number, 
  invoiceReference: string,
  supplierName?: string
): Promise<InvoiceVerificationResult> {
  try {
    // Get group with NocoDB configuration
    const group = await storage.getGroup(groupId);
    
    if (!group || !group.nocodbConfigId || !group.nocodbTableId) {
      return { exists: false, error: "No NocoDB configuration for this group" };
    }

    // Get NocoDB configuration
    const nocodbConfig = await storage.getNocodbConfig(group.nocodbConfigId);
    
    if (!nocodbConfig) {
      return { exists: false, error: "NocoDB configuration not found" };
    }

    const columnName = group.invoiceColumnName || "Ref Facture";
    
    // Normalize search term (case insensitive)
    const normalizedInvoiceRef = invoiceReference.trim().toLowerCase();
    
    // Make request to NocoDB API to get all records and filter them case-insensitively
    // URL format: {baseUrl}/api/v1/db/data/noco/{projectId}/{tableId}
    const url = `${nocodbConfig.baseUrl}/api/v1/db/data/noco/${nocodbConfig.projectId}/${group.nocodbTableId}`;
    
    console.log(`🔍 NocoDB API Request for ${invoiceReference} (supplier: ${supplierName || 'any'}):`, {
      url,
      columnName,
      groupId,
      projectId: nocodbConfig.projectId,
      tableId: group.nocodbTableId,
      normalizedSearch: normalizedInvoiceRef
    });
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "xc-token": nocodbConfig.apiToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return { exists: false, error: `NocoDB API error: ${response.status}` };
    }

    const data = await response.json();
    
    console.log(`📋 NocoDB Response:`, {
      totalRows: data.pageInfo?.totalRows || 0,
      returnedRows: data.list?.length || 0,
      columnName,
      searchValue: invoiceReference.trim()
    });
    
    // Filter results case-insensitively for invoice reference
    let matchingRecords = [];
    if (data.list && data.list.length > 0) {
      matchingRecords = data.list.filter((record: any) => {
        const recordInvoiceRef = record[columnName];
        if (!recordInvoiceRef) return false;
        
        // Case-insensitive comparison for invoice reference
        const normalizedRecordRef = recordInvoiceRef.toString().toLowerCase();
        const invoiceMatches = normalizedRecordRef === normalizedInvoiceRef;
        
        // If supplier name is provided, also check supplier match (case-insensitive)
        if (invoiceMatches && supplierName) {
          const supplierColumn = record['Fournisseur'] || record['Supplier'] || record['fournisseur'] || record['supplier'];
          if (supplierColumn) {
            const normalizedRecordSupplier = supplierColumn.toString().toLowerCase();
            const normalizedSearchSupplier = supplierName.toLowerCase();
            const supplierMatches = normalizedRecordSupplier.includes(normalizedSearchSupplier) || 
                                   normalizedSearchSupplier.includes(normalizedRecordSupplier);
            
            console.log(`🏢 Supplier check:`, {
              recordSupplier: supplierColumn,
              searchSupplier: supplierName,
              matches: supplierMatches
            });
            
            return supplierMatches;
          }
        }
        
        return invoiceMatches;
      });
    }
    
    const exists = matchingRecords.length > 0;
    
    if (exists) {
      console.log(`✅ Found matching invoice:`, { 
        found: matchingRecords[0][columnName], 
        searchValue: invoiceReference.trim(),
        totalMatches: matchingRecords.length,
        supplierMatch: supplierName ? 'verified' : 'not checked'
      });
    } else {
      console.log(`❌ No matching invoice found for: ${invoiceReference}${supplierName ? ` (supplier: ${supplierName})` : ''}`);
    }

    console.log(`🔍 Search result for ${invoiceReference}:`, { exists });
    return { exists };
    
  } catch (error) {
    console.error("Error verifying invoice reference:", error);
    return { exists: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Bulk verify multiple invoice references
export async function verifyMultipleInvoiceReferences(
  invoiceReferences: { groupId: number; invoiceReference: string; deliveryId: number; supplierName?: string }[]
): Promise<Record<number, InvoiceVerificationResult>> {
  const results: Record<number, InvoiceVerificationResult> = {};
  
  // Process in parallel for better performance
  const promises = invoiceReferences.map(async ({ groupId, invoiceReference, deliveryId, supplierName }) => {
    const result = await verifyInvoiceReference(groupId, invoiceReference, supplierName);
    results[deliveryId] = result;
  });
  
  await Promise.all(promises);
  
  return results;
}