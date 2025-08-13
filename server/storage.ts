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
  nocodbConfig,
  invoiceVerificationCache,
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
  type NocodbConfig,
  type InsertNocodbConfig,
  type InvoiceVerificationCache,
  type InsertInvoiceVerificationCache,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, desc, sql, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations
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
  getActiveNocodbConfig(): Promise<NocodbConfig | undefined>;
  createNocodbConfig(config: InsertNocodbConfig): Promise<NocodbConfig>;
  updateNocodbConfig(id: number, config: Partial<InsertNocodbConfig>): Promise<NocodbConfig>;
  deleteNocodbConfig(id: number): Promise<void>;
  
  // Invoice Verification Cache operations
  getInvoiceVerificationCache(cacheKey: string): Promise<InvoiceVerificationCache | undefined>;
  createInvoiceVerificationCache(cache: InsertInvoiceVerificationCache): Promise<InvoiceVerificationCache>;
  clearExpiredCache(): Promise<void>;
  
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
    const user = await this.getUser(id);
    if (!user) return undefined;

    try {
      const result = await db.execute(sql`
        SELECT 
          ug.user_id,
          ug.group_id,
          g.id as group_id_ref,
          g.name as group_name,
          g.color as group_color,
          g.created_at as group_created_at,
          g.updated_at as group_updated_at
        FROM user_groups ug
        INNER JOIN groups g ON ug.group_id = g.id
        WHERE ug.user_id = ${id}
      `);

      const userGroups = result.rows.map((row: any) => ({
        userId: row.user_id,
        groupId: row.group_id,
        group: {
          id: row.group_id_ref,
          name: row.group_name,
          color: row.group_color,
          createdAt: row.group_created_at,
          updatedAt: row.group_updated_at,
        }
      }));

      return { ...user, userGroups };
    } catch (error) {
      console.error('Error fetching user with groups:', error);
      return { ...user, userGroups: [] };
    }
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Group operations
  async getGroups(): Promise<Group[]> {
    return await db.select().from(groups).orderBy(groups.name);
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  }

  async createGroup(groupData: InsertGroup): Promise<Group> {
    const [group] = await db.insert(groups).values(groupData).returning();
    return group;
  }

  async updateGroup(id: number, groupData: Partial<InsertGroup>): Promise<Group> {
    const [group] = await db
      .update(groups)
      .set({ ...groupData, updatedAt: new Date() })
      .where(eq(groups.id, id))
      .returning();
    return group;
  }

  async deleteGroup(id: number): Promise<void> {
    await db.delete(groups).where(eq(groups.id, id));
  }

  // Supplier operations
  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).orderBy(suppliers.name);
  }

  async createSupplier(supplierData: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(supplierData).returning();
    return supplier;
  }

  async updateSupplier(id: number, supplierData: Partial<InsertSupplier>): Promise<Supplier> {
    const [supplier] = await db
      .update(suppliers)
      .set({ ...supplierData, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return supplier;
  }

  async deleteSupplier(id: number): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  }

  // Order operations
  async getOrders(groupIds?: number[]): Promise<OrderWithRelations[]> {
    let query = db
      .select({
        id: orders.id,
        supplierId: orders.supplierId,
        groupId: orders.groupId,
        expectedDate: orders.expectedDate,
        status: orders.status,
        palettes: orders.palettes,
        packages: orders.packages,
        notes: orders.notes,
        createdBy: orders.createdBy,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        supplier: suppliers,
        group: groups,
      })
      .from(orders)
      .leftJoin(suppliers, eq(orders.supplierId, suppliers.id))
      .leftJoin(groups, eq(orders.groupId, groups.id));

    if (groupIds && groupIds.length > 0) {
      query = query.where(inArray(orders.groupId, groupIds));
    }

    return await query.orderBy(desc(orders.createdAt));
  }

  async getOrdersByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<OrderWithRelations[]> {
    let query = db
      .select({
        id: orders.id,
        supplierId: orders.supplierId,
        groupId: orders.groupId,
        expectedDate: orders.expectedDate,
        status: orders.status,
        palettes: orders.palettes,
        packages: orders.packages,
        notes: orders.notes,
        createdBy: orders.createdBy,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        supplier: suppliers,
        group: groups,
      })
      .from(orders)
      .leftJoin(suppliers, eq(orders.supplierId, suppliers.id))
      .leftJoin(groups, eq(orders.groupId, groups.id))
      .where(
        and(
          gte(orders.expectedDate, startDate),
          lte(orders.expectedDate, endDate)
        )
      );

    if (groupIds && groupIds.length > 0) {
      query = query.where(
        and(
          gte(orders.expectedDate, startDate),
          lte(orders.expectedDate, endDate),
          inArray(orders.groupId, groupIds)
        )
      );
    }

    return await query.orderBy(desc(orders.expectedDate));
  }

  async getOrder(id: number): Promise<OrderWithRelations | undefined> {
    const [order] = await db
      .select({
        id: orders.id,
        supplierId: orders.supplierId,
        groupId: orders.groupId,
        expectedDate: orders.expectedDate,
        status: orders.status,
        palettes: orders.palettes,
        packages: orders.packages,
        notes: orders.notes,
        createdBy: orders.createdBy,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        supplier: suppliers,
        group: groups,
      })
      .from(orders)
      .leftJoin(suppliers, eq(orders.supplierId, suppliers.id))
      .leftJoin(groups, eq(orders.groupId, groups.id))
      .where(eq(orders.id, id));

    return order;
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(orderData).returning();
    return order;
  }

  async updateOrder(id: number, orderData: Partial<InsertOrder>): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set({ ...orderData, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }

  // Delivery operations
  async getDeliveries(groupIds?: number[]): Promise<DeliveryWithRelations[]> {
    let query = db
      .select({
        id: deliveries.id,
        orderId: deliveries.orderId,
        supplierId: deliveries.supplierId,
        groupId: deliveries.groupId,
        scheduledDate: deliveries.scheduledDate,
        deliveredDate: deliveries.deliveredDate,
        status: deliveries.status,
        palettes: deliveries.palettes,
        packages: deliveries.packages,
        blNumber: deliveries.blNumber,
        blAmount: deliveries.blAmount,
        invoiceReference: deliveries.invoiceReference,
        invoiceAmount: deliveries.invoiceAmount,
        reconciled: deliveries.reconciled,
        validatedAt: deliveries.validatedAt,
        notes: deliveries.notes,
        createdBy: deliveries.createdBy,
        createdAt: deliveries.createdAt,
        updatedAt: deliveries.updatedAt,
        supplier: suppliers,
        group: groups,
      })
      .from(deliveries)
      .leftJoin(suppliers, eq(deliveries.supplierId, suppliers.id))
      .leftJoin(groups, eq(deliveries.groupId, groups.id));

    if (groupIds && groupIds.length > 0) {
      query = query.where(inArray(deliveries.groupId, groupIds));
    }

    return await query.orderBy(desc(deliveries.createdAt));
  }

  async getDeliveriesByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<DeliveryWithRelations[]> {
    let query = db
      .select({
        id: deliveries.id,
        orderId: deliveries.orderId,
        supplierId: deliveries.supplierId,
        groupId: deliveries.groupId,
        scheduledDate: deliveries.scheduledDate,
        deliveredDate: deliveries.deliveredDate,
        status: deliveries.status,
        palettes: deliveries.palettes,
        packages: deliveries.packages,
        blNumber: deliveries.blNumber,
        blAmount: deliveries.blAmount,
        invoiceReference: deliveries.invoiceReference,
        invoiceAmount: deliveries.invoiceAmount,
        reconciled: deliveries.reconciled,
        validatedAt: deliveries.validatedAt,
        notes: deliveries.notes,
        createdBy: deliveries.createdBy,
        createdAt: deliveries.createdAt,
        updatedAt: deliveries.updatedAt,
        supplier: suppliers,
        group: groups,
      })
      .from(deliveries)
      .leftJoin(suppliers, eq(deliveries.supplierId, suppliers.id))
      .leftJoin(groups, eq(deliveries.groupId, groups.id))
      .where(
        and(
          gte(deliveries.scheduledDate, startDate),
          lte(deliveries.scheduledDate, endDate)
        )
      );

    if (groupIds && groupIds.length > 0) {
      query = query.where(
        and(
          gte(deliveries.scheduledDate, startDate),
          lte(deliveries.scheduledDate, endDate),
          inArray(deliveries.groupId, groupIds)
        )
      );
    }

    return await query.orderBy(desc(deliveries.scheduledDate));
  }

  async getDelivery(id: number): Promise<DeliveryWithRelations | undefined> {
    const [delivery] = await db
      .select({
        id: deliveries.id,
        orderId: deliveries.orderId,
        supplierId: deliveries.supplierId,
        groupId: deliveries.groupId,
        scheduledDate: deliveries.scheduledDate,
        deliveredDate: deliveries.deliveredDate,
        status: deliveries.status,
        palettes: deliveries.palettes,
        packages: deliveries.packages,
        blNumber: deliveries.blNumber,
        blAmount: deliveries.blAmount,
        invoiceReference: deliveries.invoiceReference,
        invoiceAmount: deliveries.invoiceAmount,
        reconciled: deliveries.reconciled,
        validatedAt: deliveries.validatedAt,
        notes: deliveries.notes,
        createdBy: deliveries.createdBy,
        createdAt: deliveries.createdAt,
        updatedAt: deliveries.updatedAt,
        supplier: suppliers,
        group: groups,
      })
      .from(deliveries)
      .leftJoin(suppliers, eq(deliveries.supplierId, suppliers.id))
      .leftJoin(groups, eq(deliveries.groupId, groups.id))
      .where(eq(deliveries.id, id));

    return delivery;
  }

  async createDelivery(deliveryData: InsertDelivery): Promise<Delivery> {
    const [delivery] = await db.insert(deliveries).values(deliveryData).returning();
    return delivery;
  }

  async updateDelivery(id: number, deliveryData: Partial<InsertDelivery>): Promise<Delivery> {
    const [delivery] = await db
      .update(deliveries)
      .set({ ...deliveryData, updatedAt: new Date() })
      .where(eq(deliveries.id, id))
      .returning();
    return delivery;
  }

  async deleteDelivery(id: number): Promise<void> {
    await db.delete(deliveries).where(eq(deliveries.id, id));
  }

  async validateDelivery(id: number, blData?: { blNumber: string; blAmount: number }): Promise<void> {
    const updateData: any = {
      status: 'delivered',
      deliveredDate: new Date().toISOString(),
      updatedAt: new Date(),
    };

    if (blData) {
      updateData.blNumber = blData.blNumber;
      if (blData.blAmount !== undefined) {
        updateData.blAmount = blData.blAmount.toString();
      }
    }

    await db.update(deliveries).set(updateData).where(eq(deliveries.id, id));
  }

  // User-Group operations
  async getUserGroups(userId: string): Promise<UserGroup[]> {
    return await db.select().from(userGroups).where(eq(userGroups.userId, userId));
  }

  async assignUserToGroup(userGroupData: InsertUserGroup): Promise<UserGroup> {
    const [userGroup] = await db.insert(userGroups).values(userGroupData).returning();
    return userGroup;
  }

  async removeUserFromGroup(userId: string, groupId: number): Promise<void> {
    await db.delete(userGroups).where(
      and(eq(userGroups.userId, userId), eq(userGroups.groupId, groupId))
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
    const endDate = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;

    const ordersQuery = db.select({ count: sql<number>`count(*)` }).from(orders);
    const deliveriesQuery = db.select({ count: sql<number>`count(*)` }).from(deliveries);

    return {
      ordersCount: 0,
      deliveriesCount: 0,
      pendingOrdersCount: 0,
      averageDeliveryTime: 0,
      totalPalettes: 0,
      totalPackages: 0,
    };
  }

  // Publicity operations
  async getPublicities(year?: number, groupIds?: number[]): Promise<PublicityWithRelations[]> {
    let query = db
      .select({
        id: publicities.id,
        name: publicities.name,
        description: publicities.description,
        startDate: publicities.startDate,
        endDate: publicities.endDate,
        imageUrl: publicities.imageUrl,
        year: publicities.year,
        createdBy: publicities.createdBy,
        createdAt: publicities.createdAt,
        updatedAt: publicities.updatedAt,
      })
      .from(publicities);

    if (year) {
      query = query.where(eq(publicities.year, year));
    }

    const results = await query.orderBy(desc(publicities.createdAt));

    const publicityIds = results.map(p => p.id);
    const participations = publicityIds.length > 0 
      ? await db
          .select({
            publicityId: publicityParticipations.publicityId,
            groupId: publicityParticipations.groupId,
            group: groups,
          })
          .from(publicityParticipations)
          .leftJoin(groups, eq(publicityParticipations.groupId, groups.id))
          .where(inArray(publicityParticipations.publicityId, publicityIds))
      : [];

    return results.map(publicity => ({
      ...publicity,
      participations: participations
        .filter(p => p.publicityId === publicity.id)
        .map(p => ({
          publicityId: p.publicityId,
          groupId: p.groupId,
          group: p.group!,
        })),
    }));
  }

  async getPublicity(id: number): Promise<PublicityWithRelations | undefined> {
    const [publicity] = await db.select().from(publicities).where(eq(publicities.id, id));
    if (!publicity) return undefined;

    const participations = await db
      .select({
        publicityId: publicityParticipations.publicityId,
        groupId: publicityParticipations.groupId,
        group: groups,
      })
      .from(publicityParticipations)
      .leftJoin(groups, eq(publicityParticipations.groupId, groups.id))
      .where(eq(publicityParticipations.publicityId, id));

    return {
      ...publicity,
      participations: participations.map(p => ({
        publicityId: p.publicityId,
        groupId: p.groupId,
        group: p.group!,
      })),
    };
  }

  async createPublicity(publicityData: InsertPublicity): Promise<Publicity> {
    const [publicity] = await db.insert(publicities).values(publicityData).returning();
    return publicity;
  }

  async updatePublicity(id: number, publicityData: Partial<InsertPublicity>): Promise<Publicity> {
    const [publicity] = await db
      .update(publicities)
      .set({ ...publicityData, updatedAt: new Date() })
      .where(eq(publicities.id, id))
      .returning();
    return publicity;
  }

  async deletePublicity(id: number): Promise<void> {
    await db.delete(publicityParticipations).where(eq(publicityParticipations.publicityId, id));
    await db.delete(publicities).where(eq(publicities.id, id));
  }

  async getPublicityParticipations(publicityId: number): Promise<PublicityParticipation[]> {
    return await db
      .select()
      .from(publicityParticipations)
      .where(eq(publicityParticipations.publicityId, publicityId));
  }

  async setPublicityParticipations(publicityId: number, groupIds: number[]): Promise<void> {
    await db.delete(publicityParticipations).where(eq(publicityParticipations.publicityId, publicityId));

    if (groupIds.length > 0) {
      const participationsData = groupIds.map(groupId => ({
        publicityId,
        groupId,
      }));
      await db.insert(publicityParticipations).values(participationsData);
    }
  }

  // NocoDB Configuration operations
  async getNocodbConfigs(): Promise<NocodbConfig[]> {
    return await db.select().from(nocodbConfig).orderBy(desc(nocodbConfig.createdAt));
  }

  async getNocodbConfig(id: number): Promise<NocodbConfig | undefined> {
    const [config] = await db.select().from(nocodbConfig).where(eq(nocodbConfig.id, id));
    return config;
  }

  async getActiveNocodbConfig(): Promise<NocodbConfig | undefined> {
    try {
      const [config] = await db
        .select()
        .from(nocodbConfig)
        .where(eq(nocodbConfig.isActive, true))
        .limit(1);
      
      console.log('🔧 Configuration NocoDB active récupérée:', config);
      return config;
    } catch (error) {
      console.error('❌ Erreur récupération config NocoDB:', error);
      return undefined;
    }
  }

  async createNocodbConfig(configData: InsertNocodbConfig): Promise<NocodbConfig> {
    const [config] = await db.insert(nocodbConfig).values(configData).returning();
    return config;
  }

  async updateNocodbConfig(id: number, configData: Partial<InsertNocodbConfig>): Promise<NocodbConfig> {
    const [config] = await db
      .update(nocodbConfig)
      .set({ ...configData, updatedAt: new Date() })
      .where(eq(nocodbConfig.id, id))
      .returning();
    return config;
  }

  async deleteNocodbConfig(id: number): Promise<void> {
    await db.delete(nocodbConfig).where(eq(nocodbConfig.id, id));
  }

  // Invoice Verification Cache operations
  async getInvoiceVerificationCache(cacheKey: string): Promise<InvoiceVerificationCache | undefined> {
    const [cache] = await db
      .select()
      .from(invoiceVerificationCache)
      .where(eq(invoiceVerificationCache.cacheKey, cacheKey));
    return cache;
  }

  async createInvoiceVerificationCache(cacheData: InsertInvoiceVerificationCache): Promise<InvoiceVerificationCache> {
    const [cache] = await db.insert(invoiceVerificationCache).values(cacheData).returning();
    return cache;
  }

  async clearExpiredCache(): Promise<void> {
    await db.delete(invoiceVerificationCache).where(
      sql`expires_at < NOW()`
    );
  }

  // Placeholder implementations for other operations
  async getCustomerOrders(): Promise<CustomerOrderWithRelations[]> { return []; }
  async getCustomerOrder(): Promise<CustomerOrderWithRelations | undefined> { return undefined; }
  async createCustomerOrder(): Promise<CustomerOrder> { return {} as CustomerOrder; }
  async updateCustomerOrder(): Promise<CustomerOrder> { return {} as CustomerOrder; }
  async deleteCustomerOrder(): Promise<void> {}

  async getDlcProducts(): Promise<DlcProductWithRelations[]> { return []; }
  async getDlcProduct(): Promise<DlcProductWithRelations | undefined> { return undefined; }
  async createDlcProduct(): Promise<DlcProductFrontend> { return {} as DlcProductFrontend; }
  async updateDlcProduct(): Promise<DlcProductFrontend> { return {} as DlcProductFrontend; }
  async deleteDlcProduct(): Promise<void> {}
  async validateDlcProduct(): Promise<DlcProductFrontend> { return {} as DlcProductFrontend; }
  async getDlcStats(): Promise<{ active: number; expiringSoon: number; expired: number; }> { 
    return { active: 0, expiringSoon: 0, expired: 0 }; 
  }

  async getTasks(): Promise<any[]> { return []; }
  async getTask(): Promise<any | undefined> { return undefined; }
  async createTask(): Promise<Task> { return {} as Task; }
  async updateTask(): Promise<Task> { return {} as Task; }
  async deleteTask(): Promise<void> {}
  async completeTask(): Promise<void> {}
}

// MemStorage class for development
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private groups = new Map<number, Group>();
  private suppliers = new Map<number, Supplier>();
  private orders = new Map<number, Order>();
  private deliveries = new Map<number, Delivery>();
  private userGroups = new Map<string, UserGroup[]>();
  private publicities = new Map<number, Publicity>();
  private publicityParticipations = new Map<number, PublicityParticipation[]>();
  private customerOrders = new Map<number, CustomerOrder>();
  private dlcProducts = new Map<number, DlcProduct>();
  private tasks = new Map<number, Task>();

  private idCounters = {
    group: 1,
    supplier: 1,
    order: 1,
    delivery: 1,
    publicity: 1,
    customerOrder: 1,
    dlcProduct: 1,
    task: 1,
  };

  constructor() {
    this.initializeTestData();
  }

  private initializeTestData() {
    // Create admin user
    const adminUser: User = {
      id: 'admin',
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: 'admin', // In real app, this would be hashed
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

    // Create test groups
    const testGroup: Group = {
      id: 1,
      name: 'Magasin Test',
      color: '#3B82F6',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.groups.set(testGroup.id, testGroup);
    this.idCounters.group = 2;

    // Create test supplier
    const testSupplier: Supplier = {
      id: 1,
      name: 'Fournisseur Test',
      email: 'test@supplier.com',
      phone: '0123456789',
      address: '123 Rue Test',
      automaticReconciliation: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.suppliers.set(testSupplier.id, testSupplier);
    this.idCounters.supplier = 2;

    console.log('✅ MemStorage initialized with admin user (admin/admin)');
  }

  // User operations
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

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.users.get(userData.id);
    const user: User = {
      ...userData,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUserWithGroups(id: string): Promise<UserWithGroups | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const userGroupsList = this.userGroups.get(id) || [];
    const userGroupsWithGroups = userGroupsList.map(ug => ({
      ...ug,
      group: this.groups.get(ug.groupId)!,
    }));

    return { ...user, userGroups: userGroupsWithGroups };
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(userData: UpsertUser): Promise<User> {
    return this.upsertUser(userData);
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const existingUser = this.users.get(id);
    if (!existingUser) throw new Error('User not found');
    
    const updatedUser = { ...existingUser, ...userData, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
    this.userGroups.delete(id);
  }

  // Group operations
  async getGroups(): Promise<Group[]> {
    return Array.from(this.groups.values());
  }

  async getGroup(id: number): Promise<Group | undefined> {
    return this.groups.get(id);
  }

  async createGroup(groupData: InsertGroup): Promise<Group> {
    const id = this.idCounters.group++;
    const group: Group = {
      ...groupData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.groups.set(id, group);
    return group;
  }

  async updateGroup(id: number, groupData: Partial<InsertGroup>): Promise<Group> {
    const existingGroup = this.groups.get(id);
    if (!existingGroup) throw new Error('Group not found');
    
    const updatedGroup = { ...existingGroup, ...groupData, updatedAt: new Date() };
    this.groups.set(id, updatedGroup);
    return updatedGroup;
  }

  async deleteGroup(id: number): Promise<void> {
    this.groups.delete(id);
  }

  // Supplier operations
  async getSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values());
  }

  async createSupplier(supplierData: InsertSupplier): Promise<Supplier> {
    const id = this.idCounters.supplier++;
    const supplier: Supplier = {
      ...supplierData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.suppliers.set(id, supplier);
    return supplier;
  }

  async updateSupplier(id: number, supplierData: Partial<InsertSupplier>): Promise<Supplier> {
    const existingSupplier = this.suppliers.get(id);
    if (!existingSupplier) throw new Error('Supplier not found');
    
    const updatedSupplier = { ...existingSupplier, ...supplierData, updatedAt: new Date() };
    this.suppliers.set(id, updatedSupplier);
    return updatedSupplier;
  }

  async deleteSupplier(id: number): Promise<void> {
    this.suppliers.delete(id);
  }

  // NocoDB Configuration methods
  async getNocodbConfigs(): Promise<NocodbConfig[]> {
    return []; // Empty array for development
  }

  async getNocodbConfig(id: number): Promise<NocodbConfig | undefined> {
    return undefined; // Not found in development
  }

  async getActiveNocodbConfig(): Promise<NocodbConfig | undefined> {
    // En développement, créer une config de test
    const testConfig: NocodbConfig = {
      id: 1,
      name: 'Configuration Test NocoDB',
      baseUrl: 'https://nocodb-test.example.com',
      projectId: 'test-project-id',
      apiToken: 'test-api-token-123',
      description: 'Configuration de test pour vérification des factures',
      isActive: true,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    console.log('🔧 Retour config NocoDB test:', testConfig);
    return testConfig;
  }

  async createNocodbConfig(config: InsertNocodbConfig): Promise<NocodbConfig> {
    const newConfig: NocodbConfig = {
      ...config,
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return newConfig;
  }

  async updateNocodbConfig(id: number, config: Partial<InsertNocodbConfig>): Promise<NocodbConfig> {
    const updatedConfig: NocodbConfig = {
      id,
      name: config.name || 'Test Config',
      baseUrl: config.baseUrl || 'https://nocodb.example.com',
      projectId: config.projectId || 'test-project',
      apiToken: config.apiToken || 'test-token',
      description: config.description || 'Development configuration',
      isActive: config.isActive ?? true,
      createdBy: config.createdBy || 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return updatedConfig;
  }

  async deleteNocodbConfig(id: number): Promise<void> {
    // No-op in development
  }

  async getInvoiceVerificationCache(cacheKey: string): Promise<InvoiceVerificationCache | undefined> {
    return undefined; // Pas de cache en développement
  }

  async createInvoiceVerificationCache(cache: InsertInvoiceVerificationCache): Promise<InvoiceVerificationCache> {
    const newCache: InvoiceVerificationCache = {
      ...cache,
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return newCache;
  }

  async clearExpiredCache(): Promise<void> {
    // No-op en développement
  }

  // Placeholder implementations for remaining methods
  async getOrders(): Promise<OrderWithRelations[]> { return []; }
  async getOrdersByDateRange(): Promise<OrderWithRelations[]> { return []; }
  async getOrder(): Promise<OrderWithRelations | undefined> { return undefined; }
  async createOrder(): Promise<Order> { return {} as Order; }
  async updateOrder(): Promise<Order> { return {} as Order; }
  async deleteOrder(): Promise<void> {}

  async getDeliveries(): Promise<DeliveryWithRelations[]> { return []; }
  async getDeliveriesByDateRange(): Promise<DeliveryWithRelations[]> { return []; }
  async getDelivery(): Promise<DeliveryWithRelations | undefined> { return undefined; }
  async createDelivery(): Promise<Delivery> { return {} as Delivery; }
  async updateDelivery(): Promise<Delivery> { return {} as Delivery; }
  async deleteDelivery(): Promise<void> {}
  async validateDelivery(): Promise<void> {}

  async getUserGroups(): Promise<UserGroup[]> { return []; }
  async assignUserToGroup(): Promise<UserGroup> { return {} as UserGroup; }
  async removeUserFromGroup(): Promise<void> {}

  async getMonthlyStats(): Promise<any> { return {}; }

  async getPublicities(): Promise<PublicityWithRelations[]> { return []; }
  async getPublicity(): Promise<PublicityWithRelations | undefined> { return undefined; }
  async createPublicity(): Promise<Publicity> { return {} as Publicity; }
  async updatePublicity(): Promise<Publicity> { return {} as Publicity; }
  async deletePublicity(): Promise<void> {}
  async getPublicityParticipations(): Promise<PublicityParticipation[]> { return []; }
  async setPublicityParticipations(): Promise<void> {}

  async getCustomerOrders(): Promise<CustomerOrderWithRelations[]> { return []; }
  async getCustomerOrder(): Promise<CustomerOrderWithRelations | undefined> { return undefined; }
  async createCustomerOrder(): Promise<CustomerOrder> { return {} as CustomerOrder; }
  async updateCustomerOrder(): Promise<CustomerOrder> { return {} as CustomerOrder; }
  async deleteCustomerOrder(): Promise<void> {}

  async getDlcProducts(): Promise<DlcProductWithRelations[]> { return []; }
  async getDlcProduct(): Promise<DlcProductWithRelations | undefined> { return undefined; }
  async createDlcProduct(): Promise<DlcProductFrontend> { return {} as DlcProductFrontend; }
  async updateDlcProduct(): Promise<DlcProductFrontend> { return {} as DlcProductFrontend; }
  async deleteDlcProduct(): Promise<void> {}
  async validateDlcProduct(): Promise<DlcProductFrontend> { return {} as DlcProductFrontend; }
  async getDlcStats(): Promise<{ active: number; expiringSoon: number; expired: number; }> { 
    return { active: 0, expiringSoon: 0, expired: 0 }; 
  }

  async getTasks(): Promise<any[]> { return []; }
  async getTask(): Promise<any | undefined> { return undefined; }
  async createTask(): Promise<Task> { return {} as Task; }
  async updateTask(): Promise<Task> { return {} as Task; }
  async deleteTask(): Promise<void> {}
  async completeTask(): Promise<void> {}
}

// Use MemStorage in development, DatabaseStorage in production
const isProduction = process.env.NODE_ENV === 'production';
export const storage: IStorage = isProduction ? new DatabaseStorage() : new MemStorage();