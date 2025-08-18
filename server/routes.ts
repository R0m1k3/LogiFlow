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
  insertAnnouncementSchema,
  insertNocodbConfigSchema,
  insertSavTicketSchema,
  insertSavTicketHistorySchema,
  insertWeatherDataSchema,
  insertWeatherSettingsSchema,
  users, groups, userGroups, suppliers, orders, deliveries, publicities, publicityParticipations,
  customerOrders, nocodbConfigs, dlcProducts, tasks, invoiceVerifications, dashboardMessages
} from "@shared/schema";
import { hasPermission } from "@shared/permissions";
import { z } from "zod";
import { eq, desc, or, isNull } from "drizzle-orm";
import { invoiceVerificationService } from "./invoiceVerification";
import { backupService } from "./backupService";
import { weatherService } from "./weatherService.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Detect environment
  const environment = process.env.NODE_ENV || 'development';
  console.log('🌍 Environment detected:', environment);

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
      const suppliers = await storage.getSuppliers();
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
    } catch (error: any) {
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
    } catch (error: any) {
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
        // Get deliveries for this order separately since OrderWithRelations doesn't include deliveries
        const deliveries = await storage.getDeliveries();
        const orderDeliveries = deliveries.filter(d => d.orderId === order.id);
        
        if (orderDeliveries && orderDeliveries.length > 0) {
          const hasDeliveredDeliveries = orderDeliveries.some((d: any) => d.status === 'delivered');
          
          if (hasDeliveredDeliveries && order.status !== 'delivered') {
            console.log(`🔍 Found problematic order: #CMD-${order.id} (status: ${order.status}) with delivered deliveries`);
            problematicOrders.push({
              orderId: order.id,
              currentStatus: order.status,
              deliveredDeliveries: orderDeliveries.filter((d: any) => d.status === 'delivered').length,
              totalDeliveries: orderDeliveries.length
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
      // MAIS seulement après validation explicite (pas juste mise à jour status)
      // Cette sync sera gérée dans validateDelivery endpoint uniquement

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
              validatedAt: new Date()
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

      console.log('🚛 Creating delivery with data:', req.body);

      // Traiter les données pour orderId - "none" devient null
      const processedBody = { ...req.body };
      if (processedBody.orderId === "none" || processedBody.orderId === "") {
        processedBody.orderId = null;
      } else if (processedBody.orderId) {
        processedBody.orderId = parseInt(processedBody.orderId);
      }

      const data = insertDeliverySchema.parse({
        ...processedBody,
        createdBy: user.id,
      });

      console.log('🚛 Processed delivery data:', data);

      // Check if user has access to the group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(data.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const delivery = await storage.createDelivery(data);
      
      // Log de liaison avec commande
      if (data.orderId) {
        console.log(`🔗 Delivery #${delivery.id} linked to order #${data.orderId}`);
      } else {
        console.log(`🚛 Delivery #${delivery.id} created without order link`);
      }
      
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

      const { invoiceReference, blNumber, forceRefresh } = req.body;
      
      if (!delivery.supplier || !delivery.group) {
        console.log('❌ Livraison manque informations:', {
          deliveryId,
          hasSupplier: !!delivery.supplier,
          hasGroup: !!delivery.group
        });
        return res.status(400).json({ message: "Delivery missing supplier or group information" });
      }

      // Accepter soit une référence de facture soit un numéro de BL
      if ((!invoiceReference || !invoiceReference.trim()) && (!blNumber || !blNumber.trim())) {
        return res.status(400).json({ message: "Référence de facture ou numéro BL requis" });
      }

      console.log('🔍 Vérification facture:', {
        deliveryId,
        invoiceReference,
        blNumber,
        supplier: delivery.supplier?.name,
        group: delivery.group?.name,
        groupId: delivery.groupId
      });

      let result;
      
      if (invoiceReference && invoiceReference.trim()) {
        // Vérifier par référence de facture
        result = await invoiceVerificationService.verifyInvoice(
          invoiceReference,
          delivery.groupId,
          forceRefresh || false
        );
      } else if (blNumber && blNumber.trim()) {
        // Vérifier par numéro BL
        result = await invoiceVerificationService.verifyInvoiceByBL(
          blNumber,
          delivery.supplier.name,
          delivery.groupId,
          forceRefresh || false
        );
      } else {
        result = {
          exists: false,
          matchType: 'none',
          errorMessage: 'Aucune référence de facture ou numéro BL fourni'
        };
      }

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

  // DLC Products routes
  app.get('/api/dlc-products', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { storeId, status, supplierId, search } = req.query;
      let groupIds: number[] | undefined;
      
      if (user.role === 'admin') {
        groupIds = storeId ? [parseInt(storeId as string)] : undefined;
      } else {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (storeId && userGroupIds.includes(parseInt(storeId as string))) {
          groupIds = [parseInt(storeId as string)];
        } else {
          groupIds = userGroupIds;
        }
      }

      const filters: any = {};
      if (status && status !== 'all') filters.status = status as string;
      if (supplierId && supplierId !== 'all') filters.supplierId = parseInt(supplierId as string);
      if (search) filters.search = search as string;

      const dlcProducts = await storage.getDlcProducts(groupIds, filters);
      res.json(dlcProducts);
    } catch (error) {
      console.error("Error fetching DLC products:", error);
      res.status(500).json([]);
    }
  });

  app.get('/api/dlc-products/stats', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { storeId } = req.query;
      let groupIds: number[] | undefined;
      
      if (user.role === 'admin') {
        groupIds = storeId ? [parseInt(storeId as string)] : undefined;
      } else {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (storeId && userGroupIds.includes(parseInt(storeId as string))) {
          groupIds = [parseInt(storeId as string)];
        } else {
          groupIds = userGroupIds;
        }
      }

      const stats = await storage.getDlcStats(groupIds);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching DLC stats:", error);
      res.status(500).json({ active: 0, expiringSoon: 0, expired: 0 });
    }
  });

  app.get('/api/dlc-products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const dlcProduct = await storage.getDlcProduct(id);
      
      if (!dlcProduct) {
        return res.status(404).json({ message: "DLC Product not found" });
      }

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(dlcProduct.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(dlcProduct);
    } catch (error) {
      console.error("Error fetching DLC product:", error);
      res.status(500).json({ message: "Failed to fetch DLC product" });
    }
  });

  app.post('/api/dlc-products', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const data = {
        ...req.body,
        createdBy: user.id,
      };

      // Check if user has access to the group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(data.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const dlcProduct = await storage.createDlcProduct(data);
      res.json(dlcProduct);
    } catch (error) {
      console.error("Error creating DLC product:", error);
      res.status(500).json({ message: "Failed to create DLC product" });
    }
  });

  app.put('/api/dlc-products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const dlcProduct = await storage.getDlcProduct(id);
      
      if (!dlcProduct) {
        return res.status(404).json({ message: "DLC Product not found" });
      }

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(dlcProduct.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const updatedProduct = await storage.updateDlcProduct(id, req.body);
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating DLC product:", error);
      res.status(500).json({ message: "Failed to update DLC product" });
    }
  });

  app.delete('/api/dlc-products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const dlcProduct = await storage.getDlcProduct(id);
      
      if (!dlcProduct) {
        return res.status(404).json({ message: "DLC Product not found" });
      }

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(dlcProduct.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteDlcProduct(id);
      res.json({ message: "DLC Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting DLC product:", error);
      res.status(500).json({ message: "Failed to delete DLC product" });
    }
  });

  app.post('/api/dlc-products/:id/validate', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has permission to validate DLC products (admin, directeur, manager)
      if (!['admin', 'directeur', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions to validate DLC products" });
      }

      const id = parseInt(req.params.id);
      const dlcProduct = await storage.getDlcProduct(id);
      
      if (!dlcProduct) {
        return res.status(404).json({ message: "DLC Product not found" });
      }

      // For non-admin users, check if they have access to the product's group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(dlcProduct.groupId)) {
          return res.status(403).json({ message: "Access denied to this group's DLC products" });
        }
      }

      console.log('🔍 DLC Validation attempt:', { 
        userId: user.id,
        userRole: user.role, 
        dlcProductId: id,
        dlcGroupId: dlcProduct.groupId,
        userGroups: user.role !== 'admin' ? user.userGroups.map(ug => ug.groupId) : 'all'
      });

      const validatedProduct = await storage.validateDlcProduct(id, user.id);
      console.log('✅ DLC Product validated successfully by:', user.role, user.id);
      
      res.json(validatedProduct);
    } catch (error) {
      console.error("Error validating DLC product:", error);
      res.status(500).json({ message: "Failed to validate DLC product" });
    }
  });

  // Route pour marquer un produit DLC comme stock épuisé - accessible à tous
  app.put('/api/dlc-products/:id/stock-epuise', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const dlcProduct = await storage.getDlcProduct(id);
      
      if (!dlcProduct) {
        return res.status(404).json({ message: "DLC Product not found" });
      }

      // For non-admin users, check if they have access to the product's group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(dlcProduct.groupId)) {
          return res.status(403).json({ message: "Access denied to this group's DLC products" });
        }
      }

      console.log('🔍 DLC Stock épuisé attempt:', { 
        userId: user.id,
        userRole: user.role, 
        dlcProductId: id,
        dlcGroupId: dlcProduct.groupId
      });

      const markedProduct = await storage.markDlcProductStockEpuise(id, user.id);
      console.log('✅ DLC Product marked as stock épuisé by:', user.role, user.id);
      
      res.json(markedProduct);
    } catch (error) {
      console.error("Error marking DLC product as stock épuisé:", error);
      res.status(500).json({ message: "Failed to mark DLC product as stock épuisé" });
    }
  });

  // Route pour restaurer le stock d'un produit DLC - réservé aux admins, directeurs et managers
  app.put('/api/dlc-products/:id/restore-stock', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has permission to restore stock (admin, directeur, manager)
      if (!['admin', 'directeur', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions to restore DLC product stock" });
      }

      const id = parseInt(req.params.id);
      const dlcProduct = await storage.getDlcProduct(id);
      
      if (!dlcProduct) {
        return res.status(404).json({ message: "DLC Product not found" });
      }

      // For non-admin users, check if they have access to the product's group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(dlcProduct.groupId)) {
          return res.status(403).json({ message: "Access denied to this group's DLC products" });
        }
      }

      console.log('🔍 DLC Stock restore attempt:', { 
        userId: user.id,
        userRole: user.role, 
        dlcProductId: id,
        dlcGroupId: dlcProduct.groupId
      });

      const restoredProduct = await storage.restoreDlcProductStock(id);
      console.log('✅ DLC Product stock restored by:', user.role, user.id);
      
      res.json(restoredProduct);
    } catch (error) {
      console.error("Error restoring DLC product stock:", error);
      res.status(500).json({ message: "Failed to restore DLC product stock" });
    }
  });

  // Tasks routes
  app.get('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { storeId } = req.query;
      let groupIds: number[] | undefined;
      
      if (user.role === 'admin') {
        // Admin can see all tasks or filter by specific store
        groupIds = storeId ? [parseInt(storeId as string)] : undefined;
      } else {
        // Non-admin users can only see tasks from their assigned groups
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        
        if (storeId) {
          // If a specific store is requested, verify user has access to it
          const requestedStoreId = parseInt(storeId as string);
          if (userGroupIds.includes(requestedStoreId)) {
            groupIds = [requestedStoreId];
          } else {
            // User doesn't have access to this store, return empty array
            return res.json([]);
          }
        } else {
          // No specific store requested, return tasks from user's groups only
          groupIds = userGroupIds;
        }
      }

      console.log('🔍 Tasks API called with:', { 
        groupIds, 
        userRole: user.role, 
        userId: user.id,
        requestedStoreId: storeId,
        userGroups: user.role !== 'admin' ? user.userGroups.map(ug => ug.groupId) : 'all',
        timestamp: new Date().toISOString()
      });
      
      const tasks = await storage.getTasks(groupIds);
      console.log('📋 Tasks returned:', {
        count: tasks.length,
        userId: user.id,
        userRole: user.role,
        requestedStoreId: storeId,
        groupIds,
        taskGroups: tasks.map(t => ({ id: t.id, title: t.title, groupId: t.groupId })).slice(0, 3)
      });
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json([]);
    }
  });

  app.post('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const data = {
        ...req.body,
        createdBy: user.id,
      };

      // Check if user has access to the group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(data.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const task = await storage.createTask(data);
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(task.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const updatedTask = await storage.updateTask(id, req.body);
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(task.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteTask(id);
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  app.post('/api/tasks/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(task.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.completeTask(id, user.id);
      res.json({ message: "Task completed successfully" });
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task" });
    }
  });

  // Customer Orders routes
  app.get('/api/customer-orders', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { storeId } = req.query;
      let groupIds: number[] | undefined;
      
      if (user.role === 'admin') {
        groupIds = storeId ? [parseInt(storeId as string)] : undefined;
      } else {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (storeId && userGroupIds.includes(parseInt(storeId as string))) {
          groupIds = [parseInt(storeId as string)];
        } else {
          groupIds = userGroupIds;
        }
      }

      console.log('Customer Orders API called with:', { groupIds, userRole: user.role });
      const customerOrders = await storage.getCustomerOrders(groupIds);
      console.log('Customer Orders returned:', customerOrders.length, 'items');
      res.json(customerOrders);
    } catch (error) {
      console.error("Error fetching customer orders:", error);
      res.status(500).json([]);
    }
  });

  app.post('/api/customer-orders', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const data = {
        ...req.body,
        createdBy: user.id,
      };

      // DEBUG: Log what we received and what we're about to save
      console.log('🔍 CUSTOMER ORDER - Received data from frontend:', req.body);
      console.log('🔍 CUSTOMER ORDER - Final data for DB:', data);
      console.log('🔍 CUSTOMER ORDER - orderTaker value:', data.orderTaker, 'type:', typeof data.orderTaker);

      // Check if user has access to the group - PRODUCTION DEBUG
      console.log('🔍 CUSTOMER ORDER PERMISSION DEBUG:', {
        userRole: user.role,
        userId: user.id,
        userGroups: user.userGroups,
        requestedGroupId: data.groupId,
        requestedGroupIdType: typeof data.groupId
      });

      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups ? user.userGroups.map(ug => ug.groupId) : [];
        console.log('🔍 CUSTOMER ORDER - User group IDs:', userGroupIds);
        console.log('🔍 CUSTOMER ORDER - Requested group ID:', data.groupId);
        
        // Convert data.groupId to number if it's a string
        const requestedGroupId = typeof data.groupId === 'string' ? parseInt(data.groupId) : data.groupId;
        console.log('🔍 CUSTOMER ORDER - Converted group ID:', requestedGroupId);
        
        // Allow managers, directeurs, and employees to create orders in their assigned groups
        if (!['manager', 'directeur', 'employee'].includes(user.role)) {
          console.log('❌ CUSTOMER ORDER - Access denied: Invalid role for customer orders');
          return res.status(403).json({ message: "Insufficient permissions to create customer orders" });
        }
        
        if (!userGroupIds.includes(requestedGroupId)) {
          console.log('❌ CUSTOMER ORDER - Access denied: User not in requested group');
          console.log('🔍 Available groups:', userGroupIds, 'Requested:', requestedGroupId);
          console.log('🔍 Type check - userGroupIds types:', userGroupIds.map(id => typeof id));
          console.log('🔍 Type check - requestedGroupId type:', typeof requestedGroupId);
          return res.status(403).json({ message: "Access denied to this group" });
        }
        
        console.log('✅ CUSTOMER ORDER - Permission granted for user role:', user.role);
      }

      const customerOrder = await storage.createCustomerOrder(data);
      res.json(customerOrder);
    } catch (error) {
      console.error("Error creating customer order:", error);
      res.status(500).json({ message: "Failed to create customer order" });
    }
  });

  app.put('/api/customer-orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const customerOrder = await storage.getCustomerOrder(id);
      
      if (!customerOrder) {
        return res.status(404).json({ message: "Customer order not found" });
      }

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(customerOrder.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const updatedOrder = await storage.updateCustomerOrder(id, req.body);
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating customer order:", error);
      res.status(500).json({ message: "Failed to update customer order" });
    }
  });

  app.delete('/api/customer-orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const customerOrder = await storage.getCustomerOrder(id);
      
      if (!customerOrder) {
        return res.status(404).json({ message: "Customer order not found" });
      }

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(customerOrder.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteCustomerOrder(id);
      res.json({ message: "Customer order deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer order:", error);
      res.status(500).json({ message: "Failed to delete customer order" });
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

      console.log('🔍 Vérification facture demandée:', { groupId, invoiceReference });

      const { InvoiceVerificationService } = await import('./invoiceVerification.js');
      const verificationService = new InvoiceVerificationService();
      const result = await verificationService.verifyInvoice(invoiceReference, groupId);
      
      console.log('✅ Résultat vérification:', result);
      res.json(result);
    } catch (error) {
      console.error("❌ Error verifying invoice:", error);
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

  // Backup management routes (Admin only)
  app.get('/api/backups', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const backups = await backupService.getBackupList();
      res.json(backups);
    } catch (error) {
      console.error("Error fetching backups:", error);
      res.status(500).json({ message: "Failed to fetch backups" });
    }
  });

  app.post('/api/backups', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const backup = await backupService.createBackup('manual', user.id);
      res.json(backup);
    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ message: "Failed to create backup" });
    }
  });

  app.get('/api/backups/:filename/download', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { filename } = req.params;
      const filepath = await backupService.downloadBackup(filename);
      
      res.download(filepath, filename, (err: any) => {
        if (err) {
          console.error("Error downloading backup:", err);
          res.status(404).json({ message: "Backup file not found" });
        }
      });
    } catch (error) {
      console.error("Error downloading backup:", error);
      res.status(500).json({ message: "Failed to download backup" });
    }
  });

  app.delete('/api/backups/:filename', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { filename } = req.params;
      await backupService.deleteBackup(filename);
      res.json({ message: "Backup deleted successfully" });
    } catch (error) {
      console.error("Error deleting backup:", error);
      res.status(500).json({ message: "Failed to delete backup" });
    }
  });

  // SAV (Service Après-Vente) routes
  app.get('/api/sav/tickets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's group IDs for filtering
      let groupIds: number[] = [];
      if (user.role === 'admin') {
        // Admin can see all tickets if no specific store is selected
        // But if a store is selected in the UI, filter by that store
        const selectedGroupId = req.query.groupId ? parseInt(req.query.groupId) : null;
        if (selectedGroupId) {
          groupIds = [selectedGroupId];
          console.log(`🎫 [SAV] Admin filtering by selected store: ${selectedGroupId}`);
        } else {
          groupIds = []; // See all tickets
          console.log(`🎫 [SAV] Admin viewing all tickets`);
        }
      } else {
        // Other roles see only their assigned groups
        const userGroups = (user as any).userGroups;
        groupIds = userGroups ? userGroups.map((ug: any) => ug.groupId) : [];
        console.log(`🎫 [SAV] User ${user.username} (${user.role}) can see stores:`, groupIds);
      }

      // Parse query filters
      const filters = {
        groupIds: groupIds.length > 0 ? groupIds : undefined,
        status: req.query.status as string,
        supplierId: req.query.supplierId ? parseInt(req.query.supplierId) : undefined,
        priority: req.query.priority as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const tickets = await storage.getSavTickets(filters);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching SAV tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.get('/api/sav/tickets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getSavTicket(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Check if user can access this ticket
      if (user.role !== 'admin') {
        const userGroups = (user as any).userGroups;
        const userGroupIds = userGroups ? userGroups.map((ug: any) => ug.groupId) : [];
        if (!userGroupIds.includes(ticket.groupId)) {
          return res.status(403).json({ message: "Access denied to this ticket" });
        }
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error fetching SAV ticket:", error);
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  app.post('/api/sav/tickets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check permissions: admin, manager, directeur can create (employee can only view)
      if (!['admin', 'manager', 'directeur'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions to create tickets" });
      }

      // Get user's groups for automatic assignment
      let availableGroupIds: number[] = [];
      if (user.role === 'admin') {
        const allGroups = await storage.getGroups();
        availableGroupIds = allGroups.map(g => g.id);
        console.log(`🎫 [SAV] Admin ${user.username} can access all groups:`, availableGroupIds);
      } else {
        const userGroups = (user as any).userGroups;
        availableGroupIds = userGroups ? userGroups.map((ug: any) => ug.groupId) : [];
        console.log(`🎫 [SAV] User ${user.username} (${user.role}) has groups:`, availableGroupIds);
      }

      if (availableGroupIds.length === 0) {
        return res.status(400).json({ message: "No groups available for ticket creation" });
      }

      // Generate unique ticket number
      const now = new Date();
      const ticketNumber = `SAV-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Date.now().toString().slice(-6)}`;

      // Parse and validate request body
      const assignedGroupId = req.body.groupId || availableGroupIds[0];
      console.log(`🎫 [SAV] Creating ticket for user ${user.username} with groupId: ${assignedGroupId} (requested: ${req.body.groupId}, available: ${availableGroupIds})`);
      
      const ticketData = insertSavTicketSchema.parse({
        ...req.body,
        groupId: assignedGroupId, // Use first available group if not specified
        createdBy: user.id,
      });

      // Add the generated ticket number
      const ticketDataWithNumber = {
        ...ticketData,
        ticketNumber,
      };

      // Validate that the specified group is accessible to the user
      if (!availableGroupIds.includes(ticketData.groupId)) {
        return res.status(403).json({ message: "Access denied to the specified group" });
      }

      const ticket = await storage.createSavTicket(ticketDataWithNumber);
      console.log(`🎫 [SAV] Ticket created successfully:`, {
        ticketNumber: ticket.ticketNumber,
        groupId: ticket.groupId,
        createdBy: ticket.createdBy,
        userRole: user.role
      });
      res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating SAV ticket:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  app.patch('/api/sav/tickets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check permissions: admin, manager, directeur can modify
      if (!['admin', 'manager', 'directeur'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions to modify tickets" });
      }

      const ticketId = parseInt(req.params.id);
      const existingTicket = await storage.getSavTicket(ticketId);
      
      if (!existingTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Check if user can access this ticket
      if (user.role !== 'admin') {
        const userGroups = (user as any).userGroups;
        const userGroupIds = userGroups ? userGroups.map((ug: any) => ug.groupId) : [];
        if (!userGroupIds.includes(existingTicket.groupId)) {
          return res.status(403).json({ message: "Access denied to modify this ticket" });
        }
      }

      // Parse and validate partial update data
      const updateData = insertSavTicketSchema.partial().parse(req.body);
      const updatedTicket = await storage.updateSavTicket(ticketId, updateData);

      // Add history entry for status change if status was modified
      if (req.body.status && req.body.status !== existingTicket.status) {
        await storage.addSavTicketHistory({
          ticketId: ticketId,
          action: 'status_change',
          description: `Statut changé de "${existingTicket.status}" vers "${req.body.status}"`,
          createdBy: user.id,
        });
      }

      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating SAV ticket:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });

  app.delete('/api/sav/tickets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check permissions: only admin and directeur can delete
      if (!['admin', 'directeur'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions to delete tickets" });
      }

      const ticketId = parseInt(req.params.id);
      const existingTicket = await storage.getSavTicket(ticketId);
      
      if (!existingTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      await storage.deleteSavTicket(ticketId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting SAV ticket:", error);
      res.status(500).json({ message: "Failed to delete ticket" });
    }
  });

  app.post('/api/sav/tickets/:id/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check permissions: admin, manager, directeur can add comments
      if (!['admin', 'manager', 'directeur'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions to add comments" });
      }

      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getSavTicket(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Check if user can access this ticket
      if (user.role !== 'admin') {
        const userGroups = (user as any).userGroups;
        const userGroupIds = userGroups ? userGroups.map((ug: any) => ug.groupId) : [];
        if (!userGroupIds.includes(ticket.groupId)) {
          return res.status(403).json({ message: "Access denied to add comments to this ticket" });
        }
      }

      // Parse and validate history entry
      const historyData = insertSavTicketHistorySchema.parse({
        ticketId: ticketId,
        action: 'comment',
        description: req.body.description,
        createdBy: user.id,
      });

      const history = await storage.addSavTicketHistory(historyData);
      res.status(201).json(history);
    } catch (error) {
      console.error("Error adding SAV ticket history:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  app.get('/api/sav/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's group IDs for filtering
      let groupIds: number[] = [];
      if (user.role === 'admin') {
        // Admin can see all stats if no specific store is selected
        // But if a store is selected in the UI, filter by that store
        const selectedGroupId = req.query.groupId ? parseInt(req.query.groupId) : null;
        if (selectedGroupId) {
          groupIds = [selectedGroupId];
          console.log(`📊 [SAV STATS] Admin filtering by selected store: ${selectedGroupId}`);
        } else {
          groupIds = []; // See all stats
          console.log(`📊 [SAV STATS] Admin viewing all stats`);
        }
      } else {
        // Other roles see only their assigned groups
        const userGroups = (user as any).userGroups;
        groupIds = userGroups ? userGroups.map((ug: any) => ug.groupId) : [];
        console.log(`📊 [SAV STATS] User ${user.username} (${user.role}) can see stores:`, groupIds);
      }

      const stats = await storage.getSavTicketStats(groupIds.length > 0 ? groupIds : undefined);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching SAV stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Emergency migration route for SAV priority column
  app.post('/api/admin/emergency-migration', async (req, res) => {
    try {
      console.log('🚨 EMERGENCY: Forcing SAV migration execution...');
      
      // Import migration function
      const { runProductionMigrations } = await import('./migrations.production.js');
      
      // Force run the migration
      await runProductionMigrations();
      
      console.log('✅ EMERGENCY: Migration executed successfully');
      res.json({ 
        success: true, 
        message: 'Emergency migration executed successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ EMERGENCY: Migration failed:', error);
      res.status(500).json({ 
        success: false,
        error: 'Emergency migration failed', 
        details: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Weather routes
  app.get('/api/weather/settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const settings = await storage.getWeatherSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching weather settings:", error);
      res.status(500).json({ message: "Failed to fetch weather settings" });
    }
  });

  app.post('/api/weather/settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const data = insertWeatherSettingsSchema.parse(req.body);
      const settings = await storage.createWeatherSettings(data);
      res.json(settings);
    } catch (error) {
      console.error("Error creating weather settings:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create weather settings" });
    }
  });

  app.put('/api/weather/settings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const id = parseInt(req.params.id);
      const data = insertWeatherSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateWeatherSettings(id, data);
      res.json(settings);
    } catch (error) {
      console.error("Error updating weather settings:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update weather settings" });
    }
  });

  app.post('/api/weather/test-connection', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { apiKey, location } = req.body;
      
      if (!apiKey || !location) {
        return res.status(400).json({ message: "API key and location are required" });
      }

      const result = await weatherService.testApiConnection(apiKey, location);
      res.json(result);
    } catch (error) {
      console.error("Error testing weather API connection:", error);
      res.status(500).json({ message: "Failed to test API connection" });
    }
  });

  app.get('/api/weather/current', isAuthenticated, async (req: any, res) => {
    try {
      const settings = await storage.getWeatherSettings();
      
      if (!settings || !settings.isActive) {
        return res.status(404).json({ message: "Weather service not configured or disabled" });
      }

      const today = new Date().toISOString().split('T')[0];
      const previousYearDate = weatherService.getPreviousYearDate();
      
      // Check if we already have today's data
      let currentYearData = await storage.getWeatherData(today, true);
      let previousYearData = await storage.getWeatherData(previousYearDate, false);

      // Fetch current year data if not in cache
      if (!currentYearData) {
        console.log("🌤️ [FETCH] Fetching current weather data from API");
        const apiData = await weatherService.fetchCurrentWeather(settings);
        if (apiData) {
          const weatherData = weatherService.convertApiDataToWeatherData(apiData, settings.location, true);
          if (weatherData) {
            try {
              currentYearData = await storage.createWeatherData(weatherData);
              console.log("✅ [CACHE] Current year data saved to cache");
            } catch (error: any) {
              console.warn("⚠️ [CACHE] Could not save current year data (may already exist):", error.message);
              // Récupérer les données existantes au lieu de créer
              currentYearData = await storage.getWeatherData(today, true);
            }
          }
        }
      }

      // Fetch previous year data if not in cache
      if (!previousYearData) {
        console.log("🌤️ [FETCH] Fetching previous year weather data from API");
        const apiData = await weatherService.fetchPreviousYearWeather(settings, previousYearDate);
        if (apiData) {
          const weatherData = weatherService.convertApiDataToWeatherData(apiData, settings.location, false);
          if (weatherData) {
            try {
              previousYearData = await storage.createWeatherData(weatherData);
              console.log("✅ [CACHE] Previous year data saved to cache");
            } catch (error: any) {
              console.warn("⚠️ [CACHE] Could not save previous year data (may already exist):", error.message);
              // Récupérer les données existantes au lieu de créer
              previousYearData = await storage.getWeatherData(previousYearDate, false);
            }
          }
        } else {
          console.warn("⚠️ [HISTORY] Could not fetch historical data - continuing with current year only");
        }
      }

      // Toujours retourner une réponse même si seule l'année actuelle est disponible
      const response = {
        currentYear: currentYearData ? {
          ...currentYearData,
          maxTemperature: parseFloat(currentYearData.tempMax),
          minTemperature: parseFloat(currentYearData.tempMin),
          condition: currentYearData.conditions,
          icon: weatherService.getWeatherIcon(currentYearData.icon)
        } : null,
        previousYear: previousYearData ? {
          ...previousYearData,
          maxTemperature: parseFloat(previousYearData.tempMax),
          minTemperature: parseFloat(previousYearData.tempMin),
          condition: previousYearData.conditions,
          icon: weatherService.getWeatherIcon(previousYearData.icon)
        } : null,
        location: settings.location
      };

      console.log('🌤️ [RESPONSE] Weather data prepared:', {
        hasCurrentYear: !!response.currentYear,
        hasPreviousYear: !!response.previousYear,
        location: response.location
      });

      res.json(response);
    } catch (error) {
      console.error("Error fetching weather data:", error);
      res.status(500).json({ message: "Failed to fetch weather data" });
    }
  });

  // Route de géolocalisation météo
  // Announcement routes - PostgreSQL en production, mémoire en développement
  app.get('/api/announcements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      console.log('📢 [SERVER] Fetching announcements for user:', userId, 'environment:', environment);
      
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log('📢 [SERVER] User found:', { username: user.username, role: user.role });

      if (environment === 'production') {
        // PRODUCTION: Utiliser PostgreSQL avec DASHBOARD_MESSAGES
        console.log('🎯 [PRODUCTION] Using PostgreSQL DASHBOARD_MESSAGES table');
        
        try {
          let query = db.select({
            id: dashboardMessages.id,
            title: dashboardMessages.title,
            content: dashboardMessages.content,
            type: dashboardMessages.type,
            storeId: dashboardMessages.storeId,
            createdBy: dashboardMessages.createdBy,
            createdAt: dashboardMessages.createdAt,
          }).from(dashboardMessages);
          
          // Filtrage par magasin pour admin : inclure les annonces globales + annonces du magasin
          if (user.role === 'admin' && req.query.storeId) {
            const storeId = parseInt(req.query.storeId as string);
            // Inclure les annonces globales (storeId = null) ET les annonces du magasin sélectionné
            query = query.where(
              or(
                eq(dashboardMessages.storeId, storeId),
                isNull(dashboardMessages.storeId)
              )
            );
          }
          
          const messages = await query.orderBy(desc(dashboardMessages.createdAt)).limit(5);
          
          console.log('🔍 [PRODUCTION] Raw messages from DB:', messages.length, 'items:', messages);
          
          // Ajouter les relations manuellement
          const announcements = await Promise.all(
            messages.map(async (message) => {
              // Récupérer l'auteur
              let author = { id: message.createdBy, firstName: 'Utilisateur', lastName: 'Inconnu', username: message.createdBy };
              try {
                // En production, createdBy est varchar, donc chercher par username
                console.log('🔍 [PRODUCTION] Looking for user with username:', message.createdBy);
                const [userResult] = await db.select({
                  id: users.id,
                  username: users.username,
                  firstName: users.firstName,
                  lastName: users.lastName,
                  name: users.name
                }).from(users).where(eq(users.username, message.createdBy));
                console.log('🔍 [PRODUCTION] User search result:', userResult ? 'Found' : 'Not found');
                if (userResult) {
                  // Utiliser name s'il existe, sinon firstName + lastName, sinon username
                  const displayName = userResult.name || 
                    (userResult.firstName && userResult.lastName ? `${userResult.firstName} ${userResult.lastName}` : '') ||
                    userResult.username;
                  
                  author = {
                    id: userResult.id,
                    firstName: userResult.firstName || displayName.split(' ')[0] || userResult.username,
                    lastName: userResult.lastName || displayName.split(' ').slice(1).join(' ') || '',
                    username: userResult.username
                  };
                } else {
                  console.warn('❌ [PRODUCTION] User not found with username:', message.createdBy);
                }
              } catch (e) {
                console.warn('❌ [PRODUCTION] Could not fetch author for message:', message.id, e);
              }
              
              // Récupérer le groupe si storeId est défini
              let group = null;
              if (message.storeId) {
                try {
                  const [groupResult] = await db.select().from(groups).where(eq(groups.id, message.storeId));
                  if (groupResult) {
                    group = { id: groupResult.id, name: groupResult.name };
                  }
                } catch (e) {
                  console.warn('Could not fetch group for message:', message.id);
                }
              }
              
              return {
                ...message,
                author,
                group
              };
            })
          );
          
          console.log('🎯 [PRODUCTION] Found announcements:', announcements.length);
          res.json(announcements);
          
        } catch (dbError) {
          console.error('🎯 [PRODUCTION] Database error:', dbError);
          // Fallback au stockage mémoire en cas d'erreur DB
          console.log('🧠 [FALLBACK] Using memory storage due to DB error');
          const announcements = await storage.getAnnouncements();
          res.json(announcements);
        }
      } else {
        // DÉVELOPPEMENT: Utiliser stockage mémoire
        console.log('🧠 [DEV] Using memory storage for announcements');
        const groupIds = user.role === 'admin' && req.query.storeId 
          ? [parseInt(req.query.storeId as string)]
          : undefined;
        
        const announcements = await storage.getAnnouncements(groupIds);
        res.json(announcements);
      }
    } catch (error) {
      console.error("📢 [SERVER] Error fetching announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.post('/api/announcements', isAuthenticated, async (req: any, res) => {
    console.log('🎯 [SERVER] POST /api/announcements endpoint hit');
    console.log('🎯 [SERVER] Request body:', JSON.stringify(req.body, null, 2));
    console.log('🎯 [SERVER] User object:', {
      hasClaims: !!req.user.claims,
      hasId: !!req.user.id,
      userId: req.user.claims ? req.user.claims.sub : req.user.id
    });
    
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      console.log('🎯 [SERVER] Extracted userId:', userId);
      
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        console.error('🎯 [SERVER] User not found for ID:', userId);
        return res.status(404).json({ message: "User not found" });
      }

      console.log('🎯 [SERVER] User found:', { username: user.username, role: user.role, id: user.id });

      // Only admin can create announcements
      if (user.role !== 'admin') {
        console.error('🎯 [SERVER] Access denied - user role:', user.role);
        return res.status(403).json({ message: "Only administrators can create announcements" });
      }

      console.log('🎯 [SERVER] User is admin, proceeding with validation');

      const announcementData = insertAnnouncementSchema.parse({
        title: req.body.title,
        content: req.body.content,
        type: req.body.type || 'info',
        storeId: req.body.storeId || null, // Permettre les annonces par magasin OU globales
        createdBy: user.username, // Utiliser username pour PostgreSQL
      });

      console.log('🎯 [SERVER] Announcement data validated:', announcementData);

      if (environment === 'production') {
        // PRODUCTION: Créer dans PostgreSQL DASHBOARD_MESSAGES
        console.log('🎯 [PRODUCTION] Creating in PostgreSQL DASHBOARD_MESSAGES table');
        try {
          const [newMessage] = await db.insert(dashboardMessages).values({
            title: announcementData.title,
            content: announcementData.content,
            type: announcementData.type,
            storeId: announcementData.storeId,
            createdBy: user.username, // Utiliser username plutôt que ID pour PostgreSQL
          }).returning();
          
          const announcement = {
            ...newMessage,
            author: { id: user.id, firstName: user.firstName, lastName: user.lastName },
            group: null
          };
          
          console.log('🎯 [PRODUCTION] Announcement created successfully in DB:', announcement);
          res.status(201).json(announcement);
        } catch (dbError) {
          console.error('🎯 [PRODUCTION] DB error, fallback to memory:', dbError);
          const announcement = await storage.createAnnouncement(announcementData);
          res.status(201).json(announcement);
        }
      } else {
        // DÉVELOPPEMENT: Créer en mémoire
        const announcement = await storage.createAnnouncement(announcementData);
        console.log('🧠 [DEV] Announcement created in memory:', announcement);
        res.status(201).json(announcement);
      }
    } catch (error) {
      console.error('🎯 [SERVER] Error creating announcement:', error);
      if (error instanceof z.ZodError) {
        console.error('🎯 [SERVER] Validation errors:', error.errors);
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  // PUT /api/announcements/:id - Update announcement (admin only)
  app.put('/api/announcements/:id', isAuthenticated, async (req: any, res) => {
    console.log('📝 [SERVER] PUT /api/announcements/:id endpoint hit');
    console.log('📝 [SERVER] Request body:', JSON.stringify(req.body, null, 2));
    
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      console.log('📝 [SERVER] Extracted userId:', userId);
      
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        console.error('📝 [SERVER] User not found for ID:', userId);
        return res.status(404).json({ message: "User not found" });
      }

      console.log('📝 [SERVER] User found:', { username: user.username, role: user.role, id: user.id });

      // Only admin can edit announcements
      if (user.role !== 'admin') {
        console.error('📝 [SERVER] Access denied - user role:', user.role);
        return res.status(403).json({ message: "Only administrators can edit announcements" });
      }

      const id = parseInt(req.params.id);
      console.log('📝 [SERVER] Announcement ID:', id);

      // Verify announcement exists
      const existingAnnouncement = await storage.getAnnouncement(id);
      if (!existingAnnouncement) {
        console.error('📝 [SERVER] Announcement not found:', id);
        return res.status(404).json({ message: "Announcement not found" });
      }

      console.log('📝 [SERVER] User is admin, proceeding with validation');

      const announcementData = insertAnnouncementSchema.partial().parse(req.body);
      console.log('📝 [SERVER] Announcement data validated:', announcementData);

      const updatedAnnouncement = await storage.updateAnnouncement(id, announcementData);
      console.log('📝 [SERVER] Announcement updated successfully:', updatedAnnouncement);
      
      res.json(updatedAnnouncement);
    } catch (error) {
      console.error('📝 [SERVER] Error updating announcement:', error);
      if (error instanceof z.ZodError) {
        console.error('📝 [SERVER] Validation errors:', error.errors);
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update announcement" });
    }
  });

  app.delete('/api/announcements/:id', isAuthenticated, async (req: any, res) => {
    console.log('🗑️ [SERVER] DELETE /api/announcements/:id endpoint hit');
    console.log('🗑️ [SERVER] Announcement ID:', req.params.id);
    
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      console.log('🗑️ [SERVER] Extracted userId:', userId);
      
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        console.error('🗑️ [SERVER] User not found for ID:', userId);
        return res.status(404).json({ message: "User not found" });
      }

      console.log('🗑️ [SERVER] User found:', { username: user.username, role: user.role, id: user.id });

      // Only admin can delete announcements
      if (user.role !== 'admin') {
        console.error('🗑️ [SERVER] Access denied - user role:', user.role);
        return res.status(403).json({ message: "Only administrators can delete announcements" });
      }

      const id = parseInt(req.params.id);
      console.log('🗑️ [SERVER] Parsed announcement ID:', id);

      if (environment === 'production') {
        // PRODUCTION: Supprimer dans PostgreSQL DASHBOARD_MESSAGES
        console.log('🗑️ [PRODUCTION] Deleting from PostgreSQL DASHBOARD_MESSAGES table');
        try {
          const deletedRows = await db.delete(dashboardMessages).where(eq(dashboardMessages.id, id)).returning();
          
          if (deletedRows.length === 0) {
            console.error('🗑️ [PRODUCTION] Announcement not found:', id);
            return res.status(404).json({ message: "Announcement not found" });
          }
          
          console.log('🗑️ [PRODUCTION] Announcement deleted successfully from DB:', deletedRows[0]);
          res.json({ message: "Announcement deleted successfully" });
        } catch (dbError) {
          console.error('🗑️ [PRODUCTION] DB error, fallback to memory:', dbError);
          const success = await storage.deleteAnnouncement(id);
          
          if (!success) {
            return res.status(404).json({ message: "Announcement not found" });
          }
          
          res.json({ message: "Announcement deleted successfully" });
        }
      } else {
        // DÉVELOPPEMENT: Supprimer en mémoire
        console.log('🗑️ [DEV] Deleting from memory storage');
        const success = await storage.deleteAnnouncement(id);
        
        if (!success) {
          console.error('🗑️ [DEV] Announcement not found:', id);
          return res.status(404).json({ message: "Announcement not found" });
        }
        
        console.log('🗑️ [DEV] Announcement deleted from memory');
        res.json({ message: "Announcement deleted successfully" });
      }
    } catch (error) {
      console.error("🗑️ [SERVER] Error deleting announcement:", error);
      res.status(500).json({ message: "Failed to delete announcement" });
    }
  });

  app.post('/api/weather/geolocation', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({ message: "Latitude et longitude requises" });
      }

      // Récupérer les paramètres météo actuels pour obtenir la clé API
      const settings = await storage.getWeatherSettings();
      if (!settings || !settings.apiKey) {
        return res.status(500).json({ message: "Configuration météo manquante" });
      }

      // Convertir les coordonnées en nom de ville
      const locationData = await weatherService.getCityFromCoordinates(
        parseFloat(latitude),
        parseFloat(longitude),
        settings.apiKey
      );

      if (!locationData) {
        return res.status(500).json({ message: "Impossible de déterminer la ville à partir des coordonnées" });
      }

      // Mettre à jour automatiquement la configuration météo avec la nouvelle localisation
      await storage.updateWeatherSettings(settings.id, {
        location: locationData.fullLocation
      });

      // Vider le cache météo car la localisation a changé
      await storage.clearWeatherCache();

      console.log('🌍 Localisation mise à jour automatiquement:', {
        from: settings.location,
        to: locationData.fullLocation,
        coordinates: { latitude, longitude }
      });

      res.json({
        success: true,
        location: locationData,
        message: `Localisation mise à jour vers ${locationData.city}, ${locationData.country}`
      });

    } catch (error) {
      console.error("Erreur géolocalisation météo:", error);
      res.status(500).json({ message: "Erreur lors de la géolocalisation" });
    }
  });

  // Create server instance
  const httpServer = createServer(app);

  // Server startup
  return httpServer;
}
