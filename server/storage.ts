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
  type TaskWithRelations,
  type NocodbConfig,
  type InsertNocodbConfig,
  type InvoiceVerificationCache,
  type InsertInvoiceVerificationCache,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, desc, sql, gte, lte, lt, or, isNull, isNotNull, asc } from "drizzle-orm";

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
  createDlcProduct(dlcProduct: InsertDlcProduct): Promise<DlcProductFrontend>;
  updateDlcProduct(id: number, dlcProduct: Partial<InsertDlcProduct>): Promise<DlcProductFrontend>;
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
        plannedDate: orders.plannedDate,
        status: orders.status,
        quantity: orders.quantity,
        unit: orders.unit,
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
        plannedDate: orders.plannedDate,
        status: orders.status,
        quantity: orders.quantity,
        unit: orders.unit,
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
          gte(orders.plannedDate, startDate),
          lte(orders.plannedDate, endDate)
        )
      );

    if (groupIds && groupIds.length > 0) {
      query = query.where(
        and(
          gte(orders.plannedDate, startDate),
          lte(orders.plannedDate, endDate),
          inArray(orders.groupId, groupIds)
        )
      );
    }

    return await query.orderBy(desc(orders.plannedDate));
  }

  async getOrder(id: number): Promise<OrderWithRelations | undefined> {
    const [order] = await db
      .select({
        id: orders.id,
        supplierId: orders.supplierId,
        groupId: orders.groupId,
        plannedDate: orders.plannedDate,
        status: orders.status,
        quantity: orders.quantity,
        unit: orders.unit,
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
        quantity: deliveries.quantity,
        unit: deliveries.unit,
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
        quantity: deliveries.quantity,
        unit: deliveries.unit,
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
        quantity: deliveries.quantity,
        unit: deliveries.unit,
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
    // En mode développement avec MemStorage, retourner des statistiques simulées
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Mode développement - statistiques simulées');
      return {
        ordersCount: 12,
        deliveriesCount: 8,
        pendingOrdersCount: 3,
        averageDeliveryTime: 2.5,
        totalPalettes: 45,
        totalPackages: 156,
      };
    }

    // En production, calculer les vraies statistiques
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = month === 12 
      ? `${year + 1}-01-01` 
      : `${year}-${(month + 1).toString().padStart(2, '0')}-01`;

    try {
      console.log('📊 Calcul statistiques mensuelles:', { year, month, startDate, endDate, groupIds });

      // Construire les conditions pour le filtrage par groupe
      let ordersWhereCondition = and(
        gte(orders.plannedDate, startDate),
        lt(orders.plannedDate, endDate)
      );
      let deliveriesWhereCondition = and(
        gte(deliveries.scheduledDate, startDate), 
        lt(deliveries.scheduledDate, endDate)
      );

      // Ajouter le filtre par groupe si spécifié
      if (groupIds && groupIds.length > 0) {
        ordersWhereCondition = and(ordersWhereCondition, inArray(orders.groupId, groupIds));
        deliveriesWhereCondition = and(deliveriesWhereCondition, inArray(deliveries.groupId, groupIds));
      }

      // Compter les commandes du mois
      const ordersResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(ordersWhereCondition);

      // Compter les livraisons du mois
      const deliveriesResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(deliveries)
        .where(deliveriesWhereCondition);

      // Commandes en attente (sans date de livraison ou pas encore livrées)
      let pendingWhereCondition = eq(orders.status, 'pending');
      if (groupIds && groupIds.length > 0) {
        pendingWhereCondition = and(pendingWhereCondition, inArray(orders.groupId, groupIds)) as any;
      }

      const pendingResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(pendingWhereCondition);

      // Calculer les totaux de palettes et colis du mois
      const deliveriesStatsResult = await db
        .select({
          totalPalettes: sql<number>`COALESCE(SUM(CAST(${deliveries.quantity} as INTEGER)), 0)`,
          totalPackages: sql<number>`COALESCE(COUNT(*), 0)`,
          avgDelay: sql<number>`COALESCE(AVG(EXTRACT(DAY FROM (${deliveries.deliveredDate} - ${deliveries.scheduledDate}))), 0)`
        })
        .from(deliveries)
        .where(and(
          deliveriesWhereCondition,
          isNotNull(deliveries.deliveredDate)
        ));

      const ordersCount = Number(ordersResult[0]?.count || 0);
      const deliveriesCount = Number(deliveriesResult[0]?.count || 0);
      const pendingOrdersCount = Number(pendingResult[0]?.count || 0);
      const totalPalettes = Number(deliveriesStatsResult[0]?.totalPalettes || 0);
      const totalPackages = Number(deliveriesStatsResult[0]?.totalPackages || 0);
      const averageDeliveryTime = Number(deliveriesStatsResult[0]?.avgDelay || 0);

      console.log('📊 Statistiques calculées:', {
        ordersCount,
        deliveriesCount,
        pendingOrdersCount,
        averageDeliveryTime,
        totalPalettes,
        totalPackages,
      });

      return {
        ordersCount,
        deliveriesCount,
        pendingOrdersCount,
        averageDeliveryTime,
        totalPalettes,
        totalPackages,
      };

    } catch (error) {
      console.error('❌ Erreur calcul statistiques:', error);
      // Retourner des zéros en cas d'erreur pour éviter un crash
      return {
        ordersCount: 0,
        deliveriesCount: 0,
        pendingOrdersCount: 0,
        averageDeliveryTime: 0,
        totalPalettes: 0,
        totalPackages: 0,
      };
    }
  }

  // Publicity operations
  async getPublicities(year?: number, groupIds?: number[]): Promise<PublicityWithRelations[]> {
    let query = db
      .select({
        id: publicities.id,
        pubNumber: publicities.pubNumber,
        designation: publicities.designation,
        startDate: publicities.startDate,
        endDate: publicities.endDate,
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

    const publicityIds = results.map((p: any) => p.id);
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

    return results.map((publicity: any) => ({
      ...publicity,
      participations: participations
        .filter((p: any) => p.publicityId === publicity.id)
        .map((p: any) => ({
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
      participations: participations.map((p: any) => ({
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

  // Real implementations for production operations
  async getCustomerOrders(groupIds?: number[]): Promise<CustomerOrderWithRelations[]> {
    let query = db
      .select({
        customerOrder: customerOrders,
        supplier: suppliers,
        group: groups
      })
      .from(customerOrders)
      .leftJoin(suppliers, eq(customerOrders.supplierId, suppliers.id))
      .leftJoin(groups, eq(customerOrders.groupId, groups.id));

    if (groupIds && groupIds.length > 0) {
      query = query.where(inArray(customerOrders.groupId, groupIds));
    }

    const results = await query.orderBy(desc(customerOrders.createdAt));
    return results.map((row: any) => ({
      ...row.customerOrder,
      supplier: row.supplier,
      group: row.group,
      creator: row.creator || { id: row.customerOrder.createdBy, username: 'unknown' }
    }));
  }

  async getCustomerOrder(id: number): Promise<CustomerOrderWithRelations | undefined> {
    const [result] = await db
      .select({
        customerOrder: customerOrders,
        supplier: suppliers,
        group: groups
      })
      .from(customerOrders)
      .leftJoin(suppliers, eq(customerOrders.supplierId, suppliers.id))
      .leftJoin(groups, eq(customerOrders.groupId, groups.id))
      .where(eq(customerOrders.id, id));

    if (!result) return undefined;
    return {
      ...result.customerOrder,
      supplier: result.supplier,
      group: result.group,
      creator: result.creator || { id: result.customerOrder.createdBy, username: 'unknown' }
    };
  }

  async createCustomerOrder(orderData: InsertCustomerOrder): Promise<CustomerOrder> {
    const [customerOrder] = await db.insert(customerOrders).values(orderData).returning();
    return customerOrder;
  }

  async updateCustomerOrder(id: number, orderData: Partial<InsertCustomerOrder>): Promise<CustomerOrder> {
    const [customerOrder] = await db
      .update(customerOrders)
      .set({ ...orderData, updatedAt: new Date() })
      .where(eq(customerOrders.id, id))
      .returning();
    return customerOrder;
  }

  async deleteCustomerOrder(id: number): Promise<void> {
    await db.delete(customerOrders).where(eq(customerOrders.id, id));
  }

  async getDlcProducts(groupIds?: number[]): Promise<DlcProductWithRelations[]> {
    let query = db
      .select({
        dlcProduct: dlcProducts,
        supplier: suppliers,
        group: groups
      })
      .from(dlcProducts)
      .leftJoin(suppliers, eq(dlcProducts.supplierId, suppliers.id))
      .leftJoin(groups, eq(dlcProducts.groupId, groups.id));

    if (groupIds && groupIds.length > 0) {
      query = query.where(inArray(dlcProducts.groupId, groupIds));
    }

    const results = await query.orderBy(asc(dlcProducts.expiryDate));
    return results.map((row: any) => ({
      ...row.dlcProduct,
      supplier: row.supplier,
      group: row.group,
      creator: row.creator || { id: row.dlcProduct.createdBy, username: 'unknown' }
    }));
  }

  async getDlcProduct(id: number): Promise<DlcProductWithRelations | undefined> {
    const [result] = await db
      .select({
        dlcProduct: dlcProducts,
        supplier: suppliers,
        group: groups
      })
      .from(dlcProducts)
      .leftJoin(suppliers, eq(dlcProducts.supplierId, suppliers.id))
      .leftJoin(groups, eq(dlcProducts.groupId, groups.id))
      .where(eq(dlcProducts.id, id));

    if (!result) return undefined;
    return {
      ...result.dlcProduct,
      supplier: result.supplier,
      group: result.group,
      creator: result.creator || { id: result.dlcProduct.createdBy, username: 'unknown' }
    };
  }

  async createDlcProduct(productData: InsertDlcProduct): Promise<DlcProductFrontend> {
    const [dlcProduct] = await db.insert(dlcProducts).values(productData).returning();
    return { ...dlcProduct, dlcDate: new Date(dlcProduct.expiryDate) } as DlcProductFrontend;
  }

  async updateDlcProduct(id: number, productData: Partial<InsertDlcProduct>): Promise<DlcProductFrontend> {
    const [dlcProduct] = await db
      .update(dlcProducts)
      .set({ ...productData, updatedAt: new Date() })
      .where(eq(dlcProducts.id, id))
      .returning();
    return dlcProduct as DlcProductFrontend;
  }

  async deleteDlcProduct(id: number): Promise<void> {
    await db.delete(dlcProducts).where(eq(dlcProducts.id, id));
  }

  async validateDlcProduct(id: number, validatedBy: string): Promise<DlcProductFrontend> {
    const [dlcProduct] = await db
      .update(dlcProducts)
      .set({ 
        validatedBy,
        validatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(dlcProducts.id, id))
      .returning();
    return dlcProduct as DlcProductFrontend;
  }

  async getDlcStats(groupIds?: number[]): Promise<{ active: number; expiringSoon: number; expired: number; }> {
    const today = new Date();
    const alertDate = new Date();
    alertDate.setDate(today.getDate() + 15);

    let whereCondition = sql`1 = 1`;
    if (groupIds && groupIds.length > 0) {
      whereCondition = inArray(dlcProducts.groupId, groupIds);
    }

    const [stats] = await db
      .select({
        active: sql<number>`COUNT(CASE WHEN ${dlcProducts.expiryDate} > ${today.toISOString().split('T')[0]} THEN 1 END)`,
        expiringSoon: sql<number>`COUNT(CASE WHEN ${dlcProducts.expiryDate} BETWEEN ${today.toISOString().split('T')[0]} AND ${alertDate.toISOString().split('T')[0]} THEN 1 END)`,
        expired: sql<number>`COUNT(CASE WHEN ${dlcProducts.expiryDate} <= ${today.toISOString().split('T')[0]} THEN 1 END)`
      })
      .from(dlcProducts)
      .where(whereCondition);

    return {
      active: stats.active || 0,
      expiringSoon: stats.expiringSoon || 0,
      expired: stats.expired || 0
    };
  }

  async getTasks(groupIds?: number[]): Promise<TaskWithRelations[]> {
    let query = db
      .select({
        task: tasks,
        group: groups
      })
      .from(tasks)
      .leftJoin(groups, eq(tasks.groupId, groups.id));

    if (groupIds && groupIds.length > 0) {
      query = query.where(inArray(tasks.groupId, groupIds));
    }

    const results = await query.orderBy(desc(tasks.createdAt));
    return results.map((row: any) => ({
      ...row.task,
      group: row.group
    }));
  }

  async getTask(id: number): Promise<TaskWithRelations | undefined> {
    const [result] = await db
      .select({
        task: tasks,
        group: groups
      })
      .from(tasks)
      .leftJoin(groups, eq(tasks.groupId, groups.id))
      .where(eq(tasks.id, id));

    if (!result) return undefined;
    return {
      ...result.task,
      group: result.group
    };
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
  }

  async updateTask(id: number, taskData: Partial<InsertTask>): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set({ ...taskData, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async completeTask(id: number, completedBy: string): Promise<void> {
    await db
      .update(tasks)
      .set({ 
        status: 'completed',
        completedAt: new Date(),
        completedBy,
        updatedAt: new Date()
      })
      .where(eq(tasks.id, id));
  }
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
    this.initializeExtraTestData();
  }

  private initializeTestData() {
    // Create admin user
    const adminUser: User = {
      id: 'admin',
      username: 'admin',
      email: 'admin@example.com',
      name: 'Admin',
      firstName: 'Admin',
      lastName: 'User',
      profileImageUrl: null,
      password: 'admin', // In real app, this would be hashed
      role: 'admin',
      passwordChanged: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

    // Create test groups
    const testGroup: Group = {
      id: 1,
      name: 'Magasin Test',
      color: '#3B82F6',
      nocodbConfigId: null,
      nocodbTableName: null,
      invoiceColumnName: null,
      nocodbBlColumnName: null,
      nocodbAmountColumnName: null,
      nocodbSupplierColumnName: null,
      webhookUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.groups.set(testGroup.id, testGroup);
    this.idCounters.group = 2;

    // Create test supplier
    const testSupplier: Supplier = {
      id: 1,
      name: 'Fournisseur Test',
      contact: 'test@supplier.com',
      phone: '0123456789',
      hasDlc: false,
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
      id: userData.id,
      username: userData.username,
      email: userData.email || null,
      name: userData.name || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      password: userData.password || null,
      role: userData.role || 'user',
      passwordChanged: userData.passwordChanged || false,
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
      id,
      name: groupData.name,
      color: groupData.color || null,
      nocodbConfigId: groupData.nocodbConfigId || null,
      nocodbTableName: groupData.nocodbTableName || null,
      invoiceColumnName: groupData.invoiceColumnName || null,
      nocodbBlColumnName: groupData.nocodbBlColumnName || null,
      nocodbAmountColumnName: groupData.nocodbAmountColumnName || null,
      nocodbSupplierColumnName: groupData.nocodbSupplierColumnName || null,
      webhookUrl: groupData.webhookUrl || null,
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
      id,
      name: supplierData.name,
      contact: supplierData.contact || null,
      phone: supplierData.phone || null,
      hasDlc: supplierData.hasDlc || null,
      automaticReconciliation: supplierData.automaticReconciliation || null,
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
      id: 1,
      name: config.name,
      baseUrl: config.baseUrl,
      projectId: config.projectId,
      apiToken: config.apiToken,
      description: config.description || null,
      isActive: config.isActive ?? true,
      createdBy: config.createdBy || null,
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
      description: config.description || null,
      isActive: config.isActive ?? true,
      createdBy: config.createdBy || null,
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
      id: 1,
      cacheKey: cache.cacheKey,
      groupId: cache.groupId,
      invoiceReference: cache.invoiceReference,
      supplierName: cache.supplierName || null,
      exists: cache.exists,
      matchType: cache.matchType,
      errorMessage: cache.errorMessage || null,
      cacheHit: cache.cacheHit || false,
      apiCallTime: cache.apiCallTime || null,
      expiresAt: cache.expiresAt,
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

  async getCustomerOrders(groupIds?: number[]): Promise<CustomerOrderWithRelations[]> {
    let orders = Array.from(this.customerOrders.values());
    
    if (groupIds && groupIds.length > 0) {
      orders = orders.filter(order => groupIds.includes(order.groupId));
    }
    
    return orders.map(order => ({
      ...order,
      supplier: this.suppliers.get(order.supplierId)!,
      group: this.groups.get(order.groupId)!,
      creator: this.users.get(order.createdBy)!
    }));
  }

  async getCustomerOrder(id: number): Promise<CustomerOrderWithRelations | undefined> {
    const order = this.customerOrders.get(id);
    if (!order) return undefined;
    
    return {
      ...order,
      supplier: this.suppliers.get(order.supplierId)!,
      group: this.groups.get(order.groupId)!,
      creator: this.users.get(order.createdBy)!
    };
  }

  async createCustomerOrder(orderData: InsertCustomerOrder): Promise<CustomerOrder> {
    const id = this.idCounters.customerOrder++;
    const order: CustomerOrder = {
      id,
      ...orderData,
      status: orderData.status || 'En attente de Commande',
      quantity: orderData.quantity || 1,
      deposit: orderData.deposit || "0.00" as any,
      isPromotionalPrice: orderData.isPromotionalPrice || false,
      customerNotified: orderData.customerNotified || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.customerOrders.set(id, order);
    return order;
  }

  async updateCustomerOrder(id: number, orderData: Partial<InsertCustomerOrder>): Promise<CustomerOrder> {
    const existingOrder = this.customerOrders.get(id);
    if (!existingOrder) throw new Error('Customer order not found');
    
    const updatedOrder = { ...existingOrder, ...orderData, updatedAt: new Date() };
    this.customerOrders.set(id, updatedOrder);
    return updatedOrder;
  }

  async deleteCustomerOrder(id: number): Promise<void> {
    this.customerOrders.delete(id);
  }

  async getDlcProducts(groupIds?: number[], filters?: { status?: string; supplierId?: number; }): Promise<DlcProductWithRelations[]> {
    let products = Array.from(this.dlcProducts.values());
    
    if (groupIds && groupIds.length > 0) {
      products = products.filter(product => groupIds.includes(product.groupId));
    }
    
    if (filters) {
      if (filters.status) {
        products = products.filter(product => product.status === filters.status);
      }
      if (filters.supplierId) {
        products = products.filter(product => product.supplierId === filters.supplierId);
      }
    }
    
    return products.map(product => ({
      ...product,
      supplier: this.suppliers.get(product.supplierId)!,
      group: this.groups.get(product.groupId)!,
      creator: this.users.get(product.createdBy)!
    }));
  }

  async getDlcProduct(id: number): Promise<DlcProductWithRelations | undefined> {
    const product = this.dlcProducts.get(id);
    if (!product) return undefined;
    
    return {
      ...product,
      supplier: this.suppliers.get(product.supplierId)!,
      group: this.groups.get(product.groupId)!,
      creator: this.users.get(product.createdBy)!
    };
  }

  async createDlcProduct(productData: InsertDlcProduct): Promise<DlcProductFrontend> {
    const id = this.idCounters.dlcProduct++;
    const product: DlcProduct = {
      id,
      ...productData,
      status: productData.status || 'en_cours',
      quantity: productData.quantity || 1,
      unit: productData.unit || 'unité',
      location: productData.location || 'Magasin',
      alertThreshold: productData.alertThreshold || 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.dlcProducts.set(id, product);
    return { ...product, dlcDate: new Date(product.expiryDate) } as DlcProductFrontend;
  }

  async updateDlcProduct(id: number, productData: Partial<InsertDlcProduct>): Promise<DlcProductFrontend> {
    const existingProduct = this.dlcProducts.get(id);
    if (!existingProduct) throw new Error('DLC Product not found');
    
    const updatedProduct = { ...existingProduct, ...productData, updatedAt: new Date() };
    this.dlcProducts.set(id, updatedProduct);
    return { ...updatedProduct, dlcDate: new Date(updatedProduct.expiryDate) } as DlcProductFrontend;
  }

  async deleteDlcProduct(id: number): Promise<void> {
    this.dlcProducts.delete(id);
  }

  async validateDlcProduct(id: number, validatedBy: string): Promise<DlcProductFrontend> {
    const existingProduct = this.dlcProducts.get(id);
    if (!existingProduct) throw new Error('DLC Product not found');
    
    const updatedProduct = { 
      ...existingProduct, 
      validatedBy,
      validatedAt: new Date(),
      updatedAt: new Date() 
    };
    this.dlcProducts.set(id, updatedProduct);
    return { ...updatedProduct, dlcDate: new Date(updatedProduct.expiryDate) } as DlcProductFrontend;
  }

  async getDlcStats(groupIds?: number[]): Promise<{ active: number; expiringSoon: number; expired: number; }> {
    const today = new Date();
    const alertDate = new Date();
    alertDate.setDate(today.getDate() + 15);

    let products = Array.from(this.dlcProducts.values());
    
    if (groupIds && groupIds.length > 0) {
      products = products.filter(product => groupIds.includes(product.groupId));
    }
    
    return {
      active: products.filter(p => new Date(p.expiryDate) > today).length,
      expiringSoon: products.filter(p => {
        const expiry = new Date(p.expiryDate);
        return expiry >= today && expiry <= alertDate;
      }).length,
      expired: products.filter(p => new Date(p.expiryDate) <= today).length
    };
  }

  async getTasks(groupIds?: number[]): Promise<TaskWithRelations[]> {
    let tasks = Array.from(this.tasks.values());
    
    if (groupIds && groupIds.length > 0) {
      tasks = tasks.filter(task => groupIds.includes(task.groupId));
    }
    
    return tasks.map(task => ({
      ...task,
      group: this.groups.get(task.groupId)!,
      creator: this.users.get(task.createdBy)!
    }));
  }

  async getTask(id: number): Promise<TaskWithRelations | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    return {
      ...task,
      group: this.groups.get(task.groupId)!,
      creator: this.users.get(task.createdBy)!
    };
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    const id = this.idCounters.task++;
    const task: Task = {
      id,
      ...taskData,
      status: taskData.status || 'pending',
      priority: taskData.priority || 'medium',
      completedAt: null,
      completedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(id, task);
    return task;
  }

  private initializeExtraTestData() {
    // Add test customer orders
    const testOrder1: CustomerOrder = {
      id: 1,
      supplierId: 1,
      groupId: 1,
      createdBy: 'admin',
      orderTaker: 'Admin',
      customerName: 'Marie Dupont',
      customerPhone: '0123456789',
      productDesignation: 'Table de jardin',
      quantity: 2,
      deposit: '150.00' as any,
      status: 'En attente de Commande',
      isPromotionalPrice: false,
      customerNotified: false,
      notes: 'Livraison urgente demandée',
      createdAt: new Date('2025-01-15'),
      updatedAt: new Date('2025-01-15'),
    };
    
    const testOrder2: CustomerOrder = {
      id: 2,
      supplierId: 1,
      groupId: 1,
      createdBy: 'admin',
      orderTaker: 'Admin',
      customerName: 'Pierre Martin',
      customerPhone: '0987654321',
      productDesignation: 'Chaises pliantes x4',
      quantity: 1,
      deposit: '80.00' as any,
      status: 'Commande passée',
      isPromotionalPrice: true,
      customerNotified: true,
      notes: null,
      createdAt: new Date('2025-01-10'),
      updatedAt: new Date('2025-01-12'),
    };

    this.customerOrders.set(1, testOrder1);
    this.customerOrders.set(2, testOrder2);
    this.idCounters.customerOrder = 3;

    // Add test DLC products
    const testDlc1: DlcProduct = {
      id: 1,
      supplierId: 1,
      groupId: 1,
      createdBy: 'admin',
      productName: 'Yaourts bio',
      expiryDate: '2025-08-20',
      status: 'en_cours',
      quantity: 24,
      unit: 'pièces',
      notes: 'À vendre rapidement',
      location: 'Frigo principal',
      alertThreshold: 5,
      validatedBy: null,
      validatedAt: null,
      createdAt: new Date('2025-08-10'),
      updatedAt: new Date('2025-08-10'),
    };

    const testDlc2: DlcProduct = {
      id: 2,
      supplierId: 1,
      groupId: 1,
      createdBy: 'admin',
      productName: 'Pain de mie complet',
      expiryDate: '2025-08-16',
      status: 'alerte',
      quantity: 8,
      unit: 'unités',
      notes: 'DLC proche, promotion conseillée',
      location: 'Rayonnage A3',
      alertThreshold: 3,
      validatedBy: null,
      validatedAt: null,
      createdAt: new Date('2025-08-08'),
      updatedAt: new Date('2025-08-13'),
    };

    this.dlcProducts.set(1, testDlc1);
    this.dlcProducts.set(2, testDlc2);
    this.idCounters.dlcProduct = 3;

    // Add test tasks
    const testTask1: Task = {
      id: 1,
      groupId: 1,
      createdBy: 'admin',
      title: 'Vérifier stock yaourts',
      description: 'Contrôler les DLC des yaourts et organiser la rotation',
      status: 'pending',
      priority: 'high',
      assignedTo: 'admin',
      dueDate: new Date('2025-08-15'),
      completedAt: null,
      completedBy: null,
      createdAt: new Date('2025-08-13'),
      updatedAt: new Date('2025-08-13'),
    };

    const testTask2: Task = {
      id: 2,
      groupId: 1,
      createdBy: 'admin',
      title: 'Contacter fournisseur',
      description: 'Appeler le fournisseur pour confirmer la livraison de demain',
      status: 'in_progress',
      priority: 'medium',
      assignedTo: 'admin',
      dueDate: new Date('2025-08-14'),
      completedAt: null,
      completedBy: null,
      createdAt: new Date('2025-08-12'),
      updatedAt: new Date('2025-08-13'),
    };

    this.tasks.set(1, testTask1);
    this.tasks.set(2, testTask2);
    this.idCounters.task = 3;
  }

  async updateTask(id: number, taskData: Partial<InsertTask>): Promise<Task> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) throw new Error('Task not found');
    
    const updatedTask = { ...existingTask, ...taskData, updatedAt: new Date() };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: number): Promise<void> {
    this.tasks.delete(id);
  }

  async completeTask(id: number, completedBy: string): Promise<void> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) throw new Error('Task not found');
    
    const updatedTask = { 
      ...existingTask, 
      status: 'completed' as const,
      completedAt: new Date(),
      completedBy,
      updatedAt: new Date() 
    };
    this.tasks.set(id, updatedTask);
  }
}

// FORCE: Use DatabaseStorage to see real production data
console.log('🔗 Database initialization:', {
  NODE_ENV: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production',
  hasDbUrl: !!process.env.DATABASE_URL,
  dbHost: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown'
});

// Force DatabaseStorage for real data access
export const storage: IStorage = new DatabaseStorage();
console.log('✅ Using DatabaseStorage (real PostgreSQL data)');