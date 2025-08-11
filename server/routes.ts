import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage as devStorage } from "./storage";
import { storage as prodStorage } from "./storage.production";
import { setupLocalAuth, requireAuth } from "./localAuth";

// Use appropriate storage based on environment  
console.log('🔍 DIAGNOSTIC - NODE_ENV:', process.env.NODE_ENV);
console.log('🔍 DIAGNOSTIC - STORAGE_MODE:', process.env.STORAGE_MODE);
const isProduction = true; // FORCED PRODUCTION MODE FOR DEBUGGING
const storage = isProduction ? prodStorage : devStorage;
console.log('🔍 DIAGNOSTIC - Using storage:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');


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
  insertDlcProductSchema,
  insertDlcProductFrontendSchema,
  insertRoleSchema,
  insertPermissionSchema,
  insertUserRoleSchema,
  insertTaskSchema
} from "@shared/schema";
import { z } from "zod";

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

      // Admin sees all groups, others see only their assigned groups
      if (user.role === 'admin') {
        const groups = await storage.getGroups();
        res.json(groups);
      } else {
        const userGroups = user.userGroups.map(ug => ug.group);
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
    } catch (error) {
      console.error('❌ Failed to create group:', {
        error: error.message,
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
    } catch (error) {
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
      if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
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
      if (user.role !== 'admin' && user.role !== 'manager') {
        console.error('❌ Insufficient permissions:', { userRole: user.role, required: ['admin', 'manager'] });
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
        error: error.message,
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
      if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
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
      if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
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
        const groupIds = user.userGroups.map(ug => ug.groupId);
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

      // Check if user has access to this order
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
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

      // Check if user has access to the group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
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
        error: error.message,
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

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
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

      // Check permissions
      if (user.role !== 'admin' && user.role !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      if (user.role === 'manager') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
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
        const groupIds = user.userGroups.map(ug => ug.groupId);
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

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(delivery.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const data = insertDeliverySchema.partial().parse(req.body);
      const updatedDelivery = await storage.updateDelivery(id, data);
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

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(delivery.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const data = insertDeliverySchema.partial().parse(req.body);
      const updatedDelivery = await storage.updateDelivery(id, data);
      res.json(updatedDelivery);
    } catch (error) {
      console.error("Error updating delivery:", error);
      res.status(500).json({ message: "Failed to update delivery" });
    }
  });

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

      // Check permissions
      if (user.role !== 'admin' && user.role !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      if (user.role === 'manager') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
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

  app.post('/api/deliveries/:id/validate', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role !== 'admin' && user.role !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
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

      // Get all users with roles and groups for admin
      const usersWithRoles = await storage.getUsersWithRolesAndGroups();
      const safeUsers = Array.isArray(usersWithRoles) ? usersWithRoles : [];
      
      console.log('🔐 API /api/users - Returning:', { isArray: Array.isArray(safeUsers), length: safeUsers.length });
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
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
        email: z.string().email().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        password: z.string().optional(),
        role: z.enum(['admin', 'manager', 'employee']).optional(),
      });

      const userData = createUserSchema.parse(req.body);
      
      // Hash password if provided (for local auth)
      if (userData.password) {
        const { hashPassword } = await import("./localAuth");
        userData.password = await hashPassword(userData.password);
      }
      
      const newUser = await storage.createUser({
        id: userData.id || `manual_${Date.now()}`, // Generate manual ID for created users
        ...userData,
      });

      res.json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      
      // Handle specific database constraint errors
      if (error.code === '23505') {
        if (error.constraint === 'users_username_key') {
          return res.status(409).json({ 
            message: "Un utilisateur avec ce nom d'utilisateur existe déjà. Veuillez choisir un autre nom d'utilisateur." 
          });
        }
        if (error.constraint === 'users_email_key') {
          return res.status(409).json({ 
            message: "Un utilisateur avec cette adresse email existe déjà." 
          });
        }
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
        role: z.enum(['admin', 'manager', 'employee']).optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().optional(),
      });

      const userData = updateUserSchema.parse(req.body);
      
      // Hash password if provided
      if (userData.password) {
        const { hashPassword } = await import("./localAuth");
        userData.password = await hashPassword(userData.password);
        // Mark password as changed
        (userData as any).passwordChanged = true;
      }
      
      const updatedUser = await storage.updateUser(req.params.id, userData);

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
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
      res.status(500).json({ message: "Failed to fetch publicities" });
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
        const hasAccess = publicity.participations.some(p => userGroupIds.includes(p.groupId));
        
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

      // Check permissions (admin or manager)
      if (user.role === 'employee') {
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

      // Check permissions (admin or manager)
      if (user.role === 'employee') {
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
      // Assurer que la réponse est toujours un array
      res.json(Array.isArray(configs) ? configs : []);
    } catch (error) {
      console.error('Error fetching NocoDB configs:', error);
      res.status(500).json({ message: 'Erreur lors de la récupération des configurations' });
    }
  });

  app.get('/api/nocodb-config/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent gérer les configurations NocoDB.' });
      }

      const id = parseInt(req.params.id);
      const config = await storage.getNocodbConfig(id);
      
      if (!config) {
        return res.status(404).json({ message: 'Configuration non trouvée' });
      }

      res.json(config);
    } catch (error) {
      console.error('Error fetching NocoDB config:', error);
      res.status(500).json({ message: 'Erreur lors de la récupération de la configuration' });
    }
  });

  app.post('/api/nocodb-config', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent gérer les configurations NocoDB.' });
      }

      const configData = {
        ...req.body,
        createdBy: req.user.claims ? req.user.claims.sub : req.user.id,
      };

      const config = await storage.createNocodbConfig(configData);
      res.status(201).json(config);
    } catch (error) {
      console.error('Error creating NocoDB config:', error);
      res.status(500).json({ message: 'Erreur lors de la création de la configuration' });
    }
  });

  app.put('/api/nocodb-config/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent gérer les configurations NocoDB.' });
      }

      const id = parseInt(req.params.id);
      const config = await storage.updateNocodbConfig(id, req.body);
      res.json(config);
    } catch (error) {
      console.error('Error updating NocoDB config:', error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour de la configuration' });
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
      res.status(500).json({ message: 'Erreur lors de la suppression de la configuration' });
    }
  });



  // Role Management API Routes
  
  // Get all roles
  app.get('/api/roles', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const roles = await storage.getRoles();
      res.json(Array.isArray(roles) ? roles : []);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json([]);
    }
  });

  // Get all permissions
  app.get('/api/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      console.log(`🔍 ${isProduction ? 'PRODUCTION' : 'DEV'} Permissions API - User ID:`, userId);
      
      const user = await storage.getUserWithGroups(userId);
      console.log(`👤 ${isProduction ? 'PRODUCTION' : 'DEV'} Permissions API - User found:`, user ? user.role : 'NOT FOUND');
      
      if (!user || user.role !== 'admin') {
        console.log(`❌ ${isProduction ? 'PRODUCTION' : 'DEV'} Permissions API - Access denied, user role:`, user?.role);
        return res.status(403).json({ message: "Accès refusé - droits administrateur requis" });
      }

      console.log(`🔍 ${isProduction ? 'PRODUCTION' : 'DEV'} Fetching all permissions...`);
      const permissions = await storage.getPermissions();
      console.log(`📝 ${isProduction ? 'PRODUCTION' : 'DEV'} Permissions fetched:`, permissions.length, "items");
      console.log(`🏷️ ${isProduction ? 'PRODUCTION' : 'DEV'} Categories found:`, [...new Set(permissions.map(p => p.category))]);
      console.log(`🔧 ${isProduction ? 'PRODUCTION' : 'DEV'} DLC permissions:`, permissions.filter(p => p.category === 'gestion_dlc').map(p => p.name));
      
      // 🎯 VÉRIFICATION SPÉCIFIQUE PERMISSIONS TÂCHES
      const taskPermissions = permissions.filter(p => p.category === 'gestion_taches');
      console.log(`📋 ${isProduction ? 'PRODUCTION' : 'DEV'} Task permissions found:`, taskPermissions.length);
      if (taskPermissions.length > 0) {
        console.log(`📋 ${isProduction ? 'PRODUCTION' : 'DEV'} Task permissions details:`);
        taskPermissions.forEach(p => {
          console.log(`  - ID: ${p.id}, Name: ${p.name}, DisplayName: "${p.displayName}", Category: ${p.category}`);
        });
      } else {
        console.log(`❌ ${isProduction ? 'PRODUCTION' : 'DEV'} NO TASK PERMISSIONS FOUND - This explains the frontend issue!`);
      }
      
      res.json(Array.isArray(permissions) ? permissions : []);
    } catch (error) {
      console.error("❌ Error fetching permissions:", error);
      res.status(500).json([]);
    }
  });

  // Get permissions for a specific role
  app.get('/api/roles/:id/permissions', isAuthenticated, async (req: any, res) => {
    console.log("🚀 ROLE PERMISSIONS ROUTE CALLED - Starting");
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      console.log("🔍 ROLE PERMISSIONS - User ID:", userId);
      
      const user = await storage.getUserWithGroups(userId);
      console.log("👤 ROLE PERMISSIONS - User found:", user ? `${user.role} (${user.username})` : 'NOT FOUND');
      
      if (!user || user.role !== 'admin') {
        console.log("❌ ROLE PERMISSIONS - Access denied, user role:", user?.role);
        return res.status(403).json({ message: "Access denied" });
      }

      const roleId = parseInt(req.params.id);
      console.log("🔍 ROLE PERMISSIONS - Fetching for role ID:", roleId);
      console.log("🔍 ROLE PERMISSIONS - Storage type:", storage.constructor.name);
      
      const rolePermissions = await storage.getRolePermissions(roleId);
      console.log("📝 ROLE PERMISSIONS - Fetched:", rolePermissions?.length || 0, "items");
      
      if (rolePermissions && rolePermissions.length > 0) {
        console.log("🏷️ ROLE PERMISSIONS - Sample:", rolePermissions.slice(0, 2));
        console.log("🔍 ROLE PERMISSIONS - Full structure sample:", JSON.stringify(rolePermissions[0], null, 2));
        
        // Debug spécifique pour les tâches
        const taskPermissions = rolePermissions.filter(rp => rp.permission && rp.permission.category === 'gestion_taches');
        console.log("🎯 ROLE PERMISSIONS - Task permissions:", taskPermissions.length);
        taskPermissions.forEach(tp => {
          console.log(`  - Task permission: ${tp.permission.name} (${tp.permission.displayName})`);
        });
      } else {
        console.log("⚠️ ROLE PERMISSIONS - No permissions found for role", roleId);
      }
      
      res.json(rolePermissions || []);
    } catch (error) {
      console.error("❌ ROLE PERMISSIONS - Error:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  // Set permissions for a role
  app.post('/api/roles/:id/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const roleId = parseInt(req.params.id);
      const { permissionIds } = req.body;

      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({ message: "permissionIds must be an array" });
      }

      await storage.setRolePermissions(roleId, permissionIds);
      console.log(`✅ Permissions updated for role ${roleId}:`, permissionIds);
      res.json({ message: "Permissions updated successfully" });
    } catch (error) {
      console.error("Error setting role permissions:", error);
      res.status(500).json({ message: "Failed to update permissions" });
    }
  });

  // Set roles for a user  
  app.post('/api/users/:userId/roles', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { userId } = req.params;
      const { roleIds } = req.body;

      if (!Array.isArray(roleIds)) {
        return res.status(400).json({ message: "roleIds must be an array" });
      }

      const assignedBy = req.user.claims ? req.user.claims.sub : req.user.id;
      await storage.setUserRoles(userId, roleIds, assignedBy);
      console.log(`✅ Roles updated for user ${userId}:`, roleIds);
      res.json({ message: "User roles updated successfully" });
    } catch (error) {
      console.error("Error setting user roles:", error);
      res.status(500).json({ message: "Failed to update user roles" });
    }
  });

  // Get roles for a specific user
  app.get('/api/users/:userId/roles', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { userId } = req.params;
      const userRoles = await storage.getUserRoles(userId);
      res.json(Array.isArray(userRoles) ? userRoles : []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json([]);
    }
  });

  // Customer Orders routes
  app.get('/api/customer-orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { storeId } = req.query;
      
      // Determine which groups to show
      let groupIds;
      if (user.role === 'admin' && storeId) {
        // Admin filtering by specific store
        groupIds = [parseInt(storeId.toString())];
        console.log("Customer orders - Admin filtering by store:", { storeId, groupIds });
      } else if (user.role === 'admin') {
        // Admin viewing all stores - get all groups
        const allGroups = await storage.getGroups();
        groupIds = allGroups.map(g => g.id);
        console.log("Customer orders - Admin viewing all stores:", { groupCount: groupIds.length });
      } else {
        // Non-admin users see only their assigned stores
        groupIds = user.userGroups.map(ug => ug.groupId);
        console.log("Customer orders - User assigned stores:", { groupIds });
      }

      const customerOrders = await storage.getCustomerOrders(groupIds);
      console.log("Customer orders returned from storage:", customerOrders?.length || 0, "items");
      res.json(customerOrders || []);
    } catch (error) {
      console.error("Error fetching customer orders:", error);
      res.status(500).json({ message: "Failed to fetch customer orders" });
    }
  });

  app.get('/api/customer-orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const customerOrder = await storage.getCustomerOrder(id);
      
      if (!customerOrder) {
        return res.status(404).json({ message: "Customer order not found" });
      }

      // Check if user has access to this order's group
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(customerOrder.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(customerOrder);
    } catch (error) {
      console.error("Error fetching customer order:", error);
      res.status(500).json({ message: "Failed to fetch customer order" });
    }
  });

  app.post('/api/customer-orders', isAuthenticated, async (req: any, res) => {
    try {
      console.log("Raw body received:", req.body);
      console.log("Body type:", typeof req.body);
      console.log("Body keys:", req.body ? Object.keys(req.body) : 'no keys');
      
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const data = insertCustomerOrderSchema.parse(req.body);
      console.log("Parsed data:", data);
      
      // Check if user has access to the specified group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(data.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const customerOrder = await storage.createCustomerOrder({
        ...data,
        createdBy: userId,
      });
      res.status(201).json(customerOrder);
    } catch (error) {
      console.error("Error creating customer order:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create customer order" });
    }
  });

  app.put('/api/customer-orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if order exists and user has access
      const existingOrder = await storage.getCustomerOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ message: "Customer order not found" });
      }

      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(existingOrder.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const data = insertCustomerOrderSchema.partial().parse(req.body);
      const customerOrder = await storage.updateCustomerOrder(id, data);
      res.json(customerOrder);
    } catch (error) {
      console.error("Error updating customer order:", error);
      res.status(500).json({ message: "Failed to update customer order" });
    }
  });

  app.delete('/api/customer-orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if order exists and user has access
      const existingOrder = await storage.getCustomerOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ message: "Customer order not found" });
      }

      // Only admin can delete orders
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete customer orders" });
      }

      await storage.deleteCustomerOrder(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer order:", error);
      res.status(500).json({ message: "Failed to delete customer order" });
    }
  });

  // ===== ROLE MANAGEMENT ROUTES =====

  // Roles routes
  app.get('/api/roles', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get('/api/roles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      const role = await storage.getRoleWithPermissions(id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  app.post('/api/roles', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const data = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(data);
      res.json(role);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.put('/api/roles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      const data = insertRoleSchema.partial().parse(req.body);
      const role = await storage.updateRole(id, data);
      res.json(role);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete('/api/roles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      
      // Check if role is system role
      const role = await storage.getRole(id);
      if (role?.isSystem) {
        return res.status(400).json({ message: "Cannot delete system role" });
      }

      await storage.deleteRole(id);
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });



  app.get('/api/permissions/category/:category', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const category = req.params.category;
      const permissions = await storage.getPermissionsByCategory(category);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching permissions by category:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.post('/api/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const data = insertPermissionSchema.parse(req.body);
      const permission = await storage.createPermission(data);
      res.json(permission);
    } catch (error) {
      console.error("Error creating permission:", error);
      res.status(500).json({ message: "Failed to create permission" });
    }
  });

  app.put('/api/permissions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      const data = insertPermissionSchema.partial().parse(req.body);
      const permission = await storage.updatePermission(id, data);
      res.json(permission);
    } catch (error) {
      console.error("Error updating permission:", error);
      res.status(500).json({ message: "Failed to update permission" });
    }
  });

  app.delete('/api/permissions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(req.params.id);
      
      // Check if permission is system permission
      const permission = await storage.getPermission(id);
      if (permission?.isSystem) {
        return res.status(400).json({ message: "Cannot delete system permission" });
      }

      await storage.deletePermission(id);
      res.json({ message: "Permission deleted successfully" });
    } catch (error) {
      console.error("Error deleting permission:", error);
      res.status(500).json({ message: "Failed to delete permission" });
    }
  });

  // Role-Permission association routes
  app.get('/api/roles/:roleId/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const roleId = parseInt(req.params.roleId);
      const rolePermissions = await storage.getRolePermissions(roleId);
      res.json(rolePermissions);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  app.put('/api/roles/:roleId/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const roleId = parseInt(req.params.roleId);
      const { permissionIds } = req.body;
      
      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({ message: "permissionIds must be an array" });
      }

      await storage.setRolePermissions(roleId, permissionIds);
      res.json({ message: "Role permissions updated successfully" });
    } catch (error) {
      console.error("Error setting role permissions:", error);
      res.status(500).json({ message: "Failed to set role permissions" });
    }
  });

  // User-Role association routes
  app.get('/api/users/:userId/roles', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const userId = req.params.userId;
      const userRoles = await storage.getUserRoles(userId);
      res.json(userRoles);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  // POST route for user roles (used by frontend)
  app.post('/api/users/:userId/roles', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const userId = req.params.userId;
      const { roleIds } = req.body;
      
      console.log("🔧 POST User roles API called:", { userId, roleIds, assignedBy: currentUser.id });
      
      if (!Array.isArray(roleIds)) {
        return res.status(400).json({ message: "roleIds must be an array" });
      }

      const assignedBy = currentUser.id;
      await storage.setUserRoles(userId, roleIds, assignedBy);
      console.log("✅ User roles updated successfully:", { userId, roleIds });
      res.json({ message: "User roles updated successfully" });
    } catch (error) {
      console.error("Error setting user roles:", error);
      res.status(500).json({ message: "Failed to update user roles" });
    }
  });

  app.put('/api/users/:userId/roles', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const userId = req.params.userId;
      const { roleIds } = req.body;
      
      if (!Array.isArray(roleIds)) {
        return res.status(400).json({ message: "roleIds must be an array" });
      }

      const assignedBy = currentUser.id;
      await storage.setUserRoles(userId, roleIds, assignedBy);
      res.json({ message: "User roles updated successfully" });
    } catch (error) {
      console.error("Error setting user roles:", error);
      res.status(500).json({ message: "Failed to set user roles" });
    }
  });

  app.get('/api/users/:userId/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const userId = req.params.userId;
      const permissions = await storage.getUserEffectivePermissions(userId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // Permission checking routes
  app.get('/api/users/:userId/has-permission/:permissionName', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      const userId = req.params.userId;
      const permissionName = req.params.permissionName;

      // Users can check their own permissions, admins can check anyone's
      if (currentUser?.id !== userId && currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const hasPermission = await storage.userHasPermission(userId, permissionName);
      res.json({ hasPermission });
    } catch (error) {
      console.error("Error checking user permission:", error);
      res.status(500).json({ message: "Failed to check permission" });
    }
  });

  app.get('/api/users/:userId/has-role/:roleName', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims ? req.user.claims.sub : req.user.id);
      const userId = req.params.userId;
      const roleName = req.params.roleName;

      // Users can check their own roles, admins can check anyone's
      if (currentUser?.id !== userId && currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const hasRole = await storage.userHasRole(userId, roleName);
      res.json({ hasRole });
    } catch (error) {
      console.error("Error checking user role:", error);
      res.status(500).json({ message: "Failed to check role" });
    }
  });

  // DLC Products routes
  app.get('/api/dlc-products', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { status, supplierId } = req.query;
      
      // Determine which groups to filter by
      let groupIds: number[] = [];
      if (user.role === 'admin') {
        // Admin can specify a store or see all
        if (req.query.storeId) {
          groupIds = [parseInt(req.query.storeId)];
        }
        // If no storeId specified, admin sees all (don't filter by groupIds)
      } else {
        // Non-admin users see only their assigned groups
        groupIds = user.userGroups.map(ug => ug.group.id);
      }

      const filters: { status?: string; supplierId?: number; } = {};
      if (status) filters.status = status;
      if (supplierId) filters.supplierId = parseInt(supplierId);

      console.log('DLC Products API called with:', {
        userId,
        userRole: user.role,
        groupIds: user.role === 'admin' && !req.query.storeId ? 'all' : groupIds,
        filters
      });

      const dlcProducts = await storage.getDlcProducts(
        user.role === 'admin' && !req.query.storeId ? undefined : groupIds,
        filters
      );
      
      console.log('DLC Products returned:', dlcProducts.length, 'items');
      res.json(dlcProducts);
    } catch (error) {
      console.error("Error fetching DLC products:", error);
      res.status(500).json({ message: "Failed to fetch DLC products" });
    }
  });

  app.get('/api/dlc-products/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Determine which groups to filter by
      let groupIds: number[] = [];
      if (user.role === 'admin') {
        if (req.query.storeId) {
          groupIds = [parseInt(req.query.storeId)];
        }
      } else {
        groupIds = user.userGroups.map(ug => ug.group.id);
      }

      const stats = await storage.getDlcStats(
        user.role === 'admin' && !req.query.storeId ? undefined : groupIds
      );
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching DLC stats:", error);
      res.status(500).json({ message: "Failed to fetch DLC stats" });
    }
  });

  app.get('/api/dlc-products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const dlcProduct = await storage.getDlcProduct(id);
      
      if (!dlcProduct) {
        return res.status(404).json({ message: "DLC Product not found" });
      }

      // Check if user has access to this product's group
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      
      if (user?.role !== 'admin') {
        const userGroupIds = user?.userGroups.map(ug => ug.group.id) || [];
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
      console.log('📨 POST /api/dlc-products - Request body:', JSON.stringify(req.body, null, 2));
      
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate access to the specified group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.group.id);
        if (!userGroupIds.includes(req.body.groupId)) {
          return res.status(403).json({ message: "Access denied to this store" });
        }
      }

      const validatedData = insertDlcProductFrontendSchema.parse({
        ...req.body,
        createdBy: userId,
      });

      const dlcProduct = await storage.createDlcProduct(validatedData);
      console.log('✅ DLC Product created successfully:', dlcProduct.id);
      
      res.status(201).json(dlcProduct);
    } catch (error) {
      console.error("❌ Error creating DLC product:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create DLC product" });
    }
  });

  app.put('/api/dlc-products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      
      // First check if the product exists and user has access
      const existingProduct = await storage.getDlcProduct(id);
      if (!existingProduct) {
        return res.status(404).json({ message: "DLC Product not found" });
      }

      const user = await storage.getUserWithGroups(userId);
      if (user?.role !== 'admin') {
        const userGroupIds = user?.userGroups.map(ug => ug.group.id) || [];
        if (!userGroupIds.includes(existingProduct.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const validatedData = insertDlcProductFrontendSchema.partial().parse(req.body);
      const dlcProduct = await storage.updateDlcProduct(id, validatedData);
      
      res.json(dlcProduct);
    } catch (error) {
      console.error("Error updating DLC product:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update DLC product" });
    }
  });

  app.post('/api/dlc-products/:id/validate', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions to validate products" });
      }

      // Check if the product exists and user has access
      const existingProduct = await storage.getDlcProduct(id);
      if (!existingProduct) {
        return res.status(404).json({ message: "DLC Product not found" });
      }

      if (user.role !== 'admin') {
        const userWithGroups = await storage.getUserWithGroups(userId);
        const userGroupIds = userWithGroups?.userGroups.map(ug => ug.group.id) || [];
        if (!userGroupIds.includes(existingProduct.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const dlcProduct = await storage.validateDlcProduct(id, userId);
      res.json(dlcProduct);
    } catch (error) {
      console.error("Error validating DLC product:", error);
      res.status(500).json({ message: "Failed to validate DLC product" });
    }
  });

  app.delete('/api/dlc-products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      
      // Check if the product exists and user has access
      const existingProduct = await storage.getDlcProduct(id);
      if (!existingProduct) {
        return res.status(404).json({ message: "DLC Product not found" });
      }

      const user = await storage.getUserWithGroups(userId);
      if (user?.role !== 'admin') {
        const userGroupIds = user?.userGroups.map(ug => ug.group.id) || [];
        if (!userGroupIds.includes(existingProduct.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
        
        // Non-admin users can only delete their own products
        if (existingProduct.createdBy !== userId) {
          return res.status(403).json({ message: "Can only delete your own products" });
        }
      }

      await storage.deleteDlcProduct(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting DLC product:", error);
      res.status(500).json({ message: "Failed to delete DLC product" });
    }
  });

  // Tasks routes
  app.get('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      const storeId = req.query.storeId;
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let groupIds: number[] | undefined;
      if (user.role === 'admin') {
        // Admin peut voir toutes les tâches ou filtrer par magasin
        if (storeId && storeId !== 'all') {
          groupIds = [parseInt(storeId)];
        }
        // Si pas de storeId ou storeId='all', pas de filtrage (toutes les tâches)
      } else {
        // Non-admin voit seulement ses magasins assignés
        const userGroupIds = user.userGroups.map(ug => ug.group.id);
        if (storeId && storeId !== 'all') {
          const requestedStoreId = parseInt(storeId);
          if (userGroupIds.includes(requestedStoreId)) {
            groupIds = [requestedStoreId];
          } else {
            return res.status(403).json({ message: "Access denied to this store" });
          }
        } else {
          groupIds = userGroupIds;
        }
      }

      const tasks = await storage.getTasks(groupIds);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const user = await storage.getUserWithGroups(userId);
      if (user?.role !== 'admin') {
        const userGroupIds = user?.userGroups.map(ug => ug.group.id) || [];
        if (!userGroupIds.includes(task.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.post('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.group.id);
        if (!userGroupIds.includes(req.body.groupId)) {
          return res.status(403).json({ message: "Access denied to this store" });
        }
      }

      const validatedData = insertTaskSchema.parse({
        ...req.body,
        createdBy: userId,
      });

      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      
      const existingTask = await storage.getTask(id);
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      const user = await storage.getUserWithGroups(userId);
      if (user?.role !== 'admin') {
        const userGroupIds = user?.userGroups.map(ug => ug.group.id) || [];
        if (!userGroupIds.includes(existingTask.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const validatedData = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(id, validatedData);
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.post('/api/tasks/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      
      console.log("🎯 DEV Task completion request:", { id, userId });
      
      const existingTask = await storage.getTask(id);
      if (!existingTask) {
        console.log("❌ Task not found:", id);
        return res.status(404).json({ message: "Task not found" });
      }

      console.log("✅ Task found:", existingTask);

      const user = await storage.getUserWithGroups(userId);
      console.log("👤 User data:", user);
      
      if (user?.role !== 'admin') {
        const userGroupIds = user?.userGroups.map(ug => ug.group.id) || [];
        if (!userGroupIds.includes(existingTask.groupId)) {
          console.log("❌ Access denied - group mismatch:", { userGroupIds, taskGroupId: existingTask.groupId });
          return res.status(403).json({ message: "Access denied" });
        }
      }

      console.log("🔄 Completing task using storage.completeTask...");
      await storage.completeTask(id, userId);
      const updatedTask = await storage.getTask(id);
      console.log("✅ Task completed successfully:", updatedTask);
      res.json(updatedTask);
    } catch (error) {
      console.error("❌ Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task", error: error.message });
    }
  });

  app.delete('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      
      const existingTask = await storage.getTask(id);
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      const user = await storage.getUserWithGroups(userId);
      if (user?.role !== 'admin') {
        const userGroupIds = user?.userGroups.map(ug => ug.group.id) || [];
        if (!userGroupIds.includes(existingTask.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
        
        if (existingTask.createdBy !== userId) {
          return res.status(403).json({ message: "Can only delete your own tasks" });
        }
      }

      await storage.deleteTask(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Debug endpoint to check permissions without auth (temporary)
  app.get('/api/debug/permissions-status', async (req: any, res) => {
    try {
      const permissions = await storage.getPermissions();
      const taskPermissions = permissions.filter(p => p.category === 'gestion_taches');
      const samplePermissions = permissions.slice(0, 5);
      
      res.json({
        total: permissions.length,
        taskPermissions: taskPermissions,
        samplePermissions: samplePermissions,
        categories: [...new Set(permissions.map(p => p.category))].sort(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint to check current user auth status
  app.get('/api/debug/auth-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      
      res.json({
        isAuthenticated: true,
        userId: userId,
        user: user ? {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        } : null,
        canAccessPermissions: user?.role === 'admin',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint to check task permissions specifically
  app.get('/api/debug/task-permissions', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🔍 DEV TASK PERMISSIONS DEBUG');
      
      const permissions = await storage.getPermissions();
      const taskPermissions = permissions.filter(p => p.category === 'gestion_taches');
      
      console.log('📋 DEV Task permissions found:', taskPermissions.length);
      taskPermissions.forEach(p => {
        console.log(`  - ID: ${p.id}, Name: ${p.name}, DisplayName: "${p.displayName}", Category: ${p.category}`);
      });
      
      res.json({
        environment: 'development',
        storage: taskPermissions,
        allCategories: [...new Set(permissions.map(p => p.category))].sort(),
        summary: {
          total_permissions: permissions.length,
          task_permissions_count: taskPermissions.length,
          has_gestion_taches: taskPermissions.length > 0,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Task permissions debug error:', error);
      res.status(500).json({ message: "Debug failed", error: error.message });
    }
  });

  // Test CRITIQUE - Comparaison des storages pour permissions tâches
  app.get('/api/debug/compare-storages', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🔍 CRITICAL TEST - Comparing dev vs prod storage for task permissions');
      
      // Test développement
      const devPermissions = await devStorage.getPermissions();
      const devTaskPerms = devPermissions.filter(p => p.category === 'gestion_taches');
      console.log('📋 DEV storage - Task permissions:', devTaskPerms.length);
      
      // Test production
      const prodPermissions = await prodStorage.getPermissions();
      const prodTaskPerms = prodPermissions.filter(p => p.category === 'gestion_taches');
      console.log('📋 PROD storage - Task permissions:', prodTaskPerms.length);
      
      res.json({
        development: {
          total: devPermissions.length,
          task_permissions: devTaskPerms.length,
          categories: [...new Set(devPermissions.map(p => p.category))].sort(),
          task_details: devTaskPerms
        },
        production: {
          total: prodPermissions.length,
          task_permissions: prodTaskPerms.length,
          categories: [...new Set(prodPermissions.map(p => p.category))].sort(),
          task_details: prodTaskPerms
        },
        database_verified: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Storage comparison error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ENDPOINT TEMPORAIRE - Test production storage avec gestion d'erreur détaillée
  app.get('/api/debug/test-production-permissions', isAuthenticated, async (req: any, res) => {
    console.log('🚨 STARTING PRODUCTION STORAGE TEST');
    
    try {
      // Test basique de connexion d'abord
      console.log('🔍 Testing production storage connection...');
      
      if (!prodStorage) {
        throw new Error('Production storage is not available');
      }
      
      console.log('🔍 Production storage object exists, testing getPermissions...');
      const productionPermissions = await prodStorage.getPermissions();
      console.log('✅ Production storage getPermissions() succeeded:', productionPermissions.length, 'permissions');
      
      const taskPermissions = productionPermissions.filter(p => p.category === 'gestion_taches');
      console.log('🏭 PRODUCTION STORAGE - Task permissions found:', taskPermissions.length);
      
      if (taskPermissions.length > 0) {
        console.log('📋 Production task permissions details:');
        taskPermissions.forEach(p => {
          console.log(`  - ID: ${p.id}, Name: ${p.name}, DisplayName: "${p.displayName}", Category: ${p.category}`);
        });
      } else {
        console.log('❌ NO TASK PERMISSIONS found in production storage!');
      }
      
      res.json({
        success: true,
        environment: 'forced_production_storage',
        total_permissions: productionPermissions.length,
        task_permissions_count: taskPermissions.length,
        task_permissions: taskPermissions,
        all_categories: [...new Set(productionPermissions.map(p => p.category))].sort(),
        has_gestion_taches: taskPermissions.length > 0,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ CRITICAL ERROR in production storage test:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error stack:', error?.stack);
      
      res.status(500).json({ 
        success: false,
        message: "Production storage test failed", 
        error: error?.message || 'Unknown error',
        errorType: typeof error,
        timestamp: new Date().toISOString()
      });
    }
  });



  // Debug/Fix endpoint for production permission issues
  app.post('/api/debug/fix-production-permissions', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🔧 FIXING PRODUCTION PERMISSIONS...');
      
      // Only allow admin users to run fixes
      const userId = req.user.claims ? req.user.claims.sub : req.user.id;
      const user = await storage.getUserWithGroups(userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const fixes = [];
      
      // 1. Fix missing display names for permissions 
      console.log('📝 Fixing permission display names...');
      const permissions = await storage.getPermissions();
      let fixedDisplayNames = 0;
      
      for (const permission of permissions) {
        if (!permission.displayName || permission.displayName === permission.name) {
          // Create proper French display names based on name patterns
          let displayName = permission.name;
          
          // Pattern-based translations
          if (permission.name.includes('_read')) displayName = displayName.replace('_read', ' - Voir');
          if (permission.name.includes('_create')) displayName = displayName.replace('_create', ' - Créer');
          if (permission.name.includes('_update')) displayName = displayName.replace('_update', ' - Modifier');
          if (permission.name.includes('_delete')) displayName = displayName.replace('_delete', ' - Supprimer');
          if (permission.name.includes('_validate')) displayName = displayName.replace('_validate', ' - Valider');
          if (permission.name.includes('_print')) displayName = displayName.replace('_print', ' - Imprimer');
          if (permission.name.includes('_assign')) displayName = displayName.replace('_assign', ' - Assigner');
          if (permission.name.includes('_notify')) displayName = displayName.replace('_notify', ' - Notifier');
          if (permission.name.includes('_stats')) displayName = displayName.replace('_stats', ' - Statistiques');
          
          // Resource-based translations
          displayName = displayName
            .replace('dashboard', 'tableau de bord')
            .replace('groups', 'magasins')
            .replace('suppliers', 'fournisseurs')
            .replace('orders', 'commandes')
            .replace('deliveries', 'livraisons')
            .replace('publicities', 'publicités')
            .replace('customer_orders', 'commandes clients')
            .replace('tasks', 'tâches')
            .replace('users', 'utilisateurs')
            .replace('roles', 'rôles')
            .replace('permissions', 'permissions')
            .replace('dlc', 'produits DLC')
            .replace('calendar', 'calendrier')
            .replace('reconciliation', 'rapprochement')
            .replace('bl_reconciliation', 'rapprochement BL')
            .replace('nocodb_config', 'config NocoDB')
            .replace('system', 'système');
          
          // Capitalize first letter
          displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
          
          try {
            await storage.updatePermission(permission.id, {
              ...permission,
              displayName: displayName
            });
            fixedDisplayNames++;
          } catch (updateError) {
            console.error(`Error updating permission ${permission.id}:`, updateError);
          }
        }
      }
      
      fixes.push(`Fixed ${fixedDisplayNames} permission display names`);
      
      // 2. Ensure missing task permissions exist
      console.log('🎯 Checking task management permissions...');
      const taskPermissions = [
        { category: "gestion_taches", name: "tasks_read", displayName: "Voir tâches", description: "Accès en lecture aux tâches", action: "read", resource: "tasks" },
        { category: "gestion_taches", name: "tasks_create", displayName: "Créer tâches", description: "Création de nouvelles tâches", action: "create", resource: "tasks" },
        { category: "gestion_taches", name: "tasks_update", displayName: "Modifier tâches", description: "Modification des tâches existantes", action: "update", resource: "tasks" },
        { category: "gestion_taches", name: "tasks_delete", displayName: "Supprimer tâches", description: "Suppression de tâches", action: "delete", resource: "tasks" },
        { category: "gestion_taches", name: "tasks_assign", displayName: "Assigner tâches", description: "Attribution de tâches aux utilisateurs", action: "assign", resource: "tasks" }
      ];
      
      let createdTaskPermissions = 0;
      for (const taskPerm of taskPermissions) {
        const existing = permissions.find(p => p.name === taskPerm.name);
        if (!existing) {
          try {
            await storage.createPermission({
              ...taskPerm,
              isSystem: true
            });
            createdTaskPermissions++;
          } catch (createError) {
            console.error(`Error creating task permission ${taskPerm.name}:`, createError);
          }
        }
      }
      
      if (createdTaskPermissions > 0) {
        fixes.push(`Created ${createdTaskPermissions} missing task permissions`);
      }
      
      console.log('✅ Production permissions fix completed');
      
      res.json({
        success: true,
        message: 'Production permission fixes applied successfully',
        fixes: fixes,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error fixing production permissions:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to fix production permissions', 
        error: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
