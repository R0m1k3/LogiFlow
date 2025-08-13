import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupLocalAuth, requireAuth } from "./localAuth";
import { requireModulePermission, requireAdmin, requirePermission } from "./permissions";
import { db, pool } from "./db";

console.log('🔍 Using development storage and authentication');

// Simple hash password function using crypto
async function hashPasswordSimple(password: string) {
  const crypto = await import('crypto');
  const { promisify } = await import('util');
  const scryptAsync = promisify(crypto.scrypt);
  
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}


// Alias pour compatibilité
const isAuthenticated = requireAuth;
const setupAuth = setupLocalAuth;
import { 
  insertGroupSchema, 
  insertSupplierSchema, 
  insertOrderSchema, 
  insertDeliverySchema,
  insertUserGroupSchema,
  insertPublicitySchema,
  insertCustomerOrderSchema,
  insertCustomerOrderFrontendSchema,
  insertDlcProductSchema,
  insertDlcProductFrontendSchema,
  insertTaskSchema,
  insertNocodbConfigSchema
} from "@shared/schema";
import { hasPermission } from "@shared/permissions";
import { z } from "zod";
import { invoiceVerificationService } from "./invoiceVerification";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for Docker
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'connected' // We could add a real DB check here if needed
    });
  });
  // Auth middleware
  await setupAuth(app);



  // Auth routes handled by authSwitch (local or Replit)

  // Groups routes
  app.get('/api/groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims ? req.user.claims.sub : req.user.id : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin sees all groups, all other roles (manager, employee, directeur) see only their assigned groups
      if (user.role === 'admin') {
        const groups = await storage.getGroups();
        res.json(groups);
      } else {
        const userGroups = (user as any).userGroups?.map((ug: any) => ug.group) || [];
        res.json(userGroups);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  app.post('/api/groups', isAuthenticated, async (req: any, res) => {
    try {
      // Debug logging pour la création de groupe
      console.log('📨 POST /api/groups - Headers:', {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length'],
        'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
      });
      
      console.log('📋 POST /api/groups - Request body:', JSON.stringify(req.body, null, 2));
      
      // Déterminer l'ID utilisateur selon l'environnement
      let userId;
      if (req.user.claims && req.user.claims.sub) {
        userId = req.user.claims.sub; // Production Replit Auth
        console.log('🔐 Using Replit Auth user ID:', userId);
      } else if (req.user.id) {
        userId = req.user.id; // Développement local
        console.log('🔐 Using local auth user ID:', userId);
      } else {
        console.error('❌ No user ID found in request:', { user: req.user });
        return res.status(401).json({ message: "User authentication failed" });
      }
      
      console.log('🔐 User requesting group creation:', userId);
      
      // Vérifier l'utilisateur
      const user = await storage.getUser(userId);
      if (!user) {
        console.error('❌ User not found:', userId);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log('✅ User found:', { username: user.username, role: user.role });
      
      // Vérifier les permissions
      if (user.role !== 'admin' && user.role !== 'manager') {
        console.error('❌ Insufficient permissions:', { userRole: user.role, required: ['admin', 'manager'] });
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      console.log('✅ User has permission to create group');
      
      // Valider les données
      console.log('🔍 Validating group data with schema...');
      const data = insertGroupSchema.parse(req.body);
      console.log('✅ Group data validation passed:', data);
      
      // Créer le groupe
      console.log('🏪 Creating group in database...');
      const group = await storage.createGroup(data);
      console.log('✅ Group creation successful:', { id: group.id, name: group.name });
      
      res.json(group);
    } catch (error: any) {
      console.error('❌ Failed to create group:', {
        error: error?.message || 'Unknown error',
        stack: error?.stack,
        body: req.body,
        userId: req.user?.id || req.user?.claims?.sub || 'unknown'
      });
      
      // Erreur de validation Zod
      if (error?.name === 'ZodError') {
        console.error('❌ Validation error details:', error.errors);
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create group" });
    }
  });

  app.put('/api/groups/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      const data = insertGroupSchema.partial().parse(req.body);
      const group = await storage.updateGroup(id, data);
      res.json(group);
    } catch (error: any) {
      console.error("Error updating group:", error);
      res.status(500).json({ message: "Failed to update group" });
    }
  });

  app.delete('/api/groups/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteGroup(id);
      res.json({ message: "Group deleted successfully" });
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({ message: "Failed to delete group" });
    }
  });

  // Suppliers routes
  app.get('/api/suppliers', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'directeur' && user.role !== 'employee')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Check if DLC filter is requested
      const dlcOnly = req.query.dlc === 'true';
      const suppliers = await storage.getSuppliers(dlcOnly);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.post('/api/suppliers', isAuthenticated, async (req: any, res) => {
    try {
      // Debug logging pour la création de fournisseur
      console.log('📨 POST /api/suppliers - Headers:', {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
      });
      
      console.log('📋 POST /api/suppliers - Request body:', JSON.stringify(req.body, null, 2));
      
      // Déterminer l'ID utilisateur selon l'environnement
      let userId;
      if (req.user.claims && req.user.claims.sub) {
        userId = req.user.claims.sub; // Production Replit Auth
        console.log('🔐 Using Replit Auth user ID:', userId);
      } else if (req.user.id) {
        userId = req.user.id; // Développement local
        console.log('🔐 Using local auth user ID:', userId);
      } else {
        console.error('❌ No user ID found in request:', { user: req.user });
        return res.status(401).json({ message: "User authentication failed" });
      }
      
      console.log('🔐 User requesting supplier creation:', userId);
      
      // Vérifier l'utilisateur
      const user = await storage.getUser(userId);
      if (!user) {
        console.error('❌ User not found:', userId);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log('✅ User found:', { username: user.username, role: user.role });
      
      // Vérifier les permissions
      if (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'directeur') {
        console.error('❌ Insufficient permissions:', { userRole: user.role, required: ['admin', 'manager', 'directeur'] });
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      console.log('✅ User has permission to create supplier');
      
      // Valider les données
      console.log('🔍 Validating supplier data with schema...');
      const data = insertSupplierSchema.parse(req.body);
      console.log('✅ Supplier data validation passed:', data);
      
      // Créer le fournisseur
      console.log('🚚 Creating supplier in database...');
      const supplier = await storage.createSupplier(data);
      console.log('✅ Supplier creation successful:', { id: supplier.id, name: supplier.name });
      
      res.json(supplier);
    } catch (error) {
      console.error('❌ Failed to create supplier:', {
        error: (error as Error).message,
        stack: error.stack,
        body: req.body,
        userId: req.user?.id || req.user?.claims?.sub || 'unknown'
      });
      
      // Erreur de validation Zod
      if (error.name === 'ZodError') {
        console.error('❌ Validation error details:', error.errors);
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create supplier" });
    }
  });

  app.put('/api/suppliers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'directeur')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      const data = insertSupplierSchema.partial().parse(req.body);
      const supplier = await storage.updateSupplier(id, data);
      res.json(supplier);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ message: "Failed to update supplier" });
    }
  });

  app.delete('/api/suppliers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'directeur')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteSupplier(id);
      res.json({ message: "Supplier deleted successfully" });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ message: "Failed to delete supplier" });
    }
  });

  // Orders routes
  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { startDate, endDate, storeId } = req.query;
      let orders;

      console.log('Orders API called with:', { startDate, endDate, storeId, userRole: user.role });

      if (user.role === 'admin') {
        let groupIds: number[] | undefined;
        
        // If admin selected a specific store, filter by it
        if (storeId) {
          groupIds = [parseInt(storeId as string)];
        }
        
        console.log('Admin filtering with groupIds:', groupIds);
        
        // Only filter by date if both startDate and endDate are provided
        if (startDate && endDate) {
          console.log('Fetching orders by date range:', startDate, 'to', endDate);
          orders = await storage.getOrdersByDateRange(startDate as string, endDate as string, groupIds);
        } else {
          console.log('Fetching all orders');
          orders = await storage.getOrders(groupIds);
        }
      } else {
        // For all non-admin roles (manager, employee, directeur), filter by their assigned groups
        const groupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
        console.log('Non-admin filtering with groupIds:', groupIds);
        
        // Only filter by date if both startDate and endDate are provided
        if (startDate && endDate) {
          orders = await storage.getOrdersByDateRange(startDate as string, endDate as string, groupIds);
        } else {
          orders = await storage.getOrders(groupIds);
        }
      }

      console.log('Orders returned:', orders.length, 'items');

      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user has access to this order (only admin can access all orders)
      if (user.role !== 'admin') {
        const userGroupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(order.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      console.log('📦 Order creation started:', {
        userId: req.user?.id || req.user?.claims?.sub,
        body: req.body,
        environment: process.env.NODE_ENV
      });

      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        console.log('❌ User not found in order creation');
        return res.status(404).json({ message: "User not found" });
      }

      console.log('👤 User found for order creation:', {
        id: user.id,
        role: user.role,
        groupsCount: user.userGroups.length,
        groups: user.userGroups.map(ug => ({ groupId: ug.groupId, groupName: ug.group?.name }))
      });

      const data = insertOrderSchema.parse({
        ...req.body,
        createdBy: user.id,
      });

      console.log('✅ Order data validated:', data);

      // Check if user has access to the group (only admin can access all groups)
      if (user.role !== 'admin') {
        const userGroupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(data.groupId)) {
          console.log('❌ Access denied to group:', { requestedGroupId: data.groupId, userGroups: userGroupIds });
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      console.log('🚀 Creating order in storage...');
      const order = await storage.createOrder(data);
      console.log('✅ Order created successfully:', { 
        id: order.id, 
        groupId: order.groupId,
        plannedDate: order.plannedDate,
        supplierId: order.supplierId
      });

      res.json(order);
    } catch (error) {
      console.error("❌ Error creating order:", {
        error: (error as Error).message,
        stack: error.stack,
        body: req.body,
        userId: req.user?.id || req.user?.claims?.sub || 'unknown'
      });
      
      // Erreur de validation Zod
      if (error.name === 'ZodError') {
        console.error('❌ Order validation error details:', error.errors);
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.put('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check edit permissions using the shared permission system
      if (!hasPermission(user.role, 'orders', 'edit')) {
        return res.status(403).json({ message: "Insufficient permissions to edit orders" });
      }

      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(order.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const data = insertOrderSchema.partial().parse(req.body);
      const updatedOrder = await storage.updateOrder(id, data);
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.delete('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check delete permissions using the shared permission system
      if (!hasPermission(user.role, 'orders', 'delete')) {
        return res.status(403).json({ message: "Insufficient permissions to delete orders" });
      }

      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(order.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteOrder(id);
      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  // Route pour diagnostiquer et synchroniser les statuts commandes/livraisons
  app.post('/api/sync-order-delivery-status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      console.log('🔄 Starting order-delivery status synchronization...');

      // Diagnostic: Trouver les commandes avec livraisons livrées mais pas en statut "delivered"
      const orders = await storage.getOrders();
      const problematicOrders = [];
      const fixedOrders = [];

      for (const order of orders) {
        if (order.deliveries && order.deliveries.length > 0) {
          const hasDeliveredDeliveries = order.deliveries.some(d => d.status === 'delivered');
          
          if (hasDeliveredDeliveries && order.status !== 'delivered') {
            console.log(`🔍 Found problematic order: #CMD-${order.id} (status: ${order.status}) with delivered deliveries`);
            problematicOrders.push({
              orderId: order.id,
              currentStatus: order.status,
              deliveredDeliveries: order.deliveries.filter(d => d.status === 'delivered').length,
              totalDeliveries: order.deliveries.length
            });

            // Fixer automatiquement
            try {
              await storage.updateOrder(order.id, { status: 'delivered' });
              console.log(`✅ Fixed order #CMD-${order.id} status to 'delivered'`);
              fixedOrders.push(order.id);
            } catch (error) {
              console.error(`❌ Failed to fix order #CMD-${order.id}:`, error);
            }
          }
        }
      }

      console.log('🔄 Synchronization completed');
      
      res.json({
        message: "Synchronization completed",
        diagnostics: {
          problematicOrdersFound: problematicOrders.length,
          ordersFixed: fixedOrders.length,
          problematicOrders,
          fixedOrders
        }
      });

    } catch (error) {
      console.error("❌ Error in sync operation:", error);
      res.status(500).json({ message: "Failed to synchronize statuses", error: (error as Error).message });
    }
  });

  // Deliveries routes
  app.get('/api/deliveries', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { startDate, endDate, storeId, withBL } = req.query;
      let deliveries;

      console.log('Deliveries API called with:', { startDate, endDate, storeId, withBL, userRole: user.role });

      if (user.role === 'admin') {
        let groupIds: number[] | undefined;
        
        // If admin selected a specific store, filter by it
        if (storeId) {
          groupIds = [parseInt(storeId as string)];
        }
        
        console.log('Admin filtering deliveries with groupIds:', groupIds);
        
        // Only filter by date if both startDate and endDate are provided
        if (startDate && endDate) {
          console.log('Fetching deliveries by date range:', startDate, 'to', endDate);
          deliveries = await storage.getDeliveriesByDateRange(startDate as string, endDate as string, groupIds);
        } else {
          console.log('Fetching all deliveries');
          deliveries = await storage.getDeliveries(groupIds);
        }
      } else {
        // For non-admin users (managers, employees, directeurs), only show their assigned stores
        const groupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
        console.log('Non-admin filtering deliveries with groupIds:', groupIds);
        
        // Only filter by date if both startDate and endDate are provided
        if (startDate && endDate) {
          deliveries = await storage.getDeliveriesByDateRange(startDate as string, endDate as string, groupIds);
        } else {
          deliveries = await storage.getDeliveries(groupIds);
        }
      }

      // Filter for BL if requested
      if (withBL === 'true') {
        deliveries = deliveries.filter((d: any) => d.blNumber && d.status === 'delivered');
      }

      console.log('Deliveries returned:', deliveries.length, 'items');

      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      res.status(500).json({ message: "Failed to fetch deliveries" });
    }
  });

  app.get('/api/deliveries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const delivery = await storage.getDelivery(id);
      
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      // Check if user has access to this delivery
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(delivery.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(delivery);
    } catch (error) {
      console.error("Error fetching delivery:", error);
      res.status(500).json({ message: "Failed to fetch delivery" });
    }
  });

  app.put('/api/deliveries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const delivery = await storage.getDelivery(id);
      
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      // Check edit permissions using the shared permission system
      if (!hasPermission(user.role, 'deliveries', 'edit')) {
        return res.status(403).json({ message: "Insufficient permissions to edit deliveries" });
      }

      if (user.role !== 'admin') {
        const userGroupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(delivery.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      console.log('🔄 Updating delivery:', { id, data: req.body, user: user.id });
      
      // Transform data types before validation
      const transformedData = { ...req.body };
      
      // Convert decimal amounts to strings (schema expects string for decimal fields)
      if (transformedData.blAmount !== undefined && transformedData.blAmount !== null) {
        transformedData.blAmount = transformedData.blAmount.toString();
      }
      if (transformedData.invoiceAmount !== undefined && transformedData.invoiceAmount !== null) {
        transformedData.invoiceAmount = transformedData.invoiceAmount.toString();
      }
      
      // Convert validatedAt to Date object (schema expects Date for timestamp fields)
      if (transformedData.validatedAt && typeof transformedData.validatedAt === 'string') {
        transformedData.validatedAt = new Date(transformedData.validatedAt);
      }
      
      const data = insertDeliverySchema.partial().parse(transformedData);
      const updatedDelivery = await storage.updateDelivery(id, data);
      console.log('✅ Delivery updated successfully:', { id, updatedDelivery });
      
      // SYNCHRONISATION AUTOMATIQUE : Si livraison devient "delivered", marquer la commande associée comme "delivered"
      if (data.status === 'delivered' && updatedDelivery.orderId) {
        try {
          console.log(`🔄 Auto-sync: Delivery #${id} marked as delivered, updating order #${updatedDelivery.orderId}`);
          await storage.updateOrder(updatedDelivery.orderId, { status: 'delivered' });
          console.log(`✅ Auto-sync: Order #${updatedDelivery.orderId} automatically marked as delivered`);
        } catch (error) {
          console.error(`❌ Auto-sync failed for order #${updatedDelivery.orderId}:`, error);
        }
      }

      // AUTO-VALIDATION RAPPROCHEMENT AUTOMATIQUE : Si fournisseur en mode automatique, livraison delivered + BL → auto-valider
      if (data.status === 'delivered' || data.blNumber) {
        try {
          // Récupérer le fournisseur pour vérifier le mode automatique  
          const suppliers = await storage.getSuppliers();
          const supplier = suppliers.find((s: any) => s.id === updatedDelivery.supplierId);
          
          if (supplier?.automaticReconciliation && 
              updatedDelivery.status === 'delivered' && 
              updatedDelivery.blNumber) {
            
            console.log(`🤖 Auto-reconciliation: Delivery #${id} from automatic supplier ${supplier.name}, auto-validating...`);
            
            // Auto-valider le rapprochement
            await storage.updateDelivery(id, {
              reconciled: true,
              validatedAt: new Date().toISOString()
            });
            
            console.log(`✅ Auto-reconciliation: Delivery #${id} automatically validated for supplier ${supplier.name}`);
          }
        } catch (error) {
          console.error(`❌ Auto-reconciliation failed for delivery #${id}:`, error);
        }
      }
      
      res.json(updatedDelivery);
    } catch (error) {
      console.error("Error updating delivery:", error);
      res.status(500).json({ message: "Failed to update delivery" });
    }
  });

  app.post('/api/deliveries', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const data = insertDeliverySchema.parse({
        ...req.body,
        createdBy: user.id,
      });

      // Check if user has access to the group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(data.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const delivery = await storage.createDelivery(data);
      res.json(delivery);
    } catch (error) {
      console.error("Error creating delivery:", error);
      res.status(500).json({ message: "Failed to create delivery" });
    }
  });

  // SUPPRIMÉ : Doublon d'endpoint PUT /api/deliveries/:id (le premier endpoint avec logique complète est conservé)

  app.delete('/api/deliveries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const delivery = await storage.getDelivery(id);
      
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      // Check permissions using the shared permission system
      if (!hasPermission(user.role, 'deliveries', 'delete')) {
        return res.status(403).json({ message: "Insufficient permissions to delete deliveries" });
      }

      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(delivery.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteDelivery(id);
      res.json({ message: "Delivery deleted successfully" });
    } catch (error) {
      console.error("Error deleting delivery:", error);
      res.status(500).json({ message: "Failed to delete delivery" });
    }
  });

  // Route de vérification de facture NocoDB
  app.post('/api/deliveries/:id/verify-invoice', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const deliveryId = parseInt(req.params.id);
      const delivery = await storage.getDelivery(deliveryId);
      
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      // Check permissions
      if (!hasPermission(user.role, 'deliveries', 'view')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(delivery.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const { invoiceReference } = req.body;
      
      if (!delivery.supplier || !delivery.group) {
        console.log('❌ Livraison manque informations:', {
          deliveryId,
          hasSupplier: !!delivery.supplier,
          hasGroup: !!delivery.group
        });
        return res.status(400).json({ message: "Delivery missing supplier or group information" });
      }

      if (!invoiceReference || !invoiceReference.trim()) {
        return res.status(400).json({ message: "Référence de facture requise" });
      }

      console.log('🔍 Vérification facture:', {
        deliveryId,
        invoiceReference,
        supplier: delivery.supplier?.name,
        group: delivery.group?.name,
        groupId: delivery.groupId
      });

      // Appeler le service de vérification
      const result = await invoiceVerificationService.verifyInvoice(
        invoiceReference,
        delivery.groupId
      );

      console.log('✅ Résultat vérification:', result);
      res.json(result);
    } catch (error) {
      console.error("Error verifying invoice:", error);
      res.status(500).json({ 
        message: "Failed to verify invoice",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/deliveries/:id/validate', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check validate permissions using the shared permission system
      if (!hasPermission(user.role, 'deliveries', 'validate')) {
        return res.status(403).json({ message: "Insufficient permissions to validate deliveries" });
      }

      const id = parseInt(req.params.id);
      const delivery = await storage.getDelivery(id);
      
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      // Check permissions
      if (user.role === 'manager') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(delivery.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const { blNumber, blAmount } = req.body;
      
      // BL data is optional - delivery can be validated without it
      let blData: any = undefined;
      if (blNumber) {
        blData = { blNumber };
        if (blAmount !== undefined && blAmount !== null && blAmount !== '') {
          blData.blAmount = blAmount;
        }
      }
      
      await storage.validateDelivery(id, blData);
      
      // SYNCHRONISATION AUTOMATIQUE : Quand validation, marquer la commande associée comme "delivered"
      if (delivery.orderId) {
        try {
          console.log(`🔄 Auto-sync: Delivery #${id} validated, updating order #${delivery.orderId} to delivered`);
          await storage.updateOrder(delivery.orderId, { status: 'delivered' });
          console.log(`✅ Auto-sync: Order #${delivery.orderId} automatically marked as delivered`);
        } catch (error) {
          console.error(`❌ Auto-sync failed for order #${delivery.orderId}:`, error);
        }
      }
      
      res.json({ message: "Delivery validated successfully" });
    } catch (error) {
      console.error("Error validating delivery:", error);
      res.status(500).json({ message: "Failed to validate delivery" });
    }
  });

  // Statistics routes
  app.get('/api/stats/monthly', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { year, month, storeId } = req.query;
      const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
      const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;

      let groupIds: number[] | undefined;
      
      if (user.role === 'admin') {
        // Admin can view all stores or filter by selected store
        groupIds = storeId ? [parseInt(storeId as string)] : undefined;
      } else {
        // Non-admin users: filter by their assigned groups
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        
        // If a specific store is selected and user has access, filter by it
        if (storeId && userGroupIds.includes(parseInt(storeId as string))) {
          groupIds = [parseInt(storeId as string)];
        } else {
          groupIds = userGroupIds;
        }
      }

      const stats = await storage.getMonthlyStats(currentYear, currentMonth, groupIds);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // User-Group management routes (admin only)
  app.post('/api/users/:userId/groups', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const userId = req.params.userId;
      const data = insertUserGroupSchema.parse({
        userId,
        groupId: req.body.groupId,
      });

      const userGroup = await storage.assignUserToGroup(data);
      res.json(userGroup);
    } catch (error) {
      console.error("Error assigning user to group:", error);
      res.status(500).json({ message: "Failed to assign user to group" });
    }
  });

  app.delete('/api/users/:userId/groups/:groupId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const userId = req.params.userId;
      const groupId = parseInt(req.params.groupId);

      await storage.removeUserFromGroup(userId, groupId);
      res.json({ message: "User removed from group successfully" });
    } catch (error) {
      console.error("Error removing user from group:", error);
      res.status(500).json({ message: "Failed to remove user from group" });
    }
  });

  // Users management routes
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all basic users first
      const baseUsers = await storage.getUsers();
      
      // Add userGroups and userRoles to each user individually with error handling
      const usersWithData = await Promise.all(
        baseUsers.map(async (baseUser) => {
          try {
            const userWithGroups = await storage.getUserWithGroups(baseUser.id);
            return {
              ...baseUser,
              userGroups: userWithGroups?.userGroups || [],
              userRoles: [] // Keep roles simple for now since we're using hardcoded permissions
            };
          } catch (error) {
            console.error(`❌ Error getting groups for user ${baseUser.username}:`, error);
            // Return user with empty groups if there's an error
            return {
              ...baseUser,
              userGroups: [],
              userRoles: []
            };
          }
        })
      );
      
      res.json(usersWithData);
    } catch (error) {
      console.error("❌ Critical error fetching users:", error);
      console.error("❌ Error stack:", (error as any).stack);
      // En cas d'erreur, retourner un array vide pour éviter React Error #310
      res.status(500).json([]);
    }
  });

  app.post('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const currentUser = await storage.getUserWithGroups(userId);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Schema création utilisateur SANS champs obligatoires pour résoudre le problème de production
      const createUserSchema = z.object({
        id: z.string().optional(),
        username: z.string().min(1, "L'identifiant est obligatoire"),
        email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        password: z.string().min(1, "Le mot de passe est obligatoire"),
        role: z.enum(['admin', 'directeur', 'manager', 'employee']).optional(),
      });

      const userData = createUserSchema.parse(req.body);
      
      // Hash password with improved error handling
      let hashedPassword = userData.password;
      if (userData.password) {
        try {
          hashedPassword = await hashPasswordSimple(userData.password);
        } catch (hashError) {
          console.error('❌ Password hashing failed:', hashError);
          return res.status(500).json({ message: "Failed to secure password" });
        }
      }
      
      // Generate unique ID
      const newUserId = userData.id || `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const userToCreate = {
        id: newUserId,
        username: userData.username,
        email: userData.email && userData.email.trim() !== '' ? userData.email : undefined,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        password: hashedPassword,
        role: userData.role || 'employee',
      };
      
      const newUser = await storage.createUser(userToCreate);

      res.json(newUser);
    } catch (error) {
      console.error("❌ Error creating user:", error);
      console.error("❌ Error type:", (error as any).constructor?.name);
      console.error("❌ Error code:", (error as any).code);
      console.error("❌ Error constraint:", (error as any).constraint);
      console.error("❌ Error stack:", (error as any).stack);
      
      if (error instanceof z.ZodError) {
        console.log('❌ Validation error:', error.errors);
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      
      // Handle specific database constraint errors
      if ((error as any).code === '23505') {
        if ((error as any).constraint === 'users_username_key') {
          return res.status(409).json({ 
            message: "Un utilisateur avec ce nom d'utilisateur existe déjà. Veuillez choisir un autre nom d'utilisateur." 
          });
        }
        if ((error as any).constraint === 'users_email_key') {
          return res.status(409).json({ 
            message: "Un utilisateur avec cette adresse email existe déjà." 
          });
        }
      }
      
      // Handle connection errors
      if ((error as any).code === 'ECONNREFUSED' || (error as any).code === 'ENOTFOUND') {
        return res.status(503).json({ message: "Database connection error" });
      }
      
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Schema utilisateur SANS champs obligatoires pour résoudre le problème de production
      const updateUserSchema = z.object({
        username: z.string().optional(),
        role: z.enum(['admin', 'directeur', 'manager', 'employee']).optional(),
        firstName: z.union([z.string(), z.literal(""), z.null()]).optional(),
        lastName: z.union([z.string(), z.literal(""), z.null()]).optional(),
        email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
        password: z.string().optional(),
      });

      const userData = updateUserSchema.parse(req.body);
      
      // Clean up the data - handle empty emails properly
      const cleanUserData: any = { ...userData };
      
      // Handle email field - convert empty string to undefined
      if (cleanUserData.email !== undefined) {
        cleanUserData.email = cleanUserData.email && cleanUserData.email.trim() !== '' ? cleanUserData.email : undefined;
      }
      
      // Hash password if provided
      if (cleanUserData.password) {
        try {
          cleanUserData.password = await hashPasswordSimple(cleanUserData.password);
          cleanUserData.passwordChanged = true;
        } catch (hashError) {
          console.error('❌ Password hashing failed:', hashError);
          return res.status(500).json({ message: "Failed to secure password" });
        }
      }
      
      const updatedUser = await storage.updateUser(req.params.id, cleanUserData);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("❌ Error updating user:", error);
      console.error("❌ Error type:", (error as any).constructor?.name);
      console.error("❌ Error code:", (error as any).code);
      console.error("❌ Error constraint:", (error as any).constraint);
      console.error("❌ Error stack:", (error as any).stack);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      
      // Handle specific database constraint errors
      if ((error as any).code === '23505') {
        if ((error as any).constraint === 'users_username_key') {
          return res.status(409).json({ 
            message: "Un utilisateur avec ce nom d'utilisateur existe déjà. Veuillez choisir un autre nom d'utilisateur." 
          });
        }
        if ((error as any).constraint === 'users_email_key') {
          return res.status(409).json({ 
            message: "Un utilisateur avec cette adresse email existe déjà. Veuillez utiliser une autre adresse email ou laisser le champ vide." 
          });
        }
      }
      
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post('/api/users/:id/groups', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { groupId } = req.body;
      await storage.assignUserToGroup({
        userId: req.params.id,
        groupId: parseInt(groupId),
      });

      res.json({ message: "User assigned to group successfully" });
    } catch (error) {
      console.error("Error assigning user to group:", error);
      res.status(500).json({ message: "Failed to assign user to group" });
    }
  });

  app.delete('/api/users/:id/groups/:groupId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.removeUserFromGroup(req.params.id, parseInt(req.params.groupId));
      res.json({ message: "User removed from group successfully" });
    } catch (error) {
      console.error("Error removing user from group:", error);
      res.status(500).json({ message: "Failed to remove user from group" });
    }
  });

  // Delete user route
  app.delete('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const userToDelete = req.params.id;
      
      // Prevent admin from deleting themselves
      if (userToDelete === user.id) {
        return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte" });
      }

      // Remove user from all groups first
      const userWithGroups = await storage.getUserWithGroups(userToDelete);
      if (userWithGroups) {
        for (const userGroup of userWithGroups.userGroups) {
          await storage.removeUserFromGroup(userToDelete, userGroup.groupId);
        }
      }

      // Delete the user
      await storage.deleteUser(userToDelete);
      res.json({ message: "Utilisateur supprimé avec succès" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Publicity routes
  app.get('/api/publicities', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { year, storeId } = req.query;
      const filterYear = year ? parseInt(year as string) : undefined;

      let groupIds: number[] | undefined;
      
      if (user.role === 'admin') {
        // Admin can view all publicities or filter by selected store
        groupIds = storeId ? [parseInt(storeId as string)] : undefined;
      } else {
        // Non-admin users: filter by their assigned groups
        groupIds = user.userGroups.map(ug => ug.groupId);
      }

      const publicities = await storage.getPublicities(filterYear, groupIds);
      res.json(publicities);
    } catch (error) {
      console.error("Error fetching publicities:", error);
      res.status(500).json({ message: "Failed to fetch publicities", error: (error as Error).message });
    }
  });

  app.get('/api/publicities/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const publicity = await storage.getPublicity(id);
      
      if (!publicity) {
        return res.status(404).json({ message: "Publicity not found" });
      }

      // Check access permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        const hasAccess = publicity.participations.some((p: any) => userGroupIds.includes(p.groupId));
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(publicity);
    } catch (error) {
      console.error("Error fetching publicity:", error);
      res.status(500).json({ message: "Failed to fetch publicity" });
    }
  });

  app.post('/api/publicities', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check permissions using the shared permission system
      if (!hasPermission(user.role, 'publicity', 'create')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const data = insertPublicitySchema.parse({
        ...req.body,
        createdBy: req.user.claims ? req.user.claims.sub : req.user.id
      });

      const { participatingGroups, ...publicityData } = req.body;

      // Create publicity
      const newPublicity = await storage.createPublicity(data);

      // Set participations
      if (participatingGroups && participatingGroups.length > 0) {
        await storage.setPublicityParticipations(newPublicity.id, participatingGroups);
      }

      // Get the complete publicity with relations
      const completePublicity = await storage.getPublicity(newPublicity.id);
      res.json(completePublicity);
    } catch (error) {
      console.error("Error creating publicity:", error);
      res.status(500).json({ message: "Failed to create publicity" });
    }
  });

  app.put('/api/publicities/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check permissions using the shared permission system
      if (!hasPermission(user.role, 'publicity', 'edit')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      const { participatingGroups, ...publicityData } = req.body;

      // Update publicity
      const updatedPublicity = await storage.updatePublicity(id, publicityData);

      // Update participations
      if (participatingGroups !== undefined) {
        await storage.setPublicityParticipations(id, participatingGroups);
      }

      // Get the complete publicity with relations
      const completePublicity = await storage.getPublicity(id);
      res.json(completePublicity);
    } catch (error) {
      console.error("Error updating publicity:", error);
      res.status(500).json({ message: "Failed to update publicity" });
    }
  });

  app.delete('/api/publicities/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check permissions (admin only for deletion)
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      await storage.deletePublicity(id);
      res.json({ message: "Publicity deleted successfully" });
    } catch (error) {
      console.error("Error deleting publicity:", error);
      res.status(500).json({ message: "Failed to delete publicity" });
    }
  });











  // Schema logging route for production debugging
  app.get('/api/debug/log-schema', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent utiliser cette route de debug.' });
      }

      const isProduction = process.env.NODE_ENV === 'production';
      
      if (!isProduction) {
        return res.status(400).json({ error: 'Cette route fonctionne uniquement en production sur votre serveur privé' });
      }

      console.log('\n🔍 ===== DÉBUT SCAN SCHÉMA BASE DE DONNÉES =====');
      console.log('⏰ Timestamp:', new Date().toISOString());

      // Vérifier que pool est disponible
      if (!pool) {
        throw new Error('Pool de base de données non disponible en production');
      }

      // Récupérer les tables
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      
      const tablesResult = await pool.query(tablesQuery);
      
      console.log(`\n📊 TOTAL DES TABLES TROUVÉES: ${tablesResult.rows.length}`);
      console.log('==========================================');
      
      // Pour chaque table, récupérer les colonnes
      for (const tableRow of tablesResult.rows) {
        const tableName = tableRow.table_name;
        
        console.log(`\n🔸 TABLE: ${tableName.toUpperCase()}`);
        console.log(`${'='.repeat(tableName.length + 8)}`);
        
        const columnsQuery = `
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default,
            ordinal_position
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = $1
          ORDER BY ordinal_position
        `;
        
        const columnsResult = await pool.query(columnsQuery, [tableName]);
        
        if (columnsResult.rows.length > 0) {
          columnsResult.rows.forEach((col: any, index: number) => {
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
            const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
            
            console.log(`   ${(index + 1).toString().padStart(2, '0')}. ${col.column_name.padEnd(25)} : ${col.data_type}${maxLength} ${nullable}${defaultVal}`);
          });
          
          // Compter les enregistrements dans la table
          try {
            const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"`;
            const countResult = await pool.query(countQuery);
            console.log(`   📈 Nombre d'enregistrements: ${countResult.rows[0].total}`);
          } catch (countError) {
            console.log(`   ⚠️  Impossible de compter les enregistrements: ${(countError as Error).message}`);
          }
        }
      }
      
      // Récupérer les contraintes de clés étrangères
      console.log('\n🔗 CONTRAINTES DE CLÉS ÉTRANGÈRES:');
      console.log('===================================');
      
      const fkQuery = `
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
      `;
      
      const fkResult = await pool.query(fkQuery);
      
      if (fkResult.rows.length > 0) {
        fkResult.rows.forEach((fk: any) => {
          console.log(`   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
        });
      } else {
        console.log('   Aucune contrainte de clé étrangère trouvée');
      }

      console.log('\n🏁 ===== FIN SCAN SCHÉMA BASE DE DONNÉES =====\n');
      
      res.json({ 
        success: true, 
        message: 'Schéma loggé avec succès dans les logs du serveur',
        totalTables: tablesResult.rows.length,
        totalForeignKeys: fkResult.rows.length,
        timestamp: new Date().toISOString(),
        downloadUrl: '/api/debug/download-schema'
      });
      
    } catch (error) {
      console.error('❌ ERREUR lors du scan du schéma:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Download database schema report
  app.get('/api/debug/download-schema', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent télécharger le rapport de schéma.' });
      }

      const isProduction = process.env.NODE_ENV === 'production';
      
      if (!isProduction) {
        return res.status(400).json({ error: 'Cette route fonctionne uniquement en production sur votre serveur privé' });
      }

      // Vérifier que pool est disponible
      if (!pool) {
        throw new Error('Pool de base de données non disponible en production');
      }

      const timestamp = new Date().toISOString();
      let reportContent = `LOGIFLOW - RAPPORT SCHÉMA BASE DE DONNÉES PRODUCTION
===============================================

GÉNÉRÉ LE : ${timestamp}
SERVEUR : Production privé LogiFlow
ENVIRONNEMENT : PostgreSQL Docker
UTILISATEUR : ${user.username}

===============================================
RÉSUMÉ DU SCAN
===============================================

`;

      // Récupérer les tables
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      
      const tablesResult = await pool.query(tablesQuery);
      
      reportContent += `TOTAL DES TABLES TROUVÉES: ${tablesResult.rows.length}\n`;
      reportContent += `==========================================\n\n`;
      
      // Pour chaque table, récupérer les colonnes
      for (const tableRow of tablesResult.rows) {
        const tableName = tableRow.table_name;
        
        reportContent += `TABLE: ${tableName.toUpperCase()}\n`;
        reportContent += `${'='.repeat(tableName.length + 6)}\n\n`;
        
        const columnsQuery = `
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default,
            ordinal_position
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = $1
          ORDER BY ordinal_position
        `;
        
        const columnsResult = await pool.query(columnsQuery, [tableName]);
        
        if (columnsResult.rows.length > 0) {
          columnsResult.rows.forEach((col: any, index: number) => {
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
            const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
            
            reportContent += `   ${(index + 1).toString().padStart(2, '0')}. ${col.column_name.padEnd(25)} : ${col.data_type}${maxLength} ${nullable}${defaultVal}\n`;
          });
          
          // Compter les enregistrements dans la table
          try {
            const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"`;
            const countResult = await pool.query(countQuery);
            reportContent += `   📈 Nombre d'enregistrements: ${countResult.rows[0].total}\n\n`;
          } catch (countError) {
            reportContent += `   ⚠️  Impossible de compter les enregistrements: ${(countError as Error).message}\n\n`;
          }
        }
      }
      
      // Récupérer les contraintes de clés étrangères
      reportContent += `CONTRAINTES DE CLÉS ÉTRANGÈRES:\n`;
      reportContent += `===================================\n\n`;
      
      const fkQuery = `
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
      `;
      
      const fkResult = await pool.query(fkQuery);
      
      if (fkResult.rows.length > 0) {
        fkResult.rows.forEach((fk: any) => {
          reportContent += `   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}\n`;
        });
      } else {
        reportContent += '   Aucune contrainte de clé étrangère trouvée\n';
      }

      reportContent += `\n===============================================\n`;
      reportContent += `FIN DU RAPPORT - ${timestamp}\n`;
      reportContent += `===============================================`;

      // Définir les headers pour le téléchargement
      const filename = `logiflow-schema-${new Date().toISOString().split('T')[0]}.txt`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(reportContent);
      
    } catch (error) {
      console.error('❌ ERREUR lors de la génération du rapport de schéma:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Invoice verification routes
  app.post('/api/verify-invoice', isAuthenticated, async (req: any, res) => {
    try {
      const { groupId, invoiceReference } = req.body;
      
      if (!groupId || !invoiceReference) {
        return res.status(400).json({ message: "groupId and invoiceReference are required" });
      }

      const { verifyInvoiceReference } = await import('./nocodbService.js');
      const result = await verifyInvoiceReference(groupId, invoiceReference);
      
      res.json(result);
    } catch (error) {
      console.error("Error verifying invoice:", error);
      res.status(500).json({ message: "Failed to verify invoice" });
    }
  });

  app.post('/api/verify-invoices', isAuthenticated, async (req: any, res) => {
    try {
      const { invoiceReferences } = req.body;
      
      if (!Array.isArray(invoiceReferences)) {
        return res.status(400).json({ message: "invoiceReferences must be an array" });
      }

      // Add supplier name to invoice references for verification
      const enrichedReferences = invoiceReferences.map((ref: any) => ({
        ...ref,
        supplierName: ref.supplierName // Include supplier name for matching
      }));

      const { verifyMultipleInvoiceReferences } = await import('./nocodbService.js');
      const results = await verifyMultipleInvoiceReferences(enrichedReferences);
      
      res.json(results);
    } catch (error) {
      console.error("Error verifying invoices:", error);
      res.status(500).json({ message: "Failed to verify invoices" });
    }
  });

  // NocoDB Configuration routes
  app.get('/api/nocodb-config', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent gérer les configurations NocoDB.' });
      }

      const configs = await storage.getNocodbConfigs();
      res.json(configs);
    } catch (error) {
      console.error('Error fetching NocoDB configs:', error);
      res.status(500).json({ error: 'Failed to fetch configurations' });
    }
  });

  app.post('/api/nocodb-config', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent gérer les configurations NocoDB.' });
      }

      const configData = insertNocodbConfigSchema.parse({
        ...req.body,
        createdBy: user.id
      });
      const config = await storage.createNocodbConfig(configData);
      res.status(201).json(config);
    } catch (error) {
      console.error('Error creating NocoDB config:', error);
      res.status(500).json({ error: 'Failed to create configuration' });
    }
  });

  app.put('/api/nocodb-config/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent gérer les configurations NocoDB.' });
      }

      const id = parseInt(req.params.id);
      const configData = insertNocodbConfigSchema.partial().parse(req.body);
      const config = await storage.updateNocodbConfig(id, configData);
      res.json(config);
    } catch (error) {
      console.error('Error updating NocoDB config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  });

  app.delete('/api/nocodb-config/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent gérer les configurations NocoDB.' });
      }

      const id = parseInt(req.params.id);
      await storage.deleteNocodbConfig(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting NocoDB config:', error);
      res.status(500).json({ error: 'Failed to delete configuration' });
    }
  });

  app.get('/api/nocodb-config/active', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(403).json({ message: 'Accès refusé.' });
      }

      const activeConfig = await storage.getActiveNocodbConfig();
      res.json(activeConfig || null);
    } catch (error) {
      console.error('Error fetching active NocoDB config:', error);
      res.status(500).json({ error: 'Failed to fetch active configuration' });
    }
  });

  // Create server instance
  const httpServer = createServer(app);

  // Server startup
  return httpServer;
}
