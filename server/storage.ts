import {
  users,
  groups,
  suppliers,
  orders,
  deliveries,
  userGroups,
  publicities,
  publicityParticipations,
  customerOrders,
  dlcProducts,
  tasks,
  type User,
  type UpsertUser,
  type Group,
  type InsertGroup,
  type Supplier,
  type InsertSupplier,
  type Order,
  type InsertOrder,
  type Delivery,
  type InsertDelivery,
  type UserGroup,
  type InsertUserGroup,
  type OrderWithRelations,
  type DeliveryWithRelations,
  type UserWithGroups,
  type Publicity,
  type InsertPublicity,
  type PublicityParticipation,
  type InsertPublicityParticipation,
  type PublicityWithRelations,
  nocodbConfig,
  type NocodbConfig,
  type InsertNocodbConfig,
  type CustomerOrder,
  type InsertCustomerOrder,
  type CustomerOrderWithRelations,
  type DlcProduct,
  type InsertDlcProduct,
  type DlcProductFrontend,
  type InsertDlcProductFrontend,
  type DlcProductWithRelations,
  type Task,
  type InsertTask,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, desc, sql, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations - supports both Replit Auth and local auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserWithGroups(id: string): Promise<UserWithGroups | undefined>;
  getUsers(): Promise<User[]>;

  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
  // Group operations
  getGroups(): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  createGroup(group: InsertGroup): Promise<Group>;
  updateGroup(id: number, group: Partial<InsertGroup>): Promise<Group>;
  deleteGroup(id: number): Promise<void>;
  
  // Supplier operations
  getSuppliers(): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier>;
  deleteSupplier(id: number): Promise<void>;
  
  // Order operations
  getOrders(groupIds?: number[]): Promise<OrderWithRelations[]>;
  getOrdersByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<OrderWithRelations[]>;
  getOrder(id: number): Promise<OrderWithRelations | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order>;
  deleteOrder(id: number): Promise<void>;
  
  // Delivery operations
  getDeliveries(groupIds?: number[]): Promise<DeliveryWithRelations[]>;
  getDeliveriesByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<DeliveryWithRelations[]>;
  getDelivery(id: number): Promise<DeliveryWithRelations | undefined>;
  createDelivery(delivery: InsertDelivery): Promise<Delivery>;
  updateDelivery(id: number, delivery: Partial<InsertDelivery>): Promise<Delivery>;
  deleteDelivery(id: number): Promise<void>;
  validateDelivery(id: number, blData?: { blNumber: string; blAmount: number }): Promise<void>;
  
  // User-Group operations
  getUserGroups(userId: string): Promise<UserGroup[]>;
  assignUserToGroup(userGroup: InsertUserGroup): Promise<UserGroup>;
  removeUserFromGroup(userId: string, groupId: number): Promise<void>;
  
  // Statistics
  getMonthlyStats(year: number, month: number, groupIds?: number[]): Promise<{
    ordersCount: number;
    deliveriesCount: number;
    pendingOrdersCount: number;
    averageDeliveryTime: number;
    totalPalettes: number;
    totalPackages: number;
  }>;

  // Publicity operations
  getPublicities(year?: number, groupIds?: number[]): Promise<PublicityWithRelations[]>;
  getPublicity(id: number): Promise<PublicityWithRelations | undefined>;
  createPublicity(publicity: InsertPublicity): Promise<Publicity>;
  updatePublicity(id: number, publicity: Partial<InsertPublicity>): Promise<Publicity>;
  deletePublicity(id: number): Promise<void>;
  
  // Publicity participation operations
  getPublicityParticipations(publicityId: number): Promise<PublicityParticipation[]>;
  setPublicityParticipations(publicityId: number, groupIds: number[]): Promise<void>;


  
  // NocoDB Configuration operations
  getNocodbConfigs(): Promise<NocodbConfig[]>;
  getNocodbConfig(id: number): Promise<NocodbConfig | undefined>;
  createNocodbConfig(config: InsertNocodbConfig): Promise<NocodbConfig>;
  updateNocodbConfig(id: number, config: Partial<InsertNocodbConfig>): Promise<NocodbConfig>;
  deleteNocodbConfig(id: number): Promise<void>;
  
  // Customer Order operations
  getCustomerOrders(groupIds?: number[]): Promise<CustomerOrderWithRelations[]>;
  getCustomerOrder(id: number): Promise<CustomerOrderWithRelations | undefined>;
  createCustomerOrder(customerOrder: InsertCustomerOrder): Promise<CustomerOrder>;
  updateCustomerOrder(id: number, customerOrder: Partial<InsertCustomerOrder>): Promise<CustomerOrder>;
  deleteCustomerOrder(id: number): Promise<void>;

  // DLC Product operations
  getDlcProducts(groupIds?: number[], filters?: { status?: string; supplierId?: number; }): Promise<DlcProductWithRelations[]>;
  getDlcProduct(id: number): Promise<DlcProductWithRelations | undefined>;
  createDlcProduct(dlcProduct: InsertDlcProductFrontend): Promise<DlcProductFrontend>;
  updateDlcProduct(id: number, dlcProduct: Partial<InsertDlcProductFrontend>): Promise<DlcProductFrontend>;
  deleteDlcProduct(id: number): Promise<void>;
  validateDlcProduct(id: number, validatedBy: string): Promise<DlcProductFrontend>;
  getDlcStats(groupIds?: number[]): Promise<{ active: number; expiringSoon: number; expired: number; }>;




  // Task operations
  getTasks(groupIds?: number[]): Promise<any[]>;
  getTasksByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<any[]>;
  getTask(id: number): Promise<any | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  completeTask(id: number, completedBy?: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserWithGroups(id: string): Promise<UserWithGroups | undefined> {
    console.log(`🔍 getUserWithGroups called for user: ${id}`);
    
    // Get the user first
    const user = await this.getUser(id);
    if (!user) {
      console.log(`❌ User ${id} not found`);
      return undefined;
    }

    // Fixed: Use manual SQL to avoid userGroups.createdAt column that doesn't exist
    try {
      console.log(`🔍 Querying user_groups for user: ${id}`);
      const result = await db.execute(sql`
        SELECT 
          ug.user_id,
          ug.group_id,
          g.id as group_id_ref,
          g.name as group_name,
          g.color as group_color,
          g.nocodb_config_id,
          g.nocodb_table_id,
          g.nocodb_table_name,
          g.invoice_column_name,
          g.created_at as group_created_at,
          g.updated_at as group_updated_at
        FROM user_groups ug
        INNER JOIN groups g ON ug.group_id = g.id
        WHERE ug.user_id = ${id}
      `);

      console.log(`🔍 Found ${result.rows.length} group assignments for user ${id}`);
      console.log(`🔍 Raw query result:`, result.rows);

      const userGroupsData = result.rows.map((row: any) => ({
        userId: row.user_id,
        groupId: row.group_id,
        createdAt: null, // Avoid the problematic column
        group: {
          id: row.group_id_ref,
          name: row.group_name,
          color: row.group_color,
          nocodbConfigId: row.nocodb_config_id,
          nocodbTableId: row.nocodb_table_id,
          nocodbTableName: row.nocodb_table_name,
          invoiceColumnName: row.invoice_column_name,
          createdAt: row.group_created_at,
          updatedAt: row.group_updated_at,
        }
      }));

      console.log(`✅ Processed ${userGroupsData.length} groups for user ${id}`);

      return {
        ...user,
        userGroups: userGroupsData,
      };
    } catch (error) {
      console.error('❌ getUserWithGroups error:', error);
      console.error('❌ Error details:', error?.code, error?.message);
      // Fallback: return user with empty groups
      return {
        ...user,
        userGroups: [],
      };
    }
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersWithRoles(): Promise<UserWithRoles[]> {
    const baseUsers = await this.getUsers();
    const usersWithRoles = await Promise.all(
      baseUsers.map(async (user) => {
        const userWithRoles = await this.getUserWithRoles(user.id);
        return userWithRoles || { ...user, userRoles: [] };
      })
    );
    return usersWithRoles;
  }

  async getUsersWithRolesAndGroups(): Promise<(UserWithRoles & { userGroups: any[] })[]> {
    console.log('🔍 getUsersWithRolesAndGroups called');
    const baseUsers = await this.getUsers();
    console.log('📊 Base users found:', baseUsers.length);
    
    const usersWithRolesAndGroups = await Promise.all(
      baseUsers.map(async (user) => {
        console.log(`🔍 Processing user: ${user.username}`);
        const userWithRoles = await this.getUserWithRoles(user.id);
        const userWithGroups = await this.getUserWithGroups(user.id);
        
        console.log(`📊 User ${user.username} groups:`, userWithGroups?.userGroups?.length || 0);
        
        return {
          ...user,
          userRoles: userWithRoles?.userRoles || [],
          userGroups: userWithGroups?.userGroups || [],
          roles: userWithRoles?.userRoles?.map(ur => ur.role) || []
        };
      })
    );
    
    console.log('🔍 Final users with roles and groups:', usersWithRolesAndGroups.length);
    return usersWithRolesAndGroups;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    console.log('🔍 Storage createUser called with:', userData.username);
    try {
      const [user] = await db
        .insert(users)
        .values({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      console.log('✅ Storage createUser successful:', user.username);
      return user;
    } catch (error) {
      console.error('❌ Storage createUser error:', error);
      console.error('❌ Storage error code:', error.code);
      console.error('❌ Storage error constraint:', error.constraint);
      throw error;
    }
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    console.log('🔍 Storage updateUser called for:', id);
    console.log('🔍 Update data:', userData);
    try {
      const [user] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      console.log('✅ Storage updateUser successful:', user.username);
      return user;
    } catch (error) {
      console.error('❌ Storage updateUser error:', error);
      console.error('❌ Storage error code:', error.code);
      console.error('❌ Storage error constraint:', error.constraint);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    // Use a transaction to ensure atomicity
    await db.transaction(async (tx: typeof db) => {
      // Find admin_local or fallback to any admin user to transfer ownership to
      let adminUser = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, "admin_local"))
        .limit(1);
      
      // If admin_local doesn't exist, find any admin user
      if (adminUser.length === 0) {
        adminUser = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, "admin"))
          .limit(1);
      }
      
      if (adminUser.length === 0) {
        throw new Error("Cannot delete user: No admin user found to transfer ownership to");
      }
      
      const adminUserId = adminUser[0].id;
      
      // Update customer orders
      await tx
        .update(customerOrders)
        .set({ createdBy: adminUserId })
        .where(eq(customerOrders.createdBy, id));
      
      // Update orders
      await tx
        .update(orders)
        .set({ createdBy: adminUserId })
        .where(eq(orders.createdBy, id));
        
      // Update deliveries
      await tx
        .update(deliveries)
        .set({ createdBy: adminUserId })
        .where(eq(deliveries.createdBy, id));
        
      // Update publicities
      await tx
        .update(publicities)
        .set({ createdBy: adminUserId })
        .where(eq(publicities.createdBy, id));
        
      // Update DLC products
      await tx
        .update(dlcProducts)
        .set({ createdBy: adminUserId })
        .where(eq(dlcProducts.createdBy, id));
        
      // Update tasks
      await tx
        .update(tasks)
        .set({ createdBy: adminUserId })
        .where(eq(tasks.createdBy, id));
        
      // Update NocoDB configs
      await tx
        .update(nocodbConfig)
        .set({ createdBy: adminUserId })
        .where(eq(nocodbConfig.createdBy, id));
        
      // Update database backups if the table exists (production feature)
      try {
        await tx.execute(sql`
          UPDATE database_backups 
          SET created_by = ${adminUserId} 
          WHERE created_by = ${id}
        `);
      } catch (error) {
        // Table might not exist in development, ignore the error
        console.log('Note: database_backups table not found or accessible');
      }
      
      // Update role assignments made BY this user (assignedBy field)
      await tx
        .update(userRoles)
        .set({ assignedBy: adminUserId })
        .where(eq(userRoles.assignedBy, id));
      
      // Delete user-group assignments
      await tx.delete(userGroups).where(eq(userGroups.userId, id));
      
      // Delete user-role assignments TO this user
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      
      // Finally delete the user
      await tx.delete(users).where(eq(users.id, id));
    });
  }

  // Group operations
  async getGroups(): Promise<Group[]> {
    return await db.select().from(groups).orderBy(groups.name);
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const [newGroup] = await db.insert(groups).values(group).returning();
    return newGroup;
  }

  async updateGroup(id: number, group: Partial<InsertGroup>): Promise<Group> {
    const [updatedGroup] = await db
      .update(groups)
      .set({ ...group, updatedAt: new Date() })
      .where(eq(groups.id, id))
      .returning();
    return updatedGroup;
  }

  async deleteGroup(id: number): Promise<void> {
    await db.delete(groups).where(eq(groups.id, id));
  }

  // Supplier operations
  async getSuppliers(dlcOnly: boolean = false): Promise<Supplier[]> {
    if (dlcOnly) {
      return await db.select().from(suppliers).where(eq(suppliers.hasDlc, true)).orderBy(suppliers.name);
    }
    return await db.select().from(suppliers).orderBy(suppliers.name);
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db.insert(suppliers).values(supplier).returning();
    return newSupplier;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier> {
    const [updatedSupplier] = await db
      .update(suppliers)
      .set({ ...supplier, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return updatedSupplier;
  }

  async deleteSupplier(id: number): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  }

  // Order operations
  async getOrders(groupIds?: number[]): Promise<OrderWithRelations[]> {
    const ordersQuery = db.query.orders.findMany({
      with: {
        supplier: true,
        group: true,
        creator: true,
        deliveries: true,
      },
      orderBy: [desc(orders.createdAt)],
      where: groupIds ? inArray(orders.groupId, groupIds) : undefined,
    });
    
    return await ordersQuery;
  }

  async getOrdersByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<OrderWithRelations[]> {
    const whereCondition = groupIds 
      ? and(
          gte(orders.plannedDate, startDate),
          lte(orders.plannedDate, endDate),
          inArray(orders.groupId, groupIds)
        )
      : and(
          gte(orders.plannedDate, startDate),
          lte(orders.plannedDate, endDate)
        );

    return await db.query.orders.findMany({
      with: {
        supplier: true,
        group: true,
        creator: true,
        deliveries: true,
      },
      where: whereCondition,
      orderBy: [desc(orders.createdAt)],
    });
  }

  async getOrder(id: number): Promise<OrderWithRelations | undefined> {
    return await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        supplier: true,
        group: true,
        creator: true,
        deliveries: true,
      },
    });
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }

  // Delivery operations
  async getDeliveries(groupIds?: number[]): Promise<DeliveryWithRelations[]> {
    const results = await db.query.deliveries.findMany({
      with: {
        supplier: true,
        group: true,
        creator: true,
        order: true,
      },
      orderBy: [desc(deliveries.createdAt)],
      where: groupIds ? inArray(deliveries.groupId, groupIds) : undefined,
    });
    
    return results.map((result: any) => ({
      ...result,
      order: result.order || undefined,
    }));
  }

  async getDeliveriesByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<DeliveryWithRelations[]> {
    const whereCondition = groupIds 
      ? and(
          gte(deliveries.scheduledDate, startDate),
          lte(deliveries.scheduledDate, endDate),
          inArray(deliveries.groupId, groupIds)
        )
      : and(
          gte(deliveries.scheduledDate, startDate),
          lte(deliveries.scheduledDate, endDate)
        );

    const results = await db.query.deliveries.findMany({
      with: {
        supplier: true,
        group: true,
        creator: true,
        order: true,
      },
      where: whereCondition,
      orderBy: [desc(deliveries.createdAt)],
    });
    
    return results.map((result: any) => ({
      ...result,
      order: result.order || undefined,
    }));
  }

  async getDelivery(id: number): Promise<DeliveryWithRelations | undefined> {
    const result = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, id),
      with: {
        supplier: true,
        group: true,
        creator: true,
        order: true,
      },
    });
    
    if (!result) return undefined;
    
    return {
      ...result,
      order: result.order || undefined,
    };
  }

  async createDelivery(delivery: InsertDelivery): Promise<Delivery> {
    const [newDelivery] = await db.insert(deliveries).values(delivery).returning();
    
    // Si la livraison est liée à une commande, mettre à jour le statut de la commande
    if (newDelivery.orderId) {
      await db
        .update(orders)
        .set({ status: 'planned' })
        .where(eq(orders.id, newDelivery.orderId));
    }
    
    return newDelivery;
  }

  async updateDelivery(id: number, delivery: Partial<InsertDelivery>): Promise<Delivery> {
    const [updatedDelivery] = await db
      .update(deliveries)
      .set({ ...delivery, updatedAt: new Date() })
      .where(eq(deliveries.id, id))
      .returning();
    return updatedDelivery;
  }

  async deleteDelivery(id: number): Promise<void> {
    // Récupérer la livraison avant suppression pour connaître la commande liée
    const delivery = await this.getDelivery(id);
    
    // Supprimer la livraison
    await db.delete(deliveries).where(eq(deliveries.id, id));
    
    // Si la livraison était liée à une commande, gérer le statut de la commande
    if (delivery?.orderId) {
      // Vérifier s'il reste d'autres livraisons liées à cette commande
      const remainingDeliveries = await db
        .select()
        .from(deliveries)
        .where(eq(deliveries.orderId, delivery.orderId));
      
      if (remainingDeliveries.length === 0) {
        // Plus aucune livraison liée : remettre la commande en "pending"
        await db
          .update(orders)
          .set({ 
            status: 'pending',
            updatedAt: new Date()
          })
          .where(eq(orders.id, delivery.orderId));
      }
    }
  }

  async validateDelivery(id: number, blData?: { blNumber: string; blAmount: number }): Promise<void> {
    const delivery = await this.getDelivery(id);
    if (!delivery) throw new Error("Delivery not found");
    
    const now = new Date();
    
    // Prepare update data
    const updateData: any = { 
      status: "delivered",
      deliveredDate: now,
      validatedAt: now,
      updatedAt: now
    };
    
    // Add BL data if provided
    if (blData && blData.blNumber && blData.blAmount !== undefined) {
      updateData.blNumber = blData.blNumber;
      updateData.blAmount = blData.blAmount.toString();
    }
    
    // Update delivery status and set delivered date
    await db
      .update(deliveries)
      .set(updateData)
      .where(eq(deliveries.id, id));
    
    // Update linked order status if exists
    if (delivery.orderId) {
      await db
        .update(orders)
        .set({ 
          status: "delivered",
          updatedAt: now
        })
        .where(eq(orders.id, delivery.orderId));
    }
  }

  // User-Group operations
  async getUserGroups(userId: string): Promise<UserGroup[]> {
    return await db.select().from(userGroups).where(eq(userGroups.userId, userId));
  }

  async assignUserToGroup(userGroup: InsertUserGroup): Promise<UserGroup> {
    try {
      // Try with full schema first (development)
      const [newUserGroup] = await db.insert(userGroups).values(userGroup).returning();
      return newUserGroup;
    } catch (error: any) {
      // If created_at column doesn't exist (production), use raw SQL
      if (error?.code === '42703' && error?.message?.includes('created_at')) {
        console.log('⚠️ Production mode: user_groups table missing created_at column, using raw SQL');
        
        // Use raw SQL to insert without created_at column
        await db.execute(sql`
          INSERT INTO user_groups (user_id, group_id) 
          VALUES (${userGroup.userId}, ${userGroup.groupId})
          ON CONFLICT DO NOTHING
        `);
        
        // Return a UserGroup object with null created_at
        return {
          userId: userGroup.userId,
          groupId: userGroup.groupId,
          createdAt: null
        };
      }
      throw error;
    }
  }

  async removeUserFromGroup(userId: string, groupId: number): Promise<void> {
    await db.delete(userGroups).where(
      and(
        eq(userGroups.userId, userId),
        eq(userGroups.groupId, groupId)
      )
    );
  }

  // Statistics
  async getMonthlyStats(year: number, month: number, groupIds?: number[]): Promise<{
    ordersCount: number;
    deliveriesCount: number;
    pendingOrdersCount: number;
    averageDeliveryTime: number;
    totalPalettes: number;
    totalPackages: number;
  }> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

    // Build where conditions
    const orderWhere = groupIds 
      ? and(
          gte(orders.plannedDate, startDate),
          lte(orders.plannedDate, endDate),
          inArray(orders.groupId, groupIds)
        )
      : and(
          gte(orders.plannedDate, startDate),
          lte(orders.plannedDate, endDate)
        );

    const deliveryWhere = groupIds 
      ? and(
          gte(deliveries.scheduledDate, startDate),
          lte(deliveries.scheduledDate, endDate),
          inArray(deliveries.groupId, groupIds)
        )
      : and(
          gte(deliveries.scheduledDate, startDate),
          lte(deliveries.scheduledDate, endDate)
        );

    // Get counts and totals
    const [orderStats] = await db
      .select({
        count: sql<number>`count(*)`,
        pendingCount: sql<number>`count(*) filter (where status = 'pending')`,
        totalPalettes: sql<number>`sum(case when unit = 'palettes' then quantity else 0 end)`,
        totalPackages: sql<number>`sum(case when unit = 'colis' then quantity else 0 end)`,
      })
      .from(orders)
      .where(orderWhere);

    const [deliveryStats] = await db
      .select({
        count: sql<number>`count(*)`,
        totalPalettes: sql<number>`sum(case when unit = 'palettes' then quantity else 0 end)`,
        totalPackages: sql<number>`sum(case when unit = 'colis' then quantity else 0 end)`,
      })
      .from(deliveries)
      .where(deliveryWhere);

    // Calculate average delivery time
    const deliveredOrders = await db
      .select({
        plannedDate: orders.plannedDate,
        deliveredDate: deliveries.deliveredDate,
      })
      .from(orders)
      .innerJoin(deliveries, eq(orders.id, deliveries.orderId))
      .where(
        and(
          orderWhere,
          eq(deliveries.status, 'delivered')
        )
      );

    let averageDeliveryTime = 0;
    if (deliveredOrders.length > 0) {
      const totalDelayDays = deliveredOrders.reduce((sum: any, order: any) => {
        if (order.deliveredDate && order.plannedDate) {
          const planned = new Date(order.plannedDate);
          const delivered = new Date(order.deliveredDate);
          const diffTime = delivered.getTime() - planned.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return sum + diffDays;
        }
        return sum;
      }, 0);
      averageDeliveryTime = totalDelayDays / deliveredOrders.length;
    }

    return {
      ordersCount: orderStats?.count || 0,
      deliveriesCount: deliveryStats?.count || 0,
      pendingOrdersCount: orderStats?.pendingCount || 0,
      averageDeliveryTime: Math.round(averageDeliveryTime * 10) / 10,
      totalPalettes: (orderStats?.totalPalettes || 0) + (deliveryStats?.totalPalettes || 0),
      totalPackages: (orderStats?.totalPackages || 0) + (deliveryStats?.totalPackages || 0),
    };
  }

  // Publicity operations
  async getPublicities(year?: number, groupIds?: number[]): Promise<PublicityWithRelations[]> {
    const query = db.select({
      id: publicities.id,
      pubNumber: publicities.pubNumber,
      designation: publicities.designation,
      startDate: publicities.startDate,
      endDate: publicities.endDate,
      year: publicities.year,
      createdBy: publicities.createdBy,
      createdAt: publicities.createdAt,
      updatedAt: publicities.updatedAt,
      creator: {
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role
      }
    })
    .from(publicities)
    .innerJoin(users, eq(publicities.createdBy, users.id))
    .orderBy(desc(publicities.createdAt));

    if (year) {
      query.where(eq(publicities.year, year));
    }

    const results = await query;
    
    // Récupérer les participations séparément
    const publicityIds = results.map((pub: any) => pub.id);
    const participations = publicityIds.length > 0 ? await db.select({
      publicityId: publicityParticipations.publicityId,
      groupId: publicityParticipations.groupId,
      group: {
        id: groups.id,
        name: groups.name,
        color: groups.color
      }
    })
    .from(publicityParticipations)
    .innerJoin(groups, eq(publicityParticipations.groupId, groups.id))
    .where(inArray(publicityParticipations.publicityId, publicityIds)) : [];

    // Associer les participations aux publicités
    return results.map((pub: any) => ({
      ...pub,
      participations: participations
        .filter((p: any) => p.publicityId === pub.id)
        .map((p: any) => ({ 
          publicityId: p.publicityId, 
          groupId: p.groupId, 
          group: p.group,
          createdAt: new Date()
        }))
    })) as PublicityWithRelations[];
  }

  async getPublicity(id: number): Promise<PublicityWithRelations | undefined> {
    const publicity = await db.select({
      id: publicities.id,
      pubNumber: publicities.pubNumber,
      designation: publicities.designation,
      startDate: publicities.startDate,
      endDate: publicities.endDate,
      year: publicities.year,
      createdBy: publicities.createdBy,
      createdAt: publicities.createdAt,
      updatedAt: publicities.updatedAt,
      creator: {
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role
      }
    })
    .from(publicities)
    .innerJoin(users, eq(publicities.createdBy, users.id))
    .where(eq(publicities.id, id))
    .limit(1);

    if (publicity.length === 0) return undefined;

    const participations = await db.select({
      publicityId: publicityParticipations.publicityId,
      groupId: publicityParticipations.groupId,
      group: {
        id: groups.id,
        name: groups.name,
        color: groups.color
      }
    })
    .from(publicityParticipations)
    .innerJoin(groups, eq(publicityParticipations.groupId, groups.id))
    .where(eq(publicityParticipations.publicityId, id));

    return {
      ...publicity[0],
      participations: participations.map((p: any) => ({ 
        publicityId: p.publicityId, 
        groupId: p.groupId, 
        group: p.group,
        createdAt: new Date()
      }))
    } as PublicityWithRelations;
  }

  async createPublicity(publicity: InsertPublicity): Promise<Publicity> {
    const [newPublicity] = await db.insert(publicities).values(publicity).returning();
    return newPublicity;
  }

  async updatePublicity(id: number, publicity: Partial<InsertPublicity>): Promise<Publicity> {
    const [updatedPublicity] = await db.update(publicities)
      .set({ ...publicity, updatedAt: new Date() })
      .where(eq(publicities.id, id))
      .returning();
    return updatedPublicity;
  }

  async deletePublicity(id: number): Promise<void> {
    await db.delete(publicities).where(eq(publicities.id, id));
  }

  async getPublicityParticipations(publicityId: number): Promise<PublicityParticipation[]> {
    return await db.select()
      .from(publicityParticipations)
      .where(eq(publicityParticipations.publicityId, publicityId));
  }

  async setPublicityParticipations(publicityId: number, groupIds: number[]): Promise<void> {
    // Supprimer les participations existantes
    await db.delete(publicityParticipations)
      .where(eq(publicityParticipations.publicityId, publicityId));

    // Ajouter les nouvelles participations
    if (groupIds.length > 0) {
      const participations = groupIds.map(groupId => ({
        publicityId,
        groupId
      }));
      await db.insert(publicityParticipations).values(participations);
    }
  }





  // NocoDB Configuration operations
  async getNocodbConfigs(): Promise<NocodbConfig[]> {
    return await db.select({
      id: nocodbConfig.id,
      name: nocodbConfig.name,
      baseUrl: nocodbConfig.baseUrl,
      projectId: nocodbConfig.projectId,
      apiToken: nocodbConfig.apiToken,
      description: nocodbConfig.description,
      isActive: nocodbConfig.isActive,
      createdBy: nocodbConfig.createdBy,
      createdAt: nocodbConfig.createdAt,
      updatedAt: nocodbConfig.updatedAt,
    }).from(nocodbConfig).orderBy(desc(nocodbConfig.createdAt));
  }

  async getNocodbConfig(id: number): Promise<NocodbConfig | undefined> {
    const configs = await db.select({
      id: nocodbConfig.id,
      name: nocodbConfig.name,
      baseUrl: nocodbConfig.baseUrl,
      projectId: nocodbConfig.projectId,
      apiToken: nocodbConfig.apiToken,
      description: nocodbConfig.description,
      isActive: nocodbConfig.isActive,
      createdBy: nocodbConfig.createdBy,
      createdAt: nocodbConfig.createdAt,
      updatedAt: nocodbConfig.updatedAt,
    }).from(nocodbConfig).where(eq(nocodbConfig.id, id));
    return configs[0];
  }

  async createNocodbConfig(config: InsertNocodbConfig): Promise<NocodbConfig> {
    const [newConfig] = await db.insert(nocodbConfig).values(config).returning();
    return newConfig;
  }

  async updateNocodbConfig(id: number, config: Partial<InsertNocodbConfig>): Promise<NocodbConfig> {
    const [updatedConfig] = await db.update(nocodbConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(nocodbConfig.id, id))
      .returning();
    return updatedConfig;
  }

  async deleteNocodbConfig(id: number): Promise<void> {
    await db.delete(nocodbConfig).where(eq(nocodbConfig.id, id));
  }

  // Customer Order operations
  async getCustomerOrders(groupIds?: number[]): Promise<CustomerOrderWithRelations[]> {
    try {
      let whereClause = "";
      if (groupIds && groupIds.length > 0) {
        whereClause = `WHERE co.group_id IN (${groupIds.join(',')})`;
      }
      
      const result = await db.execute(sql`
        SELECT 
          co.*,
          g.id as group_id_ref, g.name as group_name, g.color as group_color,
          u.id as creator_id_ref, u.username as creator_username, u.email as creator_email, 
          u.first_name, u.last_name, u.role as creator_role,
          s.id as supplier_id_ref, s.name as supplier_name, s.contact as supplier_contact, s.phone as supplier_phone
        FROM customer_orders co
        LEFT JOIN groups g ON co.group_id = g.id
        LEFT JOIN users u ON co.created_by = u.id
        LEFT JOIN suppliers s ON co.supplier_id = s.id
        ${whereClause ? sql.raw(whereClause) : sql.raw('')}
        ORDER BY co.created_at DESC
      `);

      return result.rows.map((row: any) => ({
        id: row.id as number,
        orderTaker: row.order_taker as string,
        customerName: row.customer_name as string,
        customerPhone: row.customer_phone as string,
        customerEmail: row.customer_email as string | null,
        productDesignation: row.product_designation as string,
        productReference: row.product_reference as string | null,
        gencode: row.gencode as string,
        quantity: row.quantity as number,
        supplierId: row.supplier_id as number,
        status: row.status as string,
        deposit: row.deposit as number,
        isPromotionalPrice: row.is_promotional_price as boolean | null,
        customerNotified: row.customer_notified as boolean | null,
        groupId: row.group_id as number,
        createdBy: row.created_by as string,
        createdAt: row.created_at as Date | null,
        updatedAt: row.updated_at as Date | null,
        group: {
          id: row.group_id_ref as number,
          name: row.group_name as string,
          color: row.group_color as string,
          createdAt: null,
          updatedAt: null,
          nocodbConfigId: null,
          nocodbTableId: null,
          nocodbTableName: null,
          invoiceColumnName: null,
        },
        creator: {
          id: row.creator_id_ref as string,
          username: row.creator_username as string | null,
          email: row.creator_email as string | null,
          firstName: row.first_name as string | null,
          lastName: row.last_name as string | null,
          role: row.creator_role as string,
        },
        supplier: {
          id: row.supplier_id_ref as number,
          name: row.supplier_name as string,
          contact: row.supplier_contact as string,
          phone: row.supplier_phone as string,
        },
      })) as unknown as CustomerOrderWithRelations[];
    } catch (error) {
      console.error("Error in getCustomerOrders:", error);
      return [];
    }
  }

  async getCustomerOrder(id: number): Promise<CustomerOrderWithRelations | undefined> {
    try {
      const result = await db.execute(sql`
        SELECT 
          co.*,
          g.id as group_id_ref, g.name as group_name, g.color as group_color,
          u.id as creator_id_ref, u.username as creator_username, u.email as creator_email, 
          u.first_name, u.last_name, u.role as creator_role
        FROM customer_orders co
        LEFT JOIN groups g ON co.group_id = g.id
        LEFT JOIN users u ON co.created_by = u.id
        WHERE co.id = ${id}
      `);

      if (result.rows.length === 0) return undefined;

      const row = result.rows[0];
      return {
        id: row.id as number,
        orderTaker: row.order_taker as string,
        customerName: row.customer_name as string,
        customerPhone: row.customer_phone as string,
        customerEmail: row.customer_email as string | null,
        productDesignation: row.product_designation as string,
        productReference: row.product_reference as string | null,
        gencode: row.gencode as string,
        quantity: row.quantity as number,
        supplierId: row.supplier_id as number,
        status: row.status as string,
        deposit: row.deposit as number,
        isPromotionalPrice: row.is_promotional_price as boolean | null,
        customerNotified: row.customer_notified as boolean | null,
        groupId: row.group_id as number,
        createdBy: row.created_by as string,
        createdAt: row.created_at as Date | null,
        updatedAt: row.updated_at as Date | null,
        group: {
          id: row.group_id_ref as number,
          name: row.group_name as string,
          color: row.group_color as string,
          createdAt: null,
          updatedAt: null,
          nocodbConfigId: null,
          nocodbTableId: null,
          nocodbTableName: null,
          invoiceColumnName: null,
        },
        creator: {
          id: row.creator_id_ref as string,
          username: row.creator_username as string | null,
          email: row.creator_email as string | null,
          firstName: row.first_name as string | null,
          lastName: row.last_name as string | null,
          role: row.creator_role as string,
        },
        supplier: {
          id: row.supplier_id as number,
          name: row.supplier_name as string,
          contact: row.supplier_contact as string,
          phone: row.supplier_phone as string,
        },
      } as unknown as CustomerOrderWithRelations;
    } catch (error) {
      console.error("Error in getCustomerOrder:", error);
      return undefined;
    }
  }

  async createCustomerOrder(customerOrderData: InsertCustomerOrder): Promise<CustomerOrder> {
    const [customerOrder] = await db
      .insert(customerOrders)
      .values({
        ...customerOrderData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return customerOrder;
  }

  async updateCustomerOrder(id: number, customerOrderData: Partial<InsertCustomerOrder>): Promise<CustomerOrder> {
    const [customerOrder] = await db
      .update(customerOrders)
      .set({
        ...customerOrderData,
        updatedAt: new Date(),
      })
      .where(eq(customerOrders.id, id))
      .returning();
    return customerOrder;
  }

  async deleteCustomerOrder(id: number): Promise<void> {
    await db.delete(customerOrders).where(eq(customerOrders.id, id));
  }

  // ===== DLC PRODUCTS OPERATIONS =====

  async getDlcProducts(groupIds?: number[], filters?: { status?: string; supplierId?: number; }): Promise<DlcProductWithRelations[]> {
    try {
      let whereClause = "";
      const conditions: string[] = [];
      
      if (groupIds && groupIds.length > 0) {
        conditions.push(`dlc.group_id IN (${groupIds.join(',')})`);
      }
      
      if (filters?.status) {
        if (filters.status === 'expires_soon') {
          conditions.push(`dlc.status != 'valides' AND dlc.expiry_date <= NOW() + INTERVAL '15 days' AND dlc.expiry_date > NOW()`);
        } else if (filters.status === 'expires') {
          conditions.push(`dlc.status != 'valides' AND dlc.expiry_date <= NOW()`);
        } else if (filters.status === 'en_cours') {
          conditions.push(`dlc.status != 'valides' AND dlc.expiry_date > NOW() + INTERVAL '15 days'`);
        } else {
          conditions.push(`dlc.status = '${filters.status}'`);
        }
      }
      
      if (filters?.supplierId) {
        conditions.push(`dlc.supplier_id = ${filters.supplierId}`);
      }
      
      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }
      
      const result = await db.execute(sql`
        SELECT 
          dlc.*,
          g.id as group_id_ref, g.name as group_name, g.color as group_color,
          u.id as creator_id_ref, u.username as creator_username, u.email as creator_email, 
          u.first_name, u.last_name, u.role as creator_role,
          v.id as validator_id_ref, v.username as validator_username, v.email as validator_email,
          v.first_name as validator_first_name, v.last_name as validator_last_name,
          s.id as supplier_id_ref, s.name as supplier_name, s.contact as supplier_contact, s.phone as supplier_phone
        FROM dlc_products dlc
        LEFT JOIN groups g ON dlc.group_id = g.id
        LEFT JOIN users u ON dlc.created_by = u.id
        LEFT JOIN users v ON dlc.validated_by = v.id
        LEFT JOIN suppliers s ON dlc.supplier_id = s.id
        ${whereClause ? sql.raw(whereClause) : sql.raw('')}
        ORDER BY dlc.expiry_date ASC, dlc.created_at DESC
      `);

      return result.rows.map((row: any) => ({
        id: row.id as number,
        productName: row.product_name as string,
        gencode: row.gencode as string | null,
        dlcDate: row.expiry_date as Date,
        dateType: row.date_type as string,
        quantity: row.quantity as number,
        unit: row.unit as string,
        supplierId: row.supplier_id as number,
        location: row.location as string,
        status: row.status as string,
        notes: row.notes as string | null,
        alertThreshold: row.alert_threshold as number,
        validatedAt: row.validated_at as Date | null,
        validatedBy: row.validated_by as string | null,
        groupId: row.group_id as number,
        createdBy: row.created_by as string,
        createdAt: row.created_at as Date,
        updatedAt: row.updated_at as Date,
        group: {
          id: row.group_id_ref as number,
          name: row.group_name as string,
          color: row.group_color as string,
          createdAt: null,
          updatedAt: null,
          nocodbConfigId: null,
          nocodbTableId: null,
          nocodbTableName: null,
          invoiceColumnName: null,
        },
        creator: {
          id: row.creator_id_ref as string,
          username: row.creator_username as string | null,
          email: row.creator_email as string | null,
          firstName: row.first_name as string | null,
          lastName: row.last_name as string | null,
          role: row.creator_role as string,
        },
        validator: row.validator_id_ref ? {
          id: row.validator_id_ref as string,
          username: row.validator_username as string | null,
          email: row.validator_email as string | null,
          firstName: row.validator_first_name as string | null,
          lastName: row.validator_last_name as string | null,
          role: null,
        } : null,
        supplier: {
          id: row.supplier_id_ref as number,
          name: row.supplier_name as string,
          contact: row.supplier_contact as string,
          phone: row.supplier_phone as string,
        },
      })) as unknown as DlcProductWithRelations[];
    } catch (error) {
      console.error("Error in getDlcProducts:", error);
      return [];
    }
  }

  async getDlcProduct(id: number): Promise<DlcProductWithRelations | undefined> {
    try {
      const result = await db.execute(sql`
        SELECT 
          dlc.*,
          g.id as group_id_ref, g.name as group_name, g.color as group_color,
          u.id as creator_id_ref, u.username as creator_username, u.email as creator_email, 
          u.first_name, u.last_name, u.role as creator_role,
          v.id as validator_id_ref, v.username as validator_username, v.email as validator_email,
          v.first_name as validator_first_name, v.last_name as validator_last_name,
          s.id as supplier_id_ref, s.name as supplier_name, s.contact as supplier_contact, s.phone as supplier_phone
        FROM dlc_products dlc
        LEFT JOIN groups g ON dlc.group_id = g.id
        LEFT JOIN users u ON dlc.created_by = u.id
        LEFT JOIN users v ON dlc.validated_by = v.id
        LEFT JOIN suppliers s ON dlc.supplier_id = s.id
        WHERE dlc.id = ${id}
      `);

      if (result.rows.length === 0) return undefined;

      const row = result.rows[0];
      return {
        id: row.id as number,
        productName: row.product_name as string,
        gencode: row.gencode as string | null,
        dlcDate: row.expiry_date as Date,
        dateType: row.date_type as string,
        quantity: row.quantity as number,
        unit: row.unit as string,
        supplierId: row.supplier_id as number,
        location: row.location as string,
        status: row.status as string,
        notes: row.notes as string | null,
        alertThreshold: row.alert_threshold as number,
        validatedAt: row.validated_at as Date | null,
        validatedBy: row.validated_by as string | null,
        groupId: row.group_id as number,
        createdBy: row.created_by as string,
        createdAt: row.created_at as Date,
        updatedAt: row.updated_at as Date,
        group: {
          id: row.group_id_ref as number,
          name: row.group_name as string,
          color: row.group_color as string,
          createdAt: null,
          updatedAt: null,
          nocodbConfigId: null,
          nocodbTableId: null,
          nocodbTableName: null,
          invoiceColumnName: null,
        },
        creator: {
          id: row.creator_id_ref as string,
          username: row.creator_username as string | null,
          email: row.creator_email as string | null,
          firstName: row.first_name as string | null,
          lastName: row.last_name as string | null,
          role: row.creator_role as string,
        },
        validator: row.validator_id_ref ? {
          id: row.validator_id_ref as string,
          username: row.validator_username as string | null,
          email: row.validator_email as string | null,
          firstName: row.validator_first_name as string | null,
          lastName: row.validator_last_name as string | null,
          role: null,
        } : null,
        supplier: {
          id: row.supplier_id_ref as number,
          name: row.supplier_name as string,
          contact: row.supplier_contact as string,
          phone: row.supplier_phone as string,
        },
      } as unknown as DlcProductWithRelations;
    } catch (error) {
      console.error("Error in getDlcProduct:", error);
      return undefined;
    }
  }

  async createDlcProduct(dlcProductData: InsertDlcProductFrontend): Promise<DlcProductFrontend> {
    // Convert dlcDate to expiryDate for Drizzle schema compatibility
    const { dlcDate, ...restData } = dlcProductData as any;
    const [dlcProduct] = await db
      .insert(dlcProducts)
      .values({
        ...restData,
        expiryDate: dlcDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    // Return with dlcDate field for frontend compatibility
    return {
      ...dlcProduct,
      dlcDate: dlcProduct.expiryDate,
    } as any;
  }

  async updateDlcProduct(id: number, dlcProductData: Partial<InsertDlcProductFrontend>): Promise<DlcProductFrontend> {
    // Convert dlcDate to expiryDate for Drizzle schema compatibility
    const { dlcDate, ...restData } = dlcProductData as any;
    const updateData = { ...restData };
    if (dlcDate) {
      updateData.expiryDate = dlcDate;
    }
    
    const [dlcProduct] = await db
      .update(dlcProducts)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(dlcProducts.id, id))
      .returning();
    
    // Return with dlcDate field for frontend compatibility
    return {
      ...dlcProduct,
      dlcDate: dlcProduct.expiryDate,
    } as any;
  }

  async deleteDlcProduct(id: number): Promise<void> {
    await db.delete(dlcProducts).where(eq(dlcProducts.id, id));
  }

  async validateDlcProduct(id: number, validatedBy: string): Promise<DlcProductFrontend> {
    const [dlcProduct] = await db
      .update(dlcProducts)
      .set({
        status: 'valides',
        validatedAt: new Date(),
        validatedBy,
        updatedAt: new Date(),
      })
      .where(eq(dlcProducts.id, id))
      .returning();
    
    // Return with dlcDate field for frontend compatibility
    return {
      ...dlcProduct,
      dlcDate: dlcProduct.expiryDate,
    } as any;
  }

  async getDlcStats(groupIds?: number[]): Promise<{ active: number; expiringSoon: number; expired: number; }> {
    try {
      let whereClause = "";
      if (groupIds && groupIds.length > 0) {
        whereClause = `WHERE group_id IN (${groupIds.join(',')})`;
      }
      
      const result = await db.execute(sql`
        SELECT 
          COUNT(CASE WHEN status != 'valides' AND expiry_date > NOW() + INTERVAL '15 days' THEN 1 END) as active,
          COUNT(CASE WHEN status != 'valides' AND expiry_date <= NOW() + INTERVAL '15 days' AND expiry_date > NOW() THEN 1 END) as expiring_soon,
          COUNT(CASE WHEN status != 'valides' AND expiry_date <= NOW() THEN 1 END) as expired
        FROM dlc_products
        ${whereClause ? sql.raw(whereClause) : sql.raw('')}
      `);

      const row = result.rows[0] as any;
      return {
        active: parseInt(row.active) || 0,
        expiringSoon: parseInt(row.expiring_soon) || 0,
        expired: parseInt(row.expired) || 0,
      };
    } catch (error) {
      console.error("Error in getDlcStats:", error);
      return { active: 0, expiringSoon: 0, expired: 0 };
    }
  }

  // ===== ROLE MANAGEMENT OPERATIONS =====

  // Role operations
  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(roles.name);
  }

  async getRole(id: number): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }

  async createRole(roleData: InsertRole): Promise<Role> {
    const [role] = await db
      .insert(roles)
      .values({
        ...roleData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return role;
  }

  async updateRole(id: number, roleData: Partial<InsertRole>): Promise<Role> {
    const [role] = await db
      .update(roles)
      .set({
        ...roleData,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, id))
      .returning();
    return role;
  }

  async deleteRole(id: number): Promise<void> {
    // First remove all permissions from this role
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    // Remove all user assignments to this role
    await db.delete(userRoles).where(eq(userRoles.roleId, id));
    // Finally delete the role
    await db.delete(roles).where(eq(roles.id, id));
  }

  async getRoleWithPermissions(id: number): Promise<RoleWithPermissions | undefined> {
    const role = await this.getRole(id);
    if (!role) return undefined;

    const rolePerms = await db
      .select({
        id: rolePermissions.roleId,
        permissionId: rolePermissions.permissionId,
        createdAt: rolePermissions.createdAt,
        permission: {
          id: permissions.id,
          name: permissions.name,
          displayName: permissions.displayName,
          description: permissions.description,
          category: permissions.category,
          action: permissions.action,
          resource: permissions.resource,
          isSystem: permissions.isSystem,
          createdAt: permissions.createdAt,
        },
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, id));

    return {
      ...role,
      rolePermissions: rolePerms.map((rp: any) => ({
        roleId: rp.id,
        permissionId: rp.permissionId,
        createdAt: rp.createdAt,
        permission: rp.permission,
      })),
    };
  }

  // Permission operations
  async getPermissions(): Promise<Permission[]> {
    console.log('🔍 DEV getPermissions() - Starting Drizzle query...');
    const result = await db.select().from(permissions).orderBy(permissions.category, permissions.name);
    console.log('📊 DEV getPermissions() - Drizzle result:', result.length, 'permissions');
    
    if (result.length === 0) {
      console.log('⚠️ DEV getPermissions() - NO PERMISSIONS FOUND IN DATABASE!');
      return [];
    }
    
    // Log des catégories trouvées
    const categories = [...new Set(result.map((p: any) => p.category))];
    console.log('🏷️ DEV getPermissions() - Categories found:', categories);
    
    // Log spécifique pour les permissions tâches
    const taskPerms = result.filter((p: any) => p.category === 'gestion_taches');
    console.log('📋 DEV getPermissions() - Task permissions found:', taskPerms.length);
    if (taskPerms.length > 0) {
      taskPerms.forEach((p: any) => {
        console.log(`  - ID: ${p.id}, Name: ${p.name}, DisplayName: "${p.displayName}", Category: ${p.category}`);
      });
    } else {
      console.log('❌ DEV getPermissions() - NO TASK PERMISSIONS FOUND - This explains the issue!');
      console.log('🔍 DEV getPermissions() - Sample permissions:', result.slice(0, 3).map((p: any) => ({ id: p.id, name: p.name, category: p.category })));
    }
    
    console.log('✅ DEV getPermissions() - Returning', result.length, 'permissions');
    return result;
  }

  async getPermission(id: number): Promise<Permission | undefined> {
    const [permission] = await db.select().from(permissions).where(eq(permissions.id, id));
    return permission;
  }

  async createPermission(permissionData: InsertPermission): Promise<Permission> {
    const [permission] = await db
      .insert(permissions)
      .values({
        ...permissionData,
        createdAt: new Date(),
      })
      .returning();
    return permission;
  }

  async updatePermission(id: number, permissionData: Partial<InsertPermission>): Promise<Permission> {
    const [permission] = await db
      .update(permissions)
      .set(permissionData)
      .where(eq(permissions.id, id))
      .returning();
    return permission;
  }

  async deletePermission(id: number): Promise<void> {
    // First remove this permission from all roles
    await db.delete(rolePermissions).where(eq(rolePermissions.permissionId, id));
    // Then delete the permission
    await db.delete(permissions).where(eq(permissions.id, id));
  }

  async getPermissionsByCategory(category: string): Promise<Permission[]> {
    return await db
      .select()
      .from(permissions)
      .where(eq(permissions.category, category))
      .orderBy(permissions.name);
  }

  // Role-Permission association operations
  async getRolePermissions(roleId: number): Promise<any[]> {
    const results = await db
      .select({
        roleId: rolePermissions.roleId,
        permissionId: rolePermissions.permissionId,
        createdAt: rolePermissions.createdAt,
        permission: {
          id: permissions.id,
          name: permissions.name,
          displayName: permissions.displayName,
          description: permissions.description,
          category: permissions.category,
          action: permissions.action,
          resource: permissions.resource,
          isSystem: permissions.isSystem,
          createdAt: permissions.createdAt
        }
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    
    return results;
  }

  async setRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    // First, remove existing permissions for this role
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    
    // Then add new permissions
    if (permissionIds.length > 0) {
      const values = permissionIds.map(permissionId => ({
        roleId,
        permissionId,
        createdAt: new Date(),
      }));
      await db.insert(rolePermissions).values(values);
    }
  }

  async addPermissionToRole(roleId: number, permissionId: number): Promise<RolePermission> {
    const [rolePermission] = await db
      .insert(rolePermissions)
      .values({
        roleId,
        permissionId,
        createdAt: new Date(),
      })
      .returning();
    return rolePermission;
  }

  async removePermissionFromRole(roleId: number, permissionId: number): Promise<void> {
    await db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionId)
        )
      );
  }

  // User-Role association operations
  async getUserRoles(userId: string): Promise<UserRole[]> {
    return await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId));
  }

  async setUserRoles(userId: string, roleIds: number[], assignedBy: string): Promise<void> {
    // First, remove existing roles for this user
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    
    // Then add new role (only one role per user)
    if (roleIds.length > 0) {
      const roleId = roleIds[0]; // Take only the first role
      await db.insert(userRoles).values({
        userId,
        roleId,
        assignedBy,
        assignedAt: new Date(),
      });
    }
  }

  async addRoleToUser(userId: string, roleId: number, assignedBy: string): Promise<UserRole> {
    const [userRole] = await db
      .insert(userRoles)
      .values({
        userId,
        roleId,
        assignedBy,
        assignedAt: new Date(),
      })
      .returning();
    return userRole;
  }

  async removeRoleFromUser(userId: string, roleId: number): Promise<void> {
    await db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId)
        )
      );
  }

  async getUserWithRoles(userId: string): Promise<UserWithRoles | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;

    const userRoleData = await db
      .select({
        userId: userRoles.userId,
        roleId: userRoles.roleId,
        assignedBy: userRoles.assignedBy,
        assignedAt: userRoles.assignedAt,
        role: {
          id: roles.id,
          name: roles.name,
          displayName: roles.displayName,
          description: roles.description,
          color: roles.color,
          isSystem: roles.isSystem,
          isActive: roles.isActive,
          createdAt: roles.createdAt,
          updatedAt: roles.updatedAt,
        },
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    // Debug user roles
    console.log(`📊 getUserWithRoles(${userId}):`, { userRoleDataLength: userRoleData.length });

    return {
      ...user,
      userRoles: userRoleData,
    };
  }

  // Permission checking operations
  async userHasPermission(userId: string, permissionName: string): Promise<boolean> {
    const result = await db
      .select({
        exists: sql`1`,
      })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(permissions.name, permissionName)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async userHasRole(userId: string, roleName: string): Promise<boolean> {
    const result = await db
      .select({
        exists: sql`1`,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(roles.name, roleName)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async getUserEffectivePermissions(userId: string): Promise<Permission[]> {
    return await db
      .select({
        id: permissions.id,
        name: permissions.name,
        displayName: permissions.displayName,
        description: permissions.description,
        category: permissions.category,
        action: permissions.action,
        resource: permissions.resource,
        isSystem: permissions.isSystem,
        createdAt: permissions.createdAt,
      })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId))
      .groupBy(permissions.id)
      .orderBy(permissions.category, permissions.name);
  }

  // Task operations
  async getTasks(groupIds?: number[]): Promise<any[]> {
    const tasksQuery = db.query.tasks.findMany({
      with: {
        assignedUser: true,
        creator: true,
        group: true,
      },
      orderBy: [desc(tasks.createdAt)],
      where: groupIds ? inArray(tasks.groupId, groupIds) : undefined,
    });
    
    return await tasksQuery;
  }

  async getTasksByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<any[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const whereCondition = groupIds 
      ? and(
          gte(tasks.dueDate, start),
          lte(tasks.dueDate, end),
          inArray(tasks.groupId, groupIds)
        )
      : and(
          gte(tasks.dueDate, start),
          lte(tasks.dueDate, end)
        );

    return await db.query.tasks.findMany({
      with: {
        assignedUser: true,
        creator: true,
        group: true,
      },
      where: whereCondition,
      orderBy: [desc(tasks.createdAt)],
    });
  }

  async getTask(id: number): Promise<any | undefined> {
    return await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        assignedUser: true,
        creator: true,
        group: true,
      },
    });
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: number, task: Partial<InsertTask>): Promise<Task> {
    const [updatedTask] = await db
      .update(tasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updatedTask;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async completeTask(id: number, completedBy?: string): Promise<void> {
    await db
      .update(tasks)
      .set({ 
        status: 'completed',
        completedAt: new Date(),
        completedBy: completedBy,
        updatedAt: new Date() 
      })
      .where(eq(tasks.id, id));
  }
}

// Simple in-memory storage for development
class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private groups = new Map<number, Group>();
  private suppliers = new Map<number, Supplier>();
  private orders = new Map<number, Order>();
  private deliveries = new Map<number, Delivery>();
  private tasks = new Map<number, Task>();

  constructor() {
    // Create default admin user for development
    const adminUser: User = {
      id: 'admin_dev',
      username: 'admin',
      email: 'admin@dev.local',
      name: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      profileImageUrl: null,
      password: 'admin.salt', // Simple format for development
      role: 'admin',
      passwordChanged: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set('admin_dev', adminUser);
    this.users.set('admin', adminUser); // Also set by username for easy lookup
    console.log('✅ MemStorage initialized with admin user (admin/admin)');
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }
    return undefined;
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const newUser = { ...user, createdAt: new Date(), updatedAt: new Date() } as User;
    this.users.set(user.id, newUser);
    return newUser;
  }

  async getUserWithGroups(id: string): Promise<UserWithGroups | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    return { ...user, userGroups: [] };
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersWithRoles(): Promise<UserWithRoles[]> {
    return Array.from(this.users.values()).map(user => ({ ...user, userRoles: [] }));
  }

  async getUsersWithRolesAndGroups(): Promise<(UserWithRoles & { userGroups: any[] })[]> {
    return Array.from(this.users.values()).map(user => ({ ...user, userRoles: [], userGroups: [] }));
  }

  async createUser(user: UpsertUser): Promise<User> {
    return this.upsertUser(user);
  }

  async updateUser(id: string, user: Partial<UpsertUser>): Promise<User> {
    const existingUser = this.users.get(id);
    if (!existingUser) throw new Error('User not found');
    const updatedUser = { ...existingUser, ...user, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  // Stub implementations for other required methods
  async getGroups(): Promise<Group[]> { return []; }
  async getGroup(id: number): Promise<Group | undefined> { return undefined; }
  async createGroup(group: InsertGroup): Promise<Group> { return {} as Group; }
  async updateGroup(id: number, group: Partial<InsertGroup>): Promise<Group> { return {} as Group; }
  async deleteGroup(id: number): Promise<void> {}
  async getSuppliers(): Promise<Supplier[]> { return []; }
  async createSupplier(supplier: InsertSupplier): Promise<Supplier> { return {} as Supplier; }
  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier> { return {} as Supplier; }
  async deleteSupplier(id: number): Promise<void> {}
  async getOrders(groupIds?: number[]): Promise<OrderWithRelations[]> { return []; }
  async getOrdersByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<OrderWithRelations[]> { return []; }
  async createOrder(order: InsertOrder): Promise<Order> { return {} as Order; }
  async updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order> { return {} as Order; }
  async deleteOrder(id: number): Promise<void> {}
  async getDeliveries(groupIds?: number[]): Promise<DeliveryWithRelations[]> { return []; }
  async getDeliveriesByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<DeliveryWithRelations[]> { return []; }
  async createDelivery(delivery: InsertDelivery): Promise<Delivery> { return {} as Delivery; }
  async updateDelivery(id: number, delivery: Partial<InsertDelivery>): Promise<Delivery> { return {} as Delivery; }
  async deleteDelivery(id: number): Promise<void> {}
  
  // Add missing required methods for IStorage interface
  async getOrder(id: number): Promise<OrderWithRelations | undefined> { return undefined; }
  async getDelivery(id: number): Promise<DeliveryWithRelations | undefined> { return undefined; }
  async validateDelivery(id: number, deliveryData: any): Promise<void> {}
  async getUserGroups(userId: string): Promise<any[]> { return []; }
  async getUserRoles(userId: string): Promise<any[]> { return []; }
  async getUserWithRoles(userId: string): Promise<UserWithRoles | undefined> { 
    const user = await this.getUser(userId);
    return user ? { ...user, userRoles: [] } : undefined;
  }
  async getRoleWithPermissions(roleId: number): Promise<any> { return undefined; }
  async getUserPermissions(userId: string): Promise<any[]> { return []; }
  async getTasksByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<any[]> { return []; }
  async getOrderStats(): Promise<any> { return {}; }
  async getDeliveryStats(): Promise<any> { return {}; }
  async getPublicitiesWithParticipations(year?: number): Promise<any[]> { return []; }
  async setPublicityParticipations(publicityId: number, groupIds: number[]): Promise<void> {}
  
  // Add placeholder methods for all other IStorage interface methods
  async getSavTickets(): Promise<any[]> { return []; }
  async getSavTicket(): Promise<any> { return undefined; }
  async createSavTicket(): Promise<any> { return {}; }
  async updateSavTicket(): Promise<any> { return {}; }
  async deleteSavTicket(): Promise<void> {}
  async getSavTicketHistory(): Promise<any[]> { return []; }
  async createSavTicketHistory(): Promise<any> { return {}; }
  async updateSavTicketHistory(): Promise<any> { return {}; }
  async deleteSavTicketHistory(): Promise<void> {}
  async getPublicities(): Promise<any[]> { return []; }
  async getPublicity(): Promise<any> { return undefined; }
  async createPublicity(): Promise<any> { return {}; }
  async updatePublicity(): Promise<any> { return {}; }
  async deletePublicity(): Promise<void> {}
  async getPublicityParticipations(): Promise<any[]> { return []; }
  async createPublicityParticipation(): Promise<any> { return {}; }
  async deletePublicityParticipation(): Promise<void> {}
  async getCustomerOrders(): Promise<any[]> { return []; }
  async getCustomerOrder(): Promise<any> { return undefined; }
  async createCustomerOrder(): Promise<any> { return {}; }
  async updateCustomerOrder(): Promise<any> { return {}; }
  async deleteCustomerOrder(): Promise<void> {}
  async getDlcProducts(): Promise<any[]> { return []; }
  async getDlcProduct(): Promise<any> { return undefined; }
  async createDlcProduct(): Promise<any> { return {}; }
  async updateDlcProduct(): Promise<any> { return {}; }
  async deleteDlcProduct(): Promise<void> {}
  async getTasks(): Promise<Task[]> { return Array.from(this.tasks.values()); }
  async getTask(): Promise<any> { return undefined; }
  async createTask(): Promise<any> { return {}; }
  async updateTask(): Promise<any> { return {}; }
  async deleteTask(): Promise<void> {}
  async completeTask(): Promise<void> {}
  async getRoles(): Promise<any[]> { return []; }
  async getRole(): Promise<any> { return undefined; }
  async createRole(): Promise<any> { return {}; }
  async updateRole(): Promise<any> { return {}; }
  async deleteRole(): Promise<void> {}
  async getPermissions(): Promise<any[]> { return []; }
  async getPermission(): Promise<any> { return undefined; }
  async createPermission(): Promise<any> { return {}; }
  async updatePermission(): Promise<any> { return {}; }
  async deletePermission(): Promise<void> {}
  async getRolePermissions(): Promise<any[]> { return []; }
  async setRolePermissions(): Promise<void> {}
  async setUserRoles(): Promise<void> {}
  async assignUserToGroup(userGroup: { groupId: number; userId: string; }): Promise<{ createdAt: Date | null; groupId: number; userId: string; }> {
    return { ...userGroup, createdAt: new Date() };
  }
  async removeUserFromGroup(): Promise<void> {}
  async getMonthlyStats(): Promise<any> { return {}; }
  async getNocodbConfigs(): Promise<any[]> { return []; }
  async getNocodbConfig(): Promise<any> { return null; }
  async createNocodbConfig(): Promise<any> { return {}; }
  async updateNocodbConfig(): Promise<any> { return {}; }
  async deleteNocodbConfig(): Promise<void> {}
  async getPermissionsByCategory(): Promise<any[]> { return []; }
  async getUserEffectivePermissions(): Promise<any[]> { return []; }
  async userHasPermission(): Promise<boolean> { return false; }
  async userHasRole(): Promise<boolean> { return false; }
  async getDlcStats(): Promise<any> { return {}; }
  async validateDlcProduct(id: number, validatedBy: string): Promise<DlcProductFrontend> {
    // MemStorage stub implementation - return a basic DlcProductFrontend object
    return {
      id,
      productName: "Sample Product",
      gencode: "1234567890123",
      supplierId: 1,
      groupId: 1,
      dlcDate: new Date("2025-12-31"),
      dateType: "dlc",
      quantity: 1,
      unit: "unité",
      location: "Magasin",
      alertThreshold: 15,
      status: "valides",
      notes: null,
      createdBy: validatedBy,
      validatedBy,
      validatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as DlcProductFrontend;
  }
  
  // Missing interface methods - stub implementations for MemStorage
  async addPermissionToRole(roleId: number, permissionId: number): Promise<{ createdAt: Date | null; roleId: number; permissionId: number; }> {
    return { roleId, permissionId, createdAt: new Date() };
  }
  async removePermissionFromRole(): Promise<void> {}
  async addRoleToUser(userId: string, roleId: number, assignedBy: string): Promise<{ userId: string; roleId: number; assignedBy: string; assignedAt: Date | null; }> {
    return { userId, roleId, assignedBy, assignedAt: new Date() };
  }
  async removeRoleFromUser(): Promise<void> {}
}

// Use MemStorage in development, DatabaseStorage in production
const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL;
const isProductionDocker = isProduction && dbUrl && (dbUrl.includes('logiflow-db') || dbUrl.includes('localhost'));

export const storage = isProductionDocker ? new DatabaseStorage() : new MemStorage();
console.log(isProductionDocker ? '🐳 PRODUCTION: Using PostgreSQL storage' : '🔧 DEV: Using in-memory storage');
