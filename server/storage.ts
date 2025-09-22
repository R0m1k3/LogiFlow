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
  dashboardMessages,
  announcements,
  nocodbConfig,
  invoiceVerificationCache,
  reconciliationComments,
  savTickets,
  savTicketHistory,
  weatherData,
  weatherSettings,
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
  type Announcement,
  type InsertAnnouncement,
  type AnnouncementWithRelations,
  type ReconciliationComment,
  type InsertReconciliationComment,
  type ReconciliationCommentWithRelations,
  type NocodbConfig,
  type InsertNocodbConfig,
  type InvoiceVerificationCache,
  type InsertInvoiceVerificationCache,
  type SavTicket,
  type InsertSavTicket,
  type SavTicketHistory,
  type InsertSavTicketHistory,
  type SavTicketWithRelations,
  type SavTicketHistoryWithCreator,
  type WeatherData,
  type InsertWeatherData,
  type WeatherSettings,
  type InsertWeatherSettings,
  webhookBapConfig,
  type WebhookBapConfig,
  type InsertWebhookBapConfig,
  avoirs,
  type Avoir,
  type InsertAvoir,
  type AvoirWithRelations,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, desc, sql, gte, lte, lt, gt, or, isNull, isNotNull, asc, ne } from "drizzle-orm";
import { getAnnouncementStorage } from "./announcementStorage";


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
  getYearlyStats(year: number, groupIds?: number[]): Promise<{
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
  saveInvoiceVerificationCache(cache: InsertInvoiceVerificationCache): Promise<InvoiceVerificationCache>;
  createInvoiceVerificationCache(cache: InsertInvoiceVerificationCache): Promise<InvoiceVerificationCache>;
  clearExpiredCache(): Promise<void>;
  
  // Customer Order operations
  getCustomerOrders(groupIds?: number[]): Promise<CustomerOrderWithRelations[]>;
  getCustomerOrder(id: number): Promise<CustomerOrderWithRelations | undefined>;
  createCustomerOrder(customerOrder: InsertCustomerOrder): Promise<CustomerOrder>;
  updateCustomerOrder(id: number, customerOrder: Partial<InsertCustomerOrder>): Promise<CustomerOrder>;
  deleteCustomerOrder(id: number): Promise<void>;
  
  // Client call tracking
  getPendingClientCalls(groupIds?: number[]): Promise<CustomerOrderWithRelations[]>;
  markClientCalled(customerOrderId: number, calledBy: string): Promise<CustomerOrder>;

  // DLC Product operations
  getDlcProducts(groupIds?: number[], filters?: { status?: string; supplierId?: number; search?: string; }): Promise<DlcProductWithRelations[]>;
  getDlcProduct(id: number): Promise<DlcProductWithRelations | undefined>;
  createDlcProduct(dlcProduct: InsertDlcProduct): Promise<DlcProductFrontend>;
  updateDlcProduct(id: number, dlcProduct: Partial<InsertDlcProduct>): Promise<DlcProductFrontend>;
  deleteDlcProduct(id: number): Promise<void>;
  validateDlcProduct(id: number, validatedBy: string): Promise<DlcProductFrontend>;
  markDlcProductStockEpuise(id: number, markedBy: string): Promise<DlcProductFrontend>;
  restoreDlcProductStock(id: number): Promise<DlcProductFrontend>;
  getDlcStats(groupIds?: number[]): Promise<{ active: number; expiringSoon: number; expired: number; }>;

  // Task operations  
  getTasks(groupIds?: number[], userRole?: string): Promise<any[]>;
  getTask(id: number): Promise<any | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  completeTask(id: number, completedBy?: string): Promise<void>;

  // Announcement operations
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  getAnnouncements(groupIds?: number[]): Promise<AnnouncementWithRelations[]>;
  getAnnouncement(id: number): Promise<AnnouncementWithRelations | undefined>;
  updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<AnnouncementWithRelations>;
  deleteAnnouncement(id: number): Promise<boolean>;

  // Avoir operations
  getAvoirs(groupIds?: number[]): Promise<AvoirWithRelations[]>;
  getAvoir(id: number): Promise<AvoirWithRelations | undefined>;
  createAvoir(avoir: InsertAvoir): Promise<Avoir>;
  updateAvoir(id: number, avoir: Partial<InsertAvoir>): Promise<Avoir>;
  deleteAvoir(id: number): Promise<void>;
  updateAvoirWebhookStatus(id: number, webhookSent: boolean): Promise<void>;
  updateAvoirNocodbVerification(id: number, verified: boolean): Promise<void>;
  
  // SAV operations
  getSavTickets(filters?: { 
    groupIds?: number[]; 
    status?: string; 
    supplierId?: number; 
    priority?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SavTicketWithRelations[]>;
  getSavTicket(id: number): Promise<SavTicketWithRelations | undefined>;
  createSavTicket(ticket: InsertSavTicket): Promise<SavTicket>;
  updateSavTicket(id: number, ticket: Partial<InsertSavTicket>): Promise<SavTicket>;
  deleteSavTicket(id: number): Promise<void>;
  getSavTicketHistory(ticketId: number): Promise<SavTicketHistoryWithCreator[]>;
  addSavTicketHistory(history: InsertSavTicketHistory): Promise<SavTicketHistory>;
  getSavTicketStats(groupIds?: number[]): Promise<{
    totalTickets: number;
    newTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    criticalTickets: number;
  }>;

  // Weather operations
  getWeatherSettings(): Promise<WeatherSettings | undefined>;
  createWeatherSettings(settings: InsertWeatherSettings): Promise<WeatherSettings>;
  updateWeatherSettings(id: number, settings: Partial<InsertWeatherSettings>): Promise<WeatherSettings>;
  getWeatherData(date: string, isCurrentYear: boolean): Promise<WeatherData | undefined>;
  createWeatherData(data: InsertWeatherData): Promise<WeatherData>;
  updateWeatherData(id: number, data: Partial<InsertWeatherData>): Promise<WeatherData>;
  deleteOldWeatherData(daysToKeep: number): Promise<void>;
  clearWeatherCache(): Promise<void>;

  // Webhook BAP Configuration
  getWebhookBapConfig(): Promise<WebhookBapConfig | undefined>;
  createWebhookBapConfig(config: InsertWebhookBapConfig): Promise<WebhookBapConfig>;
  updateWebhookBapConfig(id: number, config: Partial<InsertWebhookBapConfig>): Promise<WebhookBapConfig>;

  // Reconciliation Comments operations
  getReconciliationComments(deliveryId: number): Promise<ReconciliationCommentWithRelations[]>;
  getReconciliationCommentById(id: number): Promise<ReconciliationCommentWithRelations | undefined>;
  createReconciliationComment(comment: InsertReconciliationComment): Promise<ReconciliationComment>;
  updateReconciliationComment(id: number, comment: Partial<InsertReconciliationComment>): Promise<ReconciliationComment>;
  deleteReconciliationComment(id: number): Promise<void>;
  
  // Analytics operations
  getAnalyticsSummary(filters: {
    startDate?: Date;
    endDate?: Date;
    supplierIds?: number[];
    groupIds?: number[];
    status?: string[];
  }): Promise<{
    totalOrders: number;
    totalDeliveries: number;
    onTimeRate: number;
    totalAmount: number;
    avgDeliveryDelay: number;
    topSuppliers: Array<{ id: number; name: string; count: number; amount: number }>;
    topStores: Array<{ id: number; name: string; orders: number; deliveries: number }>;
  }>;
  
  getAnalyticsTimeseries(filters: {
    startDate?: Date;
    endDate?: Date;
    supplierIds?: number[];
    groupIds?: number[];
    granularity?: 'day' | 'week' | 'month';
  }): Promise<Array<{ date: string; orders: number; deliveries: number }>>;
  
  getAnalyticsBySupplier(filters: {
    startDate?: Date;
    endDate?: Date;
    groupIds?: number[];
  }): Promise<Array<{ supplierId: number; supplierName: string; deliveries: number; amount: number }>>;
  
  getAnalyticsByStore(filters: {
    startDate?: Date;
    endDate?: Date;
    supplierIds?: number[];
  }): Promise<Array<{ groupId: number; storeName: string; orders: number; deliveries: number }>>;
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
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email
        }
      })
      .from(orders)
      .leftJoin(suppliers, eq(orders.supplierId, suppliers.id))
      .leftJoin(groups, eq(orders.groupId, groups.id))
      .leftJoin(users, eq(orders.createdBy, users.id));

    if (groupIds && groupIds.length > 0) {
      query = query.where(inArray(orders.groupId, groupIds));
    }

    const baseOrders = await query.orderBy(desc(orders.createdAt));

    // Pour chaque commande, récupérer ses livraisons associées (PRODUCTION RELATIONS)
    const ordersWithDeliveries = await Promise.all(
      baseOrders.map(async (order) => {
        const associatedDeliveries = await db
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
            creator: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              username: users.username,
              email: users.email
            }
          })
          .from(deliveries)
          .leftJoin(suppliers, eq(deliveries.supplierId, suppliers.id))
          .leftJoin(groups, eq(deliveries.groupId, groups.id))
          .leftJoin(users, eq(deliveries.createdBy, users.id))
          .where(eq(deliveries.orderId, order.id));

        return {
          ...order,
          deliveries: associatedDeliveries
        };
      })
    );

    console.log(`🔗 PRODUCTION: getOrders() récupéré ${ordersWithDeliveries.length} commandes avec relations`);
    return ordersWithDeliveries as OrderWithRelations[];
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
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email
        }
      })
      .from(orders)
      .leftJoin(suppliers, eq(orders.supplierId, suppliers.id))
      .leftJoin(groups, eq(orders.groupId, groups.id))
      .leftJoin(users, eq(orders.createdBy, users.id))
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

    const baseOrders = await query.orderBy(desc(orders.plannedDate));

    // Pour chaque commande, récupérer ses livraisons associées (PRODUCTION RELATIONS)
    const ordersWithDeliveries = await Promise.all(
      baseOrders.map(async (order) => {
        const associatedDeliveries = await db
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
            creator: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              username: users.username,
              email: users.email
            }
          })
          .from(deliveries)
          .leftJoin(suppliers, eq(deliveries.supplierId, suppliers.id))
          .leftJoin(groups, eq(deliveries.groupId, groups.id))
          .leftJoin(users, eq(deliveries.createdBy, users.id))
          .where(eq(deliveries.orderId, order.id));

        return {
          ...order,
          deliveries: associatedDeliveries
        };
      })
    );

    return ordersWithDeliveries as OrderWithRelations[];
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
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email
        }
      })
      .from(orders)
      .leftJoin(suppliers, eq(orders.supplierId, suppliers.id))
      .leftJoin(groups, eq(orders.groupId, groups.id))
      .leftJoin(users, eq(orders.createdBy, users.id))
      .where(eq(orders.id, id));

    if (!order) return undefined;

    // Récupérer les livraisons associées à cette commande (PRODUCTION PostgreSQL)
    const associatedDeliveries = await db
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
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email
        }
      })
      .from(deliveries)
      .leftJoin(suppliers, eq(deliveries.supplierId, suppliers.id))
      .leftJoin(groups, eq(deliveries.groupId, groups.id))
      .leftJoin(users, eq(deliveries.createdBy, users.id))
      .where(eq(deliveries.orderId, id));

    console.log(`🔗 PRODUCTION: getOrder #${id} found ${associatedDeliveries.length} associated deliveries`);

    return {
      ...order,
      deliveries: associatedDeliveries
    } as OrderWithRelations;
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
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email
        }
      })
      .from(deliveries)
      .leftJoin(suppliers, eq(deliveries.supplierId, suppliers.id))
      .leftJoin(groups, eq(deliveries.groupId, groups.id))
      .leftJoin(users, eq(deliveries.createdBy, users.id));

    if (groupIds && groupIds.length > 0) {
      query = query.where(inArray(deliveries.groupId, groupIds));
    }

    const baseDeliveries = await query.orderBy(desc(deliveries.createdAt));

    // Pour chaque livraison, récupérer sa commande associée si elle existe (PRODUCTION RELATIONS)
    const deliveriesWithOrders = await Promise.all(
      baseDeliveries.map(async (delivery) => {
        let associatedOrder = undefined;
        
        if (delivery.orderId) {
          try {
            const [orderData] = await db
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
                creator: {
                  id: users.id,
                  firstName: users.firstName,
                  lastName: users.lastName,
                  username: users.username,
                  email: users.email
                }
              })
              .from(orders)
              .leftJoin(suppliers, eq(orders.supplierId, suppliers.id))
              .leftJoin(groups, eq(orders.groupId, groups.id))
              .leftJoin(users, eq(orders.createdBy, users.id))
              .where(eq(orders.id, delivery.orderId));

            if (orderData) {
              // CRITICAL FIX: Vérifier que la commande appartient au même magasin que la livraison
              if (orderData.groupId !== delivery.groupId) {
                console.error(`❌ PRODUCTION: Delivery #${delivery.id} (store ${delivery.groupId}) linked to order #${delivery.orderId} (store ${orderData.groupId}) - STORE MISMATCH DETECTED!`);
                // Ne pas inclure la commande si elle n'appartient pas au bon magasin
              } else {
                associatedOrder = orderData;
              }
            }
          } catch (error) {
            console.error(`❌ PRODUCTION: Failed to retrieve associated order #${delivery.orderId} for delivery #${delivery.id}:`, error);
          }
        }

        // Compter les commentaires de rapprochement pour cette livraison
        let commentsCount = 0;
        try {
          const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(reconciliationComments)
            .where(eq(reconciliationComments.deliveryId, delivery.id));
          
          commentsCount = Number(countResult?.count || 0);
        } catch (error) {
          console.error(`Failed to count reconciliation comments for delivery #${delivery.id}:`, error);
        }

        return {
          ...delivery,
          order: associatedOrder,
          reconciliationCommentsCount: commentsCount
        };
      })
    );

    console.log(`🔗 PRODUCTION: getDeliveries() récupéré ${deliveriesWithOrders.length} livraisons avec relations`);
    return deliveriesWithOrders as DeliveryWithRelations[];
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
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email
        }
      })
      .from(deliveries)
      .leftJoin(suppliers, eq(deliveries.supplierId, suppliers.id))
      .leftJoin(groups, eq(deliveries.groupId, groups.id))
      .leftJoin(users, eq(deliveries.createdBy, users.id))
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

    const baseDeliveries = await query.orderBy(desc(deliveries.scheduledDate));

    // Pour chaque livraison, récupérer sa commande associée si elle existe (PRODUCTION RELATIONS)
    const deliveriesWithOrders = await Promise.all(
      baseDeliveries.map(async (delivery) => {
        let associatedOrder = undefined;
        
        if (delivery.orderId) {
          try {
            const [orderData] = await db
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
                creator: {
                  id: users.id,
                  firstName: users.firstName,
                  lastName: users.lastName,
                  username: users.username,
                  email: users.email
                }
              })
              .from(orders)
              .leftJoin(suppliers, eq(orders.supplierId, suppliers.id))
              .leftJoin(groups, eq(orders.groupId, groups.id))
              .leftJoin(users, eq(orders.createdBy, users.id))
              .where(eq(orders.id, delivery.orderId));

            if (orderData) {
              // CRITICAL FIX: Vérifier que la commande appartient au même magasin que la livraison
              if (orderData.groupId !== delivery.groupId) {
                console.error(`❌ PRODUCTION: Delivery #${delivery.id} (store ${delivery.groupId}) linked to order #${delivery.orderId} (store ${orderData.groupId}) - STORE MISMATCH DETECTED!`);
                // Ne pas inclure la commande si elle n'appartient pas au bon magasin
              } else {
                associatedOrder = orderData;
              }
            }
          } catch (error) {
            console.error(`❌ PRODUCTION: Failed to retrieve associated order #${delivery.orderId} for delivery #${delivery.id}:`, error);
          }
        }

        // Compter les commentaires de rapprochement pour cette livraison
        let commentsCount = 0;
        try {
          const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(reconciliationComments)
            .where(eq(reconciliationComments.deliveryId, delivery.id));
          
          commentsCount = Number(countResult?.count || 0);
        } catch (error) {
          console.error(`Failed to count reconciliation comments for delivery #${delivery.id}:`, error);
        }

        return {
          ...delivery,
          order: associatedOrder,
          reconciliationCommentsCount: commentsCount
        };
      })
    );

    return deliveriesWithOrders as DeliveryWithRelations[];
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
        group: groups
      })
      .from(deliveries)
      .leftJoin(suppliers, eq(deliveries.supplierId, suppliers.id))
      .leftJoin(groups, eq(deliveries.groupId, groups.id))
      .where(eq(deliveries.id, id));

    if (!delivery) return undefined;

    // Add creator info separately to avoid complex JOIN issues in production
    let creator = null;
    try {
      const user = await this.getUser(delivery.createdBy);
      if (user) {
        creator = {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          email: user.email
        };
      }
    } catch (error) {
      console.log('⚠️ Could not load creator info:', error);
    }

    // Récupérer la commande associée si elle existe (PRODUCTION PostgreSQL)
    let associatedOrder = undefined;
    if (delivery.orderId) {
      try {
        console.log(`🔗 PRODUCTION: getDelivery #${id} retrieving associated order #${delivery.orderId}`);
        const orderData = await this.getOrder(delivery.orderId);
        if (orderData) {
          // CRITICAL FIX: Vérifier que la commande appartient au même magasin que la livraison
          if (orderData.groupId !== delivery.groupId) {
            console.error(`❌ PRODUCTION: getDelivery #${id} (store ${delivery.groupId}) linked to order #${delivery.orderId} (store ${orderData.groupId}) - STORE MISMATCH DETECTED!`);
            // Ne pas inclure la commande si elle n'appartient pas au bon magasin
          } else {
            associatedOrder = orderData;
            console.log(`✅ PRODUCTION: getDelivery #${id} found associated order #${delivery.orderId} with status: ${orderData.status}`);
          }
        }
      } catch (error) {
        console.error(`❌ PRODUCTION: Failed to retrieve associated order #${delivery.orderId} for delivery #${id}:`, error);
      }
    }

    // Compter les commentaires de rapprochement pour cette livraison
    let commentsCount = 0;
    try {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(reconciliationComments)
        .where(eq(reconciliationComments.deliveryId, id));
      
      commentsCount = Number(countResult?.count || 0);
    } catch (error) {
      console.error(`Failed to count reconciliation comments for delivery #${id}:`, error);
    }

    return {
      ...delivery,
      creator,
      order: associatedOrder,
      reconciliationCommentsCount: commentsCount
    } as DeliveryWithRelations;
  }

  async createDelivery(deliveryData: InsertDelivery): Promise<Delivery> {
    // Créer la livraison avec statut "planned" par défaut
    const deliveryDataWithStatus = {
      ...deliveryData,
      status: deliveryData.status || 'planned' // Force planned status by default
    };
    
    const [delivery] = await db.insert(deliveries).values(deliveryDataWithStatus).returning();
    
    // Si une commande est liée, la marquer comme "planned" (pas delivered!)
    if (deliveryData.orderId) {
      try {
        console.log(`🔗 PRODUCTION: Delivery #${delivery.id} linked to order #${deliveryData.orderId}, updating order status to 'planned'`);
        
        // Récupérer la commande actuelle
        const [currentOrder] = await db
          .select()
          .from(orders)
          .where(eq(orders.id, deliveryData.orderId));
        
        if (currentOrder && currentOrder.status === 'pending') {
          await db
            .update(orders)
            .set({ 
              status: 'planned',
              updatedAt: new Date() 
            })
            .where(eq(orders.id, deliveryData.orderId));
          
          console.log(`✅ PRODUCTION: Order #${deliveryData.orderId} status updated to 'planned'`);
        }
      } catch (error) {
        console.error(`❌ PRODUCTION: Failed to update order #${deliveryData.orderId} status to planned:`, error);
      }
    }
    
    return delivery;
  }

  async updateDelivery(id: number, deliveryData: Partial<InsertDelivery>): Promise<Delivery> {
    const [delivery] = await db
      .update(deliveries)
      .set({ ...deliveryData, updatedAt: new Date() })
      .where(eq(deliveries.id, id))
      .returning();
    
    // CRITICAL FIX: Si une commande est liée lors de l'édition, la marquer comme "planned"
    if (deliveryData.orderId) {
      try {
        console.log(`🔗 CALENDAR EDIT: Delivery #${delivery.id} linked to order #${deliveryData.orderId}, updating order status to 'planned'`);
        
        // Récupérer la commande actuelle
        const [currentOrder] = await db
          .select()
          .from(orders)
          .where(eq(orders.id, deliveryData.orderId));
        
        if (currentOrder && currentOrder.status === 'pending') {
          await db
            .update(orders)
            .set({ 
              status: 'planned',
              updatedAt: new Date() 
            })
            .where(eq(orders.id, deliveryData.orderId));
          
          console.log(`✅ CALENDAR EDIT: Order #${deliveryData.orderId} status updated to 'planned'`);
        } else if (currentOrder) {
          console.log(`ℹ️ CALENDAR EDIT: Order #${deliveryData.orderId} status is '${currentOrder.status}', no update needed`);
        }
      } catch (error) {
        console.error(`❌ CALENDAR EDIT: Failed to update order #${deliveryData.orderId} status to planned:`, error);
      }
    }
    
    return delivery;
  }

  async deleteDelivery(id: number): Promise<void> {
    await db.delete(deliveries).where(eq(deliveries.id, id));
  }

  async validateDelivery(id: number, blData?: { blNumber: string; blAmount: number }): Promise<void> {
    const updateData: any = {
      status: 'delivered',
      deliveredDate: new Date(),
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

      // Construire les conditions pour le filtrage par groupe - UTILISER LE BON CHAMP DE DATE
      let ordersWhereCondition = and(
        gte(orders.plannedDate, startDate),
        lt(orders.plannedDate, endDate)
      );
      // Pour les livraisons, utiliser deliveredDate pour celles livrées, sinon scheduledDate
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

      // Calculer les totaux de palettes et colis du mois (SEULEMENT livraisons delivered)
      // IMPORTANT: Utiliser deliveredDate pour filtrer par le mois de livraison effective
      let deliveredWhereCondition = and(
        gte(deliveries.deliveredDate, sql`${startDate}::timestamp`),
        lt(deliveries.deliveredDate, sql`${endDate}::timestamp`),
        eq(deliveries.status, 'delivered'),
        isNotNull(deliveries.deliveredDate)
      );

      // Ajouter le filtre par groupe pour les livraisons delivered
      if (groupIds && groupIds.length > 0) {
        deliveredWhereCondition = and(deliveredWhereCondition, inArray(deliveries.groupId, groupIds));
      }

      // NOUVEAU: Calculer le délai moyen entre la date de commande et la date de livraison
      // Uniquement pour les livraisons qui ont une commande liée
      const deliveriesStatsResult = await db
        .select({
          totalPalettes: sql<number>`COALESCE(SUM(CAST(${deliveries.quantity} as INTEGER)), 0)`,
          totalPackages: sql<number>`COALESCE(COUNT(*), 0)`,
          avgDelay: sql<number>`COALESCE(AVG(EXTRACT(DAY FROM (${deliveries.deliveredDate} - ${orders.plannedDate}))), 0)`
        })
        .from(deliveries)
        .innerJoin(orders, eq(deliveries.orderId, orders.id))
        .where(
          and(
            deliveredWhereCondition,
            isNotNull(deliveries.orderId), // S'assurer qu'il y a une commande liée
            isNotNull(orders.plannedDate)  // S'assurer que la commande a une date
          )
        );

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
        averageDeliveryTime: `${averageDeliveryTime} jours (commande → livraison, livraisons avec commande liée uniquement)`,
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

  // Statistics annuelles
  async getYearlyStats(year: number, groupIds?: number[]): Promise<{
    ordersCount: number;
    deliveriesCount: number;
    pendingOrdersCount: number;
    averageDeliveryTime: number;
    totalPalettes: number;
    totalPackages: number;
  }> {
    // En mode développement avec MemStorage, retourner des statistiques simulées
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Mode développement - statistiques annuelles simulées');
      return {
        ordersCount: 144, // 12 mois * 12
        deliveriesCount: 96, // 12 mois * 8  
        pendingOrdersCount: 18, // 12 mois * 1.5
        averageDeliveryTime: 2.8, // Délai moyen annuel
        totalPalettes: 540, // 12 mois * 45
        totalPackages: 1872, // 12 mois * 156
      };
    }

    // En production, calculer les vraies statistiques sur l'année
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    try {
      console.log('📊 Calcul statistiques annuelles:', { year, startDate, endDate, groupIds });

      // Construire les conditions pour le filtrage par groupe
      let ordersWhereCondition = and(
        gte(orders.plannedDate, startDate),
        lt(orders.plannedDate, endDate)
      );
      let deliveriesWhereCondition = and(
        gte(deliveries.deliveredDate, sql`${startDate}::timestamp`),
        lt(deliveries.deliveredDate, sql`${endDate}::timestamp`)
      );

      // Ajouter le filtre par groupe si spécifié
      if (groupIds && groupIds.length > 0) {
        ordersWhereCondition = and(ordersWhereCondition, inArray(orders.groupId, groupIds));
        deliveriesWhereCondition = and(deliveriesWhereCondition, inArray(deliveries.groupId, groupIds));
      }

      // Compter les commandes de l'année
      const ordersResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(ordersWhereCondition);

      // Compter les livraisons de l'année
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

      // Calculer les totaux de palettes et colis de l'année (SEULEMENT livraisons delivered)
      let deliveredWhereCondition = and(
        gte(deliveries.deliveredDate, sql`${startDate}::timestamp`),
        lt(deliveries.deliveredDate, sql`${endDate}::timestamp`),
        eq(deliveries.status, 'delivered'),
        isNotNull(deliveries.deliveredDate)
      );

      // Ajouter le filtre par groupe pour les livraisons delivered
      if (groupIds && groupIds.length > 0) {
        deliveredWhereCondition = and(deliveredWhereCondition, inArray(deliveries.groupId, groupIds));
      }

      // NOUVEAU: Calculer le délai moyen entre la date de commande et la date de livraison
      // Uniquement pour les livraisons qui ont une commande liée
      const deliveriesStatsResult = await db
        .select({
          totalPalettes: sql<number>`COALESCE(SUM(CAST(${deliveries.quantity} as INTEGER)), 0)`,
          totalPackages: sql<number>`COALESCE(COUNT(*), 0)`,
          avgDelay: sql<number>`COALESCE(AVG(EXTRACT(DAY FROM (${deliveries.deliveredDate} - ${orders.plannedDate}))), 0)`
        })
        .from(deliveries)
        .innerJoin(orders, eq(deliveries.orderId, orders.id))
        .where(
          and(
            deliveredWhereCondition,
            isNotNull(deliveries.orderId), // S'assurer qu'il y a une commande liée
            isNotNull(orders.plannedDate)  // S'assurer que la commande a une date
          )
        );

      const ordersCount = Number(ordersResult[0]?.count || 0);
      const deliveriesCount = Number(deliveriesResult[0]?.count || 0);
      const pendingOrdersCount = Number(pendingResult[0]?.count || 0);
      const totalPalettes = Number(deliveriesStatsResult[0]?.totalPalettes || 0);
      const totalPackages = Number(deliveriesStatsResult[0]?.totalPackages || 0);
      const averageDeliveryTime = Number(deliveriesStatsResult[0]?.avgDelay || 0);

      console.log('📊 Statistiques annuelles calculées:', {
        ordersCount,
        deliveriesCount,
        pendingOrdersCount,
        averageDeliveryTime: `${averageDeliveryTime} jours (commande → livraison, livraisons avec commande liée uniquement)`,
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
      console.error('❌ Erreur calcul statistiques annuelles:', error);
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

    // SAFE: Use simple column ordering instead of SQL CAST which fails in production
    const results = await query.orderBy(publicities.pubNumber);
    
    // LOG: Debug des publicités récupérées
    console.log(`📋 PUBLICITES FETCHED: ${results.length} résultats pour année ${year || 'toutes'}`);
    if (results.length > 0) {
      console.log('🔍 PREMIERS RESULTATS:', results.slice(0, 3).map((p, i) => `${i+1}. N°${p.pubNumber} - ${p.designation}`));
    }

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

    // Sort by pubNumber as integer on the server side for consistency
    const sortedResults = results.sort((a, b) => {
      const numA = parseInt(a.pubNumber) || 0;
      const numB = parseInt(b.pubNumber) || 0;
      return numA - numB;
    });

    return sortedResults.map((publicity: any) => ({
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
    console.log(`🗑️ [DELETION] Starting deletion of publicity ID: ${id}`);
    
    try {
      // First, delete all participations (defensive approach for production DB constraints)
      const deletedParticipations = await db.delete(publicityParticipations).where(eq(publicityParticipations.publicityId, id)).returning();
      console.log(`🗑️ [DELETION] Deleted ${deletedParticipations.length} participations for publicity ${id}`);
      
      // Then delete the publicity itself
      const deletedPublicity = await db.delete(publicities).where(eq(publicities.id, id)).returning();
      console.log(`🗑️ [DELETION] Deleted publicity ${id}, found: ${deletedPublicity.length > 0 ? 'YES' : 'NO'}`);
      
      if (deletedPublicity.length === 0) {
        throw new Error(`Publicity with ID ${id} not found`);
      }
      
      console.log(`✅ [DELETION] Successfully deleted publicity ID: ${id}`);
    } catch (error) {
      console.error(`❌ [DELETION] Failed to delete publicity ID: ${id}`, error);
      throw error;
    }
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
    
    // ✅ Vérification d'expiration ajoutée pour production
    if (cache) {
      const now = new Date();
      const expiresAt = new Date(cache.expiresAt);
      
      if (now < expiresAt) {
        console.log('✅ [DATABASE-CACHE] Cache hit pour:', { 
          cacheKey, 
          expires: cache.expiresAt,
          hoursRemaining: Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))
        });
        return cache; // Cache valide
      } else {
        console.log('⏰ [DATABASE-CACHE] Cache expiré, suppression:', { 
          cacheKey, 
          expiredAt: cache.expiresAt 
        });
        // Supprimer le cache expiré
        await db.delete(invoiceVerificationCache)
          .where(eq(invoiceVerificationCache.cacheKey, cacheKey));
        return undefined; // Cache expiré
      }
    }
    
    console.log('❌ [DATABASE-CACHE] Cache miss pour:', { cacheKey });
    return undefined; // Pas de cache
  }

  async createInvoiceVerificationCache(cacheData: InsertInvoiceVerificationCache): Promise<InvoiceVerificationCache> {
    try {
      // Utiliser UPSERT pour gérer les conflits de clés
      const [cache] = await db
        .insert(invoiceVerificationCache)
        .values(cacheData)
        .onConflictDoUpdate({
          target: invoiceVerificationCache.cacheKey,
          set: {
            exists: cacheData.exists,
            matchType: cacheData.matchType,
            errorMessage: cacheData.errorMessage,
            cacheHit: cacheData.cacheHit,
            apiCallTime: cacheData.apiCallTime,
            updatedAt: new Date()
          }
        })
        .returning();
      return cache;
    } catch (error) {
      console.error('❌ Erreur création cache:', error);
      throw error;
    }
  }

  async saveInvoiceVerificationCache(cacheData: InsertInvoiceVerificationCache): Promise<InvoiceVerificationCache> {
    return this.createInvoiceVerificationCache(cacheData);
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

  async getPendingClientCalls(groupIds?: number[]): Promise<CustomerOrderWithRelations[]> {
    const conditions = [
      eq(customerOrders.customerNotified, false),
      inArray(customerOrders.status, ['Disponible', 'disponible', 'Arrivé', 'arrivé', 'Prêt', 'prêt'])
    ];

    if (groupIds && groupIds.length > 0) {
      conditions.push(inArray(customerOrders.groupId, groupIds));
    }

    const results = await db
      .select({
        customerOrder: customerOrders,
        supplier: suppliers,
        group: groups
      })
      .from(customerOrders)
      .leftJoin(suppliers, eq(customerOrders.supplierId, suppliers.id))
      .leftJoin(groups, eq(customerOrders.groupId, groups.id))
      .where(and(...conditions))
      .orderBy(desc(customerOrders.createdAt));
    
    return results.map(result => ({
      ...result.customerOrder,
      supplier: result.supplier!,
      group: result.group!,
      creator: null // Will be populated if needed
    }));
  }

  async markClientCalled(customerOrderId: number, calledBy: string): Promise<CustomerOrder> {
    const [updated] = await db
      .update(customerOrders)
      .set({ 
        customerNotified: true,
        updatedAt: new Date()
      })
      .where(eq(customerOrders.id, customerOrderId))
      .returning();
    
    return updated;
  }

  async getDlcProducts(groupIds?: number[], filters?: { status?: string; supplierId?: number; search?: string; }): Promise<DlcProductWithRelations[]> {
    let query = db
      .select({
        dlcProduct: dlcProducts,
        supplier: suppliers,
        group: groups
      })
      .from(dlcProducts)
      .leftJoin(suppliers, eq(dlcProducts.supplierId, suppliers.id))
      .leftJoin(groups, eq(dlcProducts.groupId, groups.id));

    const conditions = [];

    if (groupIds && groupIds.length > 0) {
      conditions.push(inArray(dlcProducts.groupId, groupIds));
    }

    if (filters) {
      // Handle dynamic status filtering based on expiry date calculation
      if (filters.status && filters.status !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
        
        if (filters.status === 'expires_soon') {
          // Products expiring within 15 days but not expired yet
          const in15Days = new Date();
          in15Days.setDate(today.getDate() + 15);
          in15Days.setHours(23, 59, 59, 999); // End of day
          conditions.push(
            and(
              gt(dlcProducts.expiryDate, today),
              lte(dlcProducts.expiryDate, in15Days),
              ne(dlcProducts.status, 'valides')
            )
          );
        } else if (filters.status === 'expires') {
          // Products already expired
          conditions.push(
            and(
              lte(dlcProducts.expiryDate, today),
              ne(dlcProducts.status, 'valides')
            )
          );
        } else if (filters.status === 'en_cours') {
          // Products active (more than 15 days until expiry)
          const in15Days = new Date();
          in15Days.setDate(today.getDate() + 15);
          in15Days.setHours(23, 59, 59, 999);
          conditions.push(
            and(
              gt(dlcProducts.expiryDate, in15Days),
              ne(dlcProducts.status, 'valides')
            )
          );
        } else if (filters.status === 'valides') {
          // Products that are validated regardless of date
          conditions.push(eq(dlcProducts.status, 'valides'));
        }
      }
      
      if (filters.supplierId) {
        conditions.push(eq(dlcProducts.supplierId, filters.supplierId));
      }
      if (filters.search) {
        conditions.push(
          or(
            sql`LOWER(${dlcProducts.productName}) LIKE LOWER(${'%' + filters.search + '%'})`,
            sql`LOWER(${suppliers.name}) LIKE LOWER(${'%' + filters.search + '%'})`
          )
        );
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(asc(dlcProducts.expiryDate));
    return results.map((row: any) => ({
      ...row.dlcProduct,
      dlcDate: row.dlcProduct.expiryDate, // ✅ Mapping expiryDate vers dlcDate pour frontend
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
      dlcDate: result.dlcProduct.expiryDate, // ✅ Mapping expiryDate vers dlcDate pour frontend
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
        status: "valides",
        updatedAt: new Date()
      })
      .where(eq(dlcProducts.id, id))
      .returning();
    return dlcProduct as DlcProductFrontend;
  }

  async markDlcProductStockEpuise(id: number, markedBy: string): Promise<DlcProductFrontend> {
    const [dlcProduct] = await db
      .update(dlcProducts)
      .set({ 
        stockEpuise: true,
        stockEpuiseBy: markedBy,
        stockEpuiseAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(dlcProducts.id, id))
      .returning();
    return dlcProduct as DlcProductFrontend;
  }

  async restoreDlcProductStock(id: number): Promise<DlcProductFrontend> {
    const [dlcProduct] = await db
      .update(dlcProducts)
      .set({ 
        stockEpuise: false,
        stockEpuiseBy: null,
        stockEpuiseAt: null,
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

  async getTasks(groupIds?: number[], userRole?: string): Promise<TaskWithRelations[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let query = db
      .select({
        task: tasks,
        group: groups
      })
      .from(tasks)
      .leftJoin(groups, eq(tasks.groupId, groups.id));

    // Appliquer le filtrage par magasin si spécifié
    let whereConditions = [];
    if (groupIds && groupIds.length > 0) {
      whereConditions.push(inArray(tasks.groupId, groupIds));
    }

    // Filtrage par rôle pour la date de départ
    if (userRole === 'manager' || userRole === 'employee') {
      // Managers et employés : seulement les tâches dont la date de départ est atteinte ou passée
      whereConditions.push(
        or(
          isNull(tasks.startDate), // Tâches sans date de départ (toujours visibles)
          lte(tasks.startDate, today) // Tâches dont la date de départ est arrivée
        )
      );
    }
    // Admin et directeur voient toutes les tâches, y compris les tâches programmées

    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    const results = await query.orderBy(desc(tasks.createdAt));
    
    console.log('📋 DatabaseStorage.getTasks - Raw results:', {
      resultCount: results.length,
      userRole,
      sampleTasks: results.slice(0, 2).map(r => ({
        taskExists: !!r.task,
        taskId: r.task?.id,
        title: r.task?.title,
        startDate: r.task?.startDate,
        groupExists: !!r.group
      }))
    });

    return results
      .filter((row: any) => row.task) // Filtrer les tâches nulles
      .map((row: any) => {
        try {
          const task = row.task;
          const group = row.group || null;
          
          // Calculer si la tâche est future de manière sécurisée
          let isFutureTask = false;
          if (task.startDate) {
            try {
              const startDate = new Date(task.startDate);
              if (!isNaN(startDate.getTime())) {
                isFutureTask = startDate > today;
              }
            } catch (error) {
              console.warn('Error parsing startDate:', error, task.startDate);
            }
          }

          return {
            ...task,
            group,
            isFutureTask
          };
        } catch (error) {
          console.error('Error processing task row:', error, row);
          return null;
        }
      })
      .filter(Boolean);
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
    console.log('💾 DatabaseStorage.createTask - Input:', {
      taskData,
      dueDate: taskData.dueDate,
      dueDateType: typeof taskData.dueDate,
      dueDateISO: taskData.dueDate instanceof Date ? taskData.dueDate.toISOString() : taskData.dueDate
    });
    
    // Convert string dates to Date objects for Drizzle PostgreSQL
    const processedTaskData = {
      ...taskData,
      startDate: taskData.startDate ? new Date(taskData.startDate) : null,
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
    };
    
    const [task] = await db.insert(tasks).values(processedTaskData).returning();
    
    console.log('💾 DatabaseStorage.createTask - Result:', {
      taskId: task.id,
      title: task.title,
      dueDate: task.dueDate,
      dueDateType: typeof task.dueDate
    });
    
    return task;
  }

  async updateTask(id: number, taskData: Partial<InsertTask>): Promise<Task> {
    console.log('💾 DatabaseStorage.updateTask - Input:', {
      taskId: id,
      taskData,
      dueDate: taskData.dueDate,
      dueDateType: typeof taskData.dueDate,
      dueDateISO: taskData.dueDate instanceof Date ? taskData.dueDate.toISOString() : taskData.dueDate
    });

    // Validation des données avant update
    if (!taskData || typeof taskData !== 'object') {
      throw new Error('Invalid task data provided');
    }

    // Nettoyer les données pour éviter les problèmes de type
    const cleanData: any = {};
    
    if (taskData.title !== undefined) cleanData.title = taskData.title;
    if (taskData.description !== undefined) cleanData.description = taskData.description;
    if (taskData.priority !== undefined) cleanData.priority = taskData.priority;
    if (taskData.status !== undefined) cleanData.status = taskData.status;
    if (taskData.assignedTo !== undefined) cleanData.assignedTo = taskData.assignedTo;
    
    // Gestion spéciale des dates selon les types PostgreSQL
    if (taskData.startDate !== undefined) {
      if (taskData.startDate === '' || taskData.startDate === null) {
        cleanData.startDate = null;
      } else {
        // start_date est un timestamp en PostgreSQL - on peut passer une date
        cleanData.startDate = new Date(taskData.startDate);
      }
    }
    
    if (taskData.dueDate !== undefined) {
      if (taskData.dueDate === '' || taskData.dueDate === null) {
        cleanData.dueDate = null;
      } else {
        // due_date est un timestamp en PostgreSQL - convertir en Date object
        cleanData.dueDate = new Date(taskData.dueDate);
      }
    }
    
    cleanData.updatedAt = new Date();
    
    console.log('🧹 Cleaned data for database update:', {
      ...cleanData,
      startDateType: cleanData.startDate ? typeof cleanData.startDate : 'null',
      dueDateType: cleanData.dueDate ? typeof cleanData.dueDate : 'null',
      startDateIsDate: cleanData.startDate instanceof Date,
    });
    
    try {
      const [task] = await db
        .update(tasks)
        .set(cleanData)
        .where(eq(tasks.id, id))
        .returning();
        
      console.log('✅ DatabaseStorage.updateTask - Success:', {
        taskId: task.id,
        title: task.title,
        dueDate: task.dueDate,
        dueDateType: typeof task.dueDate
      });
      
      return task;
    } catch (error) {
      console.error('❌ DatabaseStorage.updateTask - Database Error:', {
        taskId: id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        cleanData,
        originalTaskData: taskData
      });
      throw new Error(`Failed to update task in database: ${error instanceof Error ? error.message : String(error)}`);
    }
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

  // Announcement operations
  async createAnnouncement(announcementData: InsertAnnouncement): Promise<Announcement> {
    const announcementStorage = getAnnouncementStorage(
      () => this.getUsers(),
      () => this.getGroups()
    );
    return await announcementStorage.createAnnouncement(announcementData);
  }

  async getAnnouncements(groupIds?: number[]): Promise<AnnouncementWithRelations[]> {
    const announcementStorage = getAnnouncementStorage(
      () => this.getUsers(),
      () => this.getGroups()
    );
    return await announcementStorage.getAnnouncements(groupIds);
  }

  async getAnnouncement(id: number): Promise<AnnouncementWithRelations | undefined> {
    const announcementStorage = getAnnouncementStorage(
      () => this.getUsers(),
      () => this.getGroups()
    );
    return await announcementStorage.getAnnouncement(id);
  }

  async updateAnnouncement(id: number, announcementData: Partial<InsertAnnouncement>): Promise<AnnouncementWithRelations> {
    const announcementStorage = getAnnouncementStorage(
      () => this.getUsers(),
      () => this.getGroups()
    );
    return await announcementStorage.updateAnnouncement(id, announcementData);
  }

  async deleteAnnouncement(id: number): Promise<boolean> {
    const announcementStorage = getAnnouncementStorage(
      () => this.getUsers(),
      () => this.getGroups()
    );
    return await announcementStorage.deleteAnnouncement(id);
  }

  // Avoir operations
  async getAvoirs(groupIds?: number[]): Promise<AvoirWithRelations[]> {
    let query = db
      .select({
        id: avoirs.id,
        supplierId: avoirs.supplierId,
        groupId: avoirs.groupId,
        invoiceReference: avoirs.invoiceReference,
        amount: avoirs.amount,
        comment: avoirs.comment,
        commercialProcessed: avoirs.commercialProcessed,
        status: avoirs.status,
        webhookSent: avoirs.webhookSent,
        nocodbVerified: avoirs.nocodbVerified,
        nocodbVerifiedAt: avoirs.nocodbVerifiedAt,
        processedAt: avoirs.processedAt,
        createdBy: avoirs.createdBy,
        createdAt: avoirs.createdAt,
        updatedAt: avoirs.updatedAt,
        supplier: suppliers,
        group: groups,
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email
        }
      })
      .from(avoirs)
      .leftJoin(suppliers, eq(avoirs.supplierId, suppliers.id))
      .leftJoin(groups, eq(avoirs.groupId, groups.id))
      .leftJoin(users, eq(avoirs.createdBy, users.id));

    if (groupIds && groupIds.length > 0) {
      query = query.where(inArray(avoirs.groupId, groupIds));
    }

    const results = await query.orderBy(desc(avoirs.createdAt));

    return results.map((result: any) => ({
      ...result,
      supplier: result.supplier!,
      group: result.group!,
      creator: result.creator!,
    }));
  }

  async getAvoir(id: number): Promise<AvoirWithRelations | undefined> {
    const [result] = await db
      .select({
        id: avoirs.id,
        supplierId: avoirs.supplierId,
        groupId: avoirs.groupId,
        invoiceReference: avoirs.invoiceReference,
        amount: avoirs.amount,
        comment: avoirs.comment,
        commercialProcessed: avoirs.commercialProcessed,
        status: avoirs.status,
        webhookSent: avoirs.webhookSent,
        nocodbVerified: avoirs.nocodbVerified,
        nocodbVerifiedAt: avoirs.nocodbVerifiedAt,
        processedAt: avoirs.processedAt,
        createdBy: avoirs.createdBy,
        createdAt: avoirs.createdAt,
        updatedAt: avoirs.updatedAt,
        supplier: suppliers,
        group: groups,
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email
        }
      })
      .from(avoirs)
      .leftJoin(suppliers, eq(avoirs.supplierId, suppliers.id))
      .leftJoin(groups, eq(avoirs.groupId, groups.id))
      .leftJoin(users, eq(avoirs.createdBy, users.id))
      .where(eq(avoirs.id, id));

    if (!result) return undefined;

    return {
      ...result,
      supplier: result.supplier!,
      group: result.group!,
      creator: result.creator!,
    };
  }

  async createAvoir(avoirData: InsertAvoir): Promise<Avoir> {
    const [avoir] = await db.insert(avoirs).values(avoirData).returning();
    return avoir;
  }

  async updateAvoir(id: number, avoirData: Partial<InsertAvoir>): Promise<Avoir> {
    const [avoir] = await db
      .update(avoirs)
      .set({ ...avoirData, updatedAt: new Date() })
      .where(eq(avoirs.id, id))
      .returning();
    return avoir;
  }

  async deleteAvoir(id: number): Promise<void> {
    await db.delete(avoirs).where(eq(avoirs.id, id));
  }

  async updateAvoirWebhookStatus(id: number, webhookSent: boolean): Promise<void> {
    await db
      .update(avoirs)
      .set({ webhookSent, updatedAt: new Date() })
      .where(eq(avoirs.id, id));
  }

  async updateAvoirNocodbVerification(id: number, verified: boolean): Promise<void> {
    await db
      .update(avoirs)
      .set({ 
        nocodbVerified: verified, 
        nocodbVerifiedAt: verified ? new Date() : null,
        updatedAt: new Date() 
      })
      .where(eq(avoirs.id, id));
  }

  // SAV operations
  async getSavTickets(filters?: { 
    groupIds?: number[]; 
    status?: string; 
    supplierId?: number; 
    priority?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SavTicketWithRelations[]> {
    let query = db
      .select({
        ticket: savTickets,
        supplier: suppliers,
        group: groups,
        creator: users,
      })
      .from(savTickets)
      .leftJoin(suppliers, eq(savTickets.supplierId, suppliers.id))
      .leftJoin(groups, eq(savTickets.groupId, groups.id))
      .leftJoin(users, eq(savTickets.createdBy, users.id));

    const conditions = [];
    
    if (filters?.groupIds?.length) {
      conditions.push(inArray(savTickets.groupId, filters.groupIds));
    }
    if (filters?.status) {
      conditions.push(eq(savTickets.status, filters.status));
    }
    if (filters?.supplierId) {
      conditions.push(eq(savTickets.supplierId, filters.supplierId));
    }
    if (filters?.priority) {
      conditions.push(eq(savTickets.priority, filters.priority));
    }
    if (filters?.startDate) {
      conditions.push(gte(savTickets.createdAt, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      conditions.push(lte(savTickets.createdAt, new Date(filters.endDate)));
    }

    if (conditions.length) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(savTickets.createdAt));

    // Get history for each ticket
    const ticketsWithHistory = await Promise.all(
      results.map(async (result) => {
        const history = await this.getSavTicketHistory(result.ticket.id);
        return {
          ...result.ticket,
          supplier: result.supplier!,
          group: result.group!,
          creator: result.creator!,
          history,
        };
      })
    );

    return ticketsWithHistory;
  }

  async getSavTicket(id: number): Promise<SavTicketWithRelations | undefined> {
    const [result] = await db
      .select({
        ticket: savTickets,
        supplier: suppliers,
        group: groups,
        creator: users,
      })
      .from(savTickets)
      .leftJoin(suppliers, eq(savTickets.supplierId, suppliers.id))
      .leftJoin(groups, eq(savTickets.groupId, groups.id))
      .leftJoin(users, eq(savTickets.createdBy, users.id))
      .where(eq(savTickets.id, id));

    if (!result) return undefined;

    const history = await this.getSavTicketHistory(id);

    return {
      ...result.ticket,
      supplier: result.supplier!,
      group: result.group!,
      creator: result.creator!,
      history,
    };
  }

  async createSavTicket(ticketData: InsertSavTicket): Promise<SavTicket> {
    // Generate ticket number
    const currentYear = new Date().getFullYear();
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(savTickets)
      .where(sql`EXTRACT(year from created_at) = ${currentYear}`);
      
    const ticketNumber = `SAV-${currentYear}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;

    const [ticket] = await db
      .insert(savTickets)
      .values({ ...ticketData, ticketNumber })
      .returning();

    // Add initial history entry
    await this.addSavTicketHistory({
      ticketId: ticket.id,
      action: 'created',
      description: `Ticket créé avec le statut "${ticket.status}"`,
      createdBy: ticket.createdBy,
    });

    return ticket;
  }

  async updateSavTicket(id: number, ticketData: Partial<InsertSavTicket>): Promise<SavTicket> {
    const [ticket] = await db
      .update(savTickets)
      .set({ ...ticketData, updatedAt: new Date() })
      .where(eq(savTickets.id, id))
      .returning();
    
    return ticket;
  }

  async deleteSavTicket(id: number): Promise<void> {
    // Delete history first
    await db.delete(savTicketHistory).where(eq(savTicketHistory.ticketId, id));
    // Delete ticket
    await db.delete(savTickets).where(eq(savTickets.id, id));
  }

  async getSavTicketHistory(ticketId: number): Promise<SavTicketHistoryWithCreator[]> {
    const results = await db
      .select({
        history: savTicketHistory,
        creator: users,
      })
      .from(savTicketHistory)
      .leftJoin(users, eq(savTicketHistory.createdBy, users.id))
      .where(eq(savTicketHistory.ticketId, ticketId))
      .orderBy(desc(savTicketHistory.createdAt));

    return results.map(result => ({
      ...result.history,
      creator: result.creator!,
    }));
  }

  async addSavTicketHistory(historyData: InsertSavTicketHistory): Promise<SavTicketHistory> {
    const [history] = await db
      .insert(savTicketHistory)
      .values(historyData)
      .returning();
    
    return history;
  }

  async getSavTicketStats(groupIds?: number[]): Promise<{
    totalTickets: number;
    newTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    criticalTickets: number;
  }> {
    let baseQuery = db.select().from(savTickets);

    if (groupIds?.length) {
      baseQuery = baseQuery.where(inArray(savTickets.groupId, groupIds));
    }

    // Get status counts
    const statusResults = await db
      .select({ 
        count: sql<number>`count(*)`, 
        status: savTickets.status 
      })
      .from(savTickets)
      .where(groupIds?.length ? inArray(savTickets.groupId, groupIds) : undefined)
      .groupBy(savTickets.status);

    // Get priority counts  
    const priorityResults = await db
      .select({ 
        count: sql<number>`count(*)`, 
        priority: savTickets.priority 
      })
      .from(savTickets)
      .where(groupIds?.length ? inArray(savTickets.groupId, groupIds) : undefined)
      .groupBy(savTickets.priority);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(savTickets)
      .where(groupIds?.length ? inArray(savTickets.groupId, groupIds) : undefined);

    const stats = {
      totalTickets: Number(totalResult[0]?.count || 0),
      newTickets: 0,
      inProgressTickets: 0,
      resolvedTickets: 0,
      criticalTickets: 0,
    };

    // Process status results
    statusResults.forEach(result => {
      const count = Number(result.count || 0);
      
      if (result.status === 'nouveau') {
        stats.newTickets = count;
      } else if (['en_cours', 'attente_pieces', 'attente_echange'].includes(result.status)) {
        stats.inProgressTickets += count;
      } else if (['resolu', 'ferme'].includes(result.status)) {
        stats.resolvedTickets += count;
      }
    });

    // Process priority results for critical tickets
    priorityResults.forEach(result => {
      const count = Number(result.count || 0);
      
      if (result.priority === 'critique') {
        stats.criticalTickets = count;
      }
    });

    return stats;
  }

  // Weather operations
  async getWeatherSettings(): Promise<WeatherSettings | undefined> {
    const [settings] = await db.select().from(weatherSettings).limit(1);
    return settings;
  }

  async createWeatherSettings(settingsData: InsertWeatherSettings): Promise<WeatherSettings> {
    const [settings] = await db.insert(weatherSettings).values(settingsData).returning();
    return settings;
  }

  async updateWeatherSettings(id: number, settingsData: Partial<InsertWeatherSettings>): Promise<WeatherSettings> {
    const [settings] = await db
      .update(weatherSettings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(weatherSettings.id, id))
      .returning();
    return settings;
  }

  async getWeatherData(date: string, isCurrentYear: boolean): Promise<WeatherData | undefined> {
    const [data] = await db
      .select()
      .from(weatherData)
      .where(and(
        eq(weatherData.date, date),
        eq(weatherData.isCurrentYear, isCurrentYear)
      ))
      .limit(1);
    return data;
  }

  async createWeatherData(data: InsertWeatherData): Promise<WeatherData> {
    const [weatherInfo] = await db.insert(weatherData).values(data).returning();
    return weatherInfo;
  }

  async updateWeatherData(id: number, data: Partial<InsertWeatherData>): Promise<WeatherData> {
    const [weatherInfo] = await db
      .update(weatherData)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(weatherData.id, id))
      .returning();
    return weatherInfo;
  }

  async deleteOldWeatherData(daysToKeep: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    await db
      .delete(weatherData)
      .where(lt(weatherData.createdAt, cutoffDate));
    
    console.log(`🧹 Deleted weather data older than ${daysToKeep} days`);
  }

  async clearWeatherCache(): Promise<void> {
    await db.delete(weatherData);
    console.log('🧹 Weather cache cleared due to location change');
  }

  // Webhook BAP Configuration
  async getWebhookBapConfig(): Promise<WebhookBapConfig | undefined> {
    const [config] = await db.select().from(webhookBapConfig).limit(1);
    return config;
  }

  async createWebhookBapConfig(configData: InsertWebhookBapConfig): Promise<WebhookBapConfig> {
    const [config] = await db
      .insert(webhookBapConfig)
      .values(configData)
      .returning();
    return config;
  }

  async updateWebhookBapConfig(id: number, configData: Partial<InsertWebhookBapConfig>): Promise<WebhookBapConfig> {
    const [config] = await db
      .update(webhookBapConfig)
      .set({ ...configData, updatedAt: new Date() })
      .where(eq(webhookBapConfig.id, id))
      .returning();
    return config;
  }

  // Reconciliation Comments operations
  async getReconciliationComments(deliveryId: number): Promise<ReconciliationCommentWithRelations[]> {
    const comments = await db
      .select({
        id: reconciliationComments.id,
        deliveryId: reconciliationComments.deliveryId,
        groupId: reconciliationComments.groupId,
        content: reconciliationComments.content,
        type: reconciliationComments.type,
        authorId: reconciliationComments.authorId,
        createdAt: reconciliationComments.createdAt,
        updatedAt: reconciliationComments.updatedAt,
        author: users,
        group: groups,
        delivery: {
          id: deliveries.id,
          orderId: deliveries.orderId,
          supplierId: deliveries.supplierId,
          groupId: deliveries.groupId,
          scheduledDate: deliveries.scheduledDate,
          deliveredDate: deliveries.deliveredDate,
          quantity: deliveries.quantity,
          unit: deliveries.unit,
          status: deliveries.status,
          notes: deliveries.notes,
          blNumber: deliveries.blNumber,
          blAmount: deliveries.blAmount,
          invoiceReference: deliveries.invoiceReference,
          invoiceAmount: deliveries.invoiceAmount,
          reconciled: deliveries.reconciled,
          validatedAt: deliveries.validatedAt,
          createdBy: deliveries.createdBy,
          createdAt: deliveries.createdAt,
          updatedAt: deliveries.updatedAt,
        }
      })
      .from(reconciliationComments)
      .leftJoin(users, eq(reconciliationComments.authorId, users.id))
      .leftJoin(groups, eq(reconciliationComments.groupId, groups.id))
      .leftJoin(deliveries, eq(reconciliationComments.deliveryId, deliveries.id))
      .where(eq(reconciliationComments.deliveryId, deliveryId))
      .orderBy(desc(reconciliationComments.createdAt));

    return comments.map(comment => ({
      ...comment,
      delivery: {
        ...comment.delivery,
        supplier: {} as any, // Will be filled by relations if needed
        group: comment.group!,
        creator: {} as any, // Will be filled by relations if needed
      }
    })) as ReconciliationCommentWithRelations[];
  }

  async getReconciliationCommentById(id: number): Promise<ReconciliationCommentWithRelations | undefined> {
    const [comment] = await db
      .select({
        id: reconciliationComments.id,
        deliveryId: reconciliationComments.deliveryId,
        groupId: reconciliationComments.groupId,
        content: reconciliationComments.content,
        type: reconciliationComments.type,
        authorId: reconciliationComments.authorId,
        createdAt: reconciliationComments.createdAt,
        updatedAt: reconciliationComments.updatedAt,
        author: users,
        group: groups,
        delivery: {
          id: deliveries.id,
          orderId: deliveries.orderId,
          supplierId: deliveries.supplierId,
          groupId: deliveries.groupId,
          scheduledDate: deliveries.scheduledDate,
          deliveredDate: deliveries.deliveredDate,
          quantity: deliveries.quantity,
          unit: deliveries.unit,
          status: deliveries.status,
          notes: deliveries.notes,
          blNumber: deliveries.blNumber,
          blAmount: deliveries.blAmount,
          invoiceReference: deliveries.invoiceReference,
          invoiceAmount: deliveries.invoiceAmount,
          reconciled: deliveries.reconciled,
          validatedAt: deliveries.validatedAt,
          createdBy: deliveries.createdBy,
          createdAt: deliveries.createdAt,
          updatedAt: deliveries.updatedAt,
        }
      })
      .from(reconciliationComments)
      .leftJoin(users, eq(reconciliationComments.authorId, users.id))
      .leftJoin(groups, eq(reconciliationComments.groupId, groups.id))
      .leftJoin(deliveries, eq(reconciliationComments.deliveryId, deliveries.id))
      .where(eq(reconciliationComments.id, id));

    if (!comment) return undefined;

    return {
      ...comment,
      delivery: {
        ...comment.delivery,
        supplier: {} as any, // Will be filled by relations if needed
        group: comment.group!,
        creator: {} as any, // Will be filled by relations if needed
      }
    } as ReconciliationCommentWithRelations;
  }

  async createReconciliationComment(commentData: InsertReconciliationComment): Promise<ReconciliationComment> {
    const [comment] = await db
      .insert(reconciliationComments)
      .values(commentData)
      .returning();
    return comment;
  }

  async updateReconciliationComment(id: number, commentData: Partial<InsertReconciliationComment>): Promise<ReconciliationComment> {
    const [comment] = await db
      .update(reconciliationComments)
      .set({ ...commentData, updatedAt: new Date() })
      .where(eq(reconciliationComments.id, id))
      .returning();
    return comment;
  }

  async deleteReconciliationComment(id: number): Promise<void> {
    await db
      .delete(reconciliationComments)
      .where(eq(reconciliationComments.id, id));
  }

  // Analytics implementations
  async getAnalyticsSummary(filters: {
    startDate?: Date;
    endDate?: Date;
    supplierIds?: number[];
    groupIds?: number[];
    status?: string[];
  }): Promise<{
    totalOrders: number;
    totalDeliveries: number;
    onTimeRate: number;
    totalAmount: number;
    avgDeliveryDelay: number;
    topSuppliers: Array<{ id: number; name: string; count: number; amount: number }>;
    topStores: Array<{ id: number; name: string; orders: number; deliveries: number }>;
  }> {
    try {
      const conditions: any[] = [];
      const orderConditions: any[] = [];
      const deliveryConditions: any[] = [];

      // Apply filters
      if (filters.startDate) {
        orderConditions.push(gte(orders.plannedDate, filters.startDate));
        deliveryConditions.push(gte(deliveries.scheduledDate, filters.startDate));
      }
      if (filters.endDate) {
        orderConditions.push(lte(orders.plannedDate, filters.endDate));
        deliveryConditions.push(lte(deliveries.scheduledDate, filters.endDate));
      }
      if (filters.supplierIds?.length) {
        orderConditions.push(inArray(orders.supplierId, filters.supplierIds));
        deliveryConditions.push(inArray(deliveries.supplierId, filters.supplierIds));
      }
      if (filters.groupIds?.length) {
        orderConditions.push(inArray(orders.groupId, filters.groupIds));
        deliveryConditions.push(inArray(deliveries.groupId, filters.groupIds));
      }
      if (filters.status?.length) {
        orderConditions.push(inArray(orders.status, filters.status));
        deliveryConditions.push(inArray(deliveries.status, filters.status));
      }

      // Get total orders
      const orderQuery = db.select({ count: sql<number>`COUNT(*)` }).from(orders);
      if (orderConditions.length) orderQuery.where(and(...orderConditions));
      const [{ count: totalOrders }] = await orderQuery;

      // Get total deliveries and amounts
      const deliveryQuery = db.select({
        count: sql<number>`COUNT(*)`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(bl_amount AS NUMERIC)), 0) + COALESCE(SUM(CAST(invoice_amount AS NUMERIC)), 0)`,
        onTime: sql<number>`COUNT(CASE WHEN delivered_date <= scheduled_date THEN 1 END)`,
        avgDelay: sql<number>`AVG(EXTRACT(EPOCH FROM (delivered_date - scheduled_date)) / 86400)` // days
      }).from(deliveries);
      if (deliveryConditions.length) deliveryQuery.where(and(...deliveryConditions));
      const [deliveryStats] = await deliveryQuery;

      // Get top suppliers
      const supplierQuery = db.select({
        id: suppliers.id,
        name: suppliers.name,
        count: sql<number>`COUNT(${deliveries.id})`,
        amount: sql<number>`COALESCE(SUM(CAST(${deliveries.blAmount} AS NUMERIC)), 0)`
      })
      .from(deliveries)
      .innerJoin(suppliers, eq(deliveries.supplierId, suppliers.id));
      
      if (deliveryConditions.length) supplierQuery.where(and(...deliveryConditions));
      const topSuppliers = await supplierQuery
        .groupBy(suppliers.id, suppliers.name)
        .orderBy(desc(sql<number>`COUNT(${deliveries.id})`))
        .limit(5);

      // Get top stores
      const storeQuery = db.select({
        id: groups.id,
        name: groups.name,
        orders: sql<number>`COUNT(DISTINCT ${orders.id})`,
        deliveries: sql<number>`COUNT(DISTINCT ${deliveries.id})`
      })
      .from(groups)
      .leftJoin(orders, eq(groups.id, orders.groupId))
      .leftJoin(deliveries, eq(groups.id, deliveries.groupId));
      
      if (filters.groupIds?.length) {
        storeQuery.where(inArray(groups.id, filters.groupIds));
      }
      const topStores = await storeQuery
        .groupBy(groups.id, groups.name)
        .orderBy(desc(sql<number>`COUNT(DISTINCT ${orders.id}) + COUNT(DISTINCT ${deliveries.id})`))
        .limit(5);

      return {
        totalOrders: Number(totalOrders) || 0,
        totalDeliveries: Number(deliveryStats.count) || 0,
        onTimeRate: deliveryStats.count ? (Number(deliveryStats.onTime) / Number(deliveryStats.count)) * 100 : 0,
        totalAmount: Number(deliveryStats.totalAmount) || 0,
        avgDeliveryDelay: Number(deliveryStats.avgDelay) || 0,
        topSuppliers: topSuppliers.map(s => ({ 
          id: s.id, 
          name: s.name, 
          count: Number(s.count), 
          amount: Number(s.amount) 
        })),
        topStores: topStores.map(s => ({ 
          id: s.id, 
          name: s.name, 
          orders: Number(s.orders), 
          deliveries: Number(s.deliveries) 
        }))
      };
    } catch (error) {
      console.error('Analytics summary error:', error);
      throw error;
    }
  }

  async getAnalyticsTimeseries(filters: {
    startDate?: Date;
    endDate?: Date;
    supplierIds?: number[];
    groupIds?: number[];
    granularity?: 'day' | 'week' | 'month';
  }): Promise<Array<{ date: string; orders: number; deliveries: number }>> {
    const granularity = filters.granularity || 'day';
    const dateFormat = granularity === 'day' ? 'YYYY-MM-DD' :
                       granularity === 'week' ? 'YYYY-IW' : 'YYYY-MM';
    
    // Build WHERE clauses with direct value substitution
    const orderConditions: string[] = [];
    const deliveryConditions: string[] = [];
    
    if (filters.startDate) {
      const startDate = filters.startDate.toISOString().split('T')[0];
      orderConditions.push(`planned_date >= '${startDate}'`);
      deliveryConditions.push(`scheduled_date >= '${startDate}'`);
    }
    if (filters.endDate) {
      const endDate = filters.endDate.toISOString().split('T')[0];
      orderConditions.push(`planned_date <= '${endDate}'`);
      deliveryConditions.push(`scheduled_date <= '${endDate}'`);
    }
    if (filters.supplierIds?.length) {
      const supplierIds = filters.supplierIds.join(',');
      orderConditions.push(`supplier_id IN (${supplierIds})`);
      deliveryConditions.push(`supplier_id IN (${supplierIds})`);
    }
    if (filters.groupIds?.length) {
      const groupIds = filters.groupIds.join(',');
      orderConditions.push(`group_id IN (${groupIds})`);
      deliveryConditions.push(`group_id IN (${groupIds})`);
    }
    
    const orderWhere = orderConditions.length > 0 ? `WHERE ${orderConditions.join(' AND ')}` : '';
    const deliveryWhere = deliveryConditions.length > 0 ? `WHERE ${deliveryConditions.join(' AND ')}` : '';
    
    // Get orders by date using raw SQL
    const ordersSql = `
      SELECT TO_CHAR(planned_date, '${dateFormat}') as date, COUNT(*) as count
      FROM orders
      ${orderWhere}
      GROUP BY TO_CHAR(planned_date, '${dateFormat}')
      ORDER BY TO_CHAR(planned_date, '${dateFormat}')
    `;
    
    const ordersData = await db.execute(sql.raw(ordersSql));
    
    // Get deliveries by date using raw SQL
    const deliveriesSql = `
      SELECT TO_CHAR(scheduled_date, '${dateFormat}') as date, COUNT(*) as count
      FROM deliveries
      ${deliveryWhere}
      GROUP BY TO_CHAR(scheduled_date, '${dateFormat}')
      ORDER BY TO_CHAR(scheduled_date, '${dateFormat}')
    `;
    
    const deliveriesData = await db.execute(sql.raw(deliveriesSql));
    
    // Merge data
    const dataMap = new Map<string, { orders: number; deliveries: number }>();
    (ordersData.rows as any[]).forEach(row => {
      dataMap.set(row.date, { orders: Number(row.count), deliveries: 0 });
    });
    (deliveriesData.rows as any[]).forEach(row => {
      const existing = dataMap.get(row.date) || { orders: 0, deliveries: 0 };
      dataMap.set(row.date, { ...existing, deliveries: Number(row.count) });
    });
    
    return Array.from(dataMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAnalyticsBySupplier(filters: {
    startDate?: Date;
    endDate?: Date;
    groupIds?: number[];
  }): Promise<Array<{ supplierId: number; supplierName: string; deliveries: number; amount: number }>> {
    const conditions: any[] = [];
    if (filters.startDate) conditions.push(gte(deliveries.scheduledDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(deliveries.scheduledDate, filters.endDate));
    if (filters.groupIds?.length) conditions.push(inArray(deliveries.groupId, filters.groupIds));

    const query = db.select({
      supplierId: suppliers.id,
      supplierName: suppliers.name,
      deliveries: sql<number>`COUNT(${deliveries.id})`,
      amount: sql<number>`COALESCE(SUM(CAST(${deliveries.blAmount} AS NUMERIC)), 0)`
    })
    .from(deliveries)
    .innerJoin(suppliers, eq(deliveries.supplierId, suppliers.id));
    
    if (conditions.length) query.where(and(...conditions));
    
    const result = await query
      .groupBy(suppliers.id, suppliers.name)
      .orderBy(desc(sql<number>`COUNT(${deliveries.id})`));

    return result.map(row => ({
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      deliveries: Number(row.deliveries),
      amount: Number(row.amount)
    }));
  }

  async getAnalyticsByStore(filters: {
    startDate?: Date;
    endDate?: Date;
    supplierIds?: number[];
  }): Promise<Array<{ groupId: number; storeName: string; orders: number; deliveries: number }>> {
    
    try {
      // Build date filter conditions as strings for raw SQL
      let orderDateFilter = '1=1';
      let deliveryDateFilter = '1=1';
      let supplierFilter = '1=1';
      
      if (filters.startDate) {
        const startDate = filters.startDate.toISOString().split('T')[0];
        orderDateFilter += ` AND planned_date >= '${startDate}'`;
        deliveryDateFilter += ` AND scheduled_date >= '${startDate}'`;
      }
      if (filters.endDate) {
        const endDate = filters.endDate.toISOString().split('T')[0];
        orderDateFilter += ` AND planned_date <= '${endDate}'`;
        deliveryDateFilter += ` AND scheduled_date <= '${endDate}'`;
      }
      if (filters.supplierIds?.length) {
        const supplierIds = filters.supplierIds.join(',');
        orderDateFilter += ` AND supplier_id IN (${supplierIds})`;
        deliveryDateFilter += ` AND supplier_id IN (${supplierIds})`;
      }

      const result = await db.execute(sql`
        SELECT 
          g.id as "groupId",
          g.name as "storeName",
          COALESCE(o.count, 0) as orders,
          COALESCE(d.count, 0) as deliveries
        FROM groups g
        LEFT JOIN (
          SELECT group_id, COUNT(*) as count 
          FROM orders 
          WHERE ${sql.raw(orderDateFilter)}
          GROUP BY group_id
        ) o ON g.id = o.group_id
        LEFT JOIN (
          SELECT group_id, COUNT(*) as count 
          FROM deliveries 
          WHERE ${sql.raw(deliveryDateFilter)}
          GROUP BY group_id
        ) d ON g.id = d.group_id
        ORDER BY (COALESCE(o.count, 0) + COALESCE(d.count, 0)) DESC
      `);

      const mappedResult = result.rows.map((row: any) => ({
        groupId: row.groupId,
        storeName: row.storeName,
        orders: Number(row.orders),
        deliveries: Number(row.deliveries)
      }));
      
      
      return mappedResult;
    } catch (error) {
      console.error('Error in getAnalyticsByStore:', error);
      return [];
    }
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
  private reconciliationComments = new Map<number, ReconciliationComment>();
  private announcements = new Map<number, Announcement>();
  private avoirs = new Map<number, Avoir>();
  private savTickets = new Map<number, SavTicket>();
  private savTicketHistories = new Map<number, SavTicketHistory[]>();
  private invoiceVerificationCache = new Map<string, InvoiceVerificationCache>();

  private idCounters = {
    group: 1,
    supplier: 1,
    order: 1,
    delivery: 1,
    publicity: 1,
    customerOrder: 1,
    dlcProduct: 1,
    task: 1,
    announcement: 1,
    avoir: 1,
    savTicket: 1,
    savTicketHistory: 1,
    reconciliationComment: 1,
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

    // Initialize group counter
    this.idCounters.group = 2;
    
    // Initialize supplier counter  
    this.idCounters.supplier = 2;

    // Create test groups
    const testGroup: Group = {
      id: 1,
      name: 'Magasin Test',
      color: '#3B82F6',
      nocodbConfigId: 1, // Référence vers la config NocoDB de test
      nocodbTableName: 'invoices',
      nocodbTableId: 'mrr733dfb8wtt9b', // ID réel de la table NocoDB
      invoiceColumnName: 'invoice_reference',
      nocodbBlColumnName: 'bl_number',
      nocodbAmountColumnName: 'amount',
      nocodbSupplierColumnName: 'supplier',
      webhookUrl: 'https://webhook.test/invoice-upload',
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
      nocodbTableId: groupData.nocodbTableId || null,
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
    // Configuration corrigée pour votre serveur NocoDB
    const testConfig: NocodbConfig = {
      id: 1,
      name: 'Configuration Production NocoDB FFNancy',
      baseUrl: 'https://nocodb.ffnancy.fr', // URL corrigée
      projectId: 'pcg4uw79ukvycxc', // Project ID de vos logs
      apiToken: 'xc-token-production-invoice-system',
      description: 'Configuration de production pour vérification des factures FFNancy',
      isActive: true,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    console.log('🔧 Configuration NocoDB active:', {
      name: testConfig.name,
      baseUrl: testConfig.baseUrl,
      projectId: testConfig.projectId,
      hasToken: !!testConfig.apiToken
    });
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
    // Implémentation temporaire d'un cache en mémoire pour tester
    const cached = this.invoiceVerificationCache.get(cacheKey);
    if (cached && new Date() < new Date(cached.expiresAt)) {
      console.log('✅ [MEMSTORAGE-CACHE] Cache hit pour:', { cacheKey, expires: cached.expiresAt });
      return cached;
    }
    if (cached && new Date() >= new Date(cached.expiresAt)) {
      console.log('⏰ [MEMSTORAGE-CACHE] Cache expiré, suppression:', { cacheKey });
      this.invoiceVerificationCache.delete(cacheKey);
    }
    console.log('❌ [MEMSTORAGE-CACHE] Cache miss pour:', { cacheKey });
    return undefined;
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

  async saveInvoiceVerificationCache(cache: InsertInvoiceVerificationCache): Promise<InvoiceVerificationCache> {
    const newCache = await this.createInvoiceVerificationCache(cache);
    // Sauver en mémoire pour le cache temporaire
    console.log('💾 [MEMSTORAGE-CACHE] Sauvegarde en cache:', { 
      cacheKey: cache.cacheKey,
      exists: cache.exists,
      expiresAt: cache.expiresAt
    });
    this.invoiceVerificationCache.set(cache.cacheKey, newCache);
    return newCache;
  }

  async clearExpiredCache(): Promise<void> {
    // No-op en développement
  }

  // MemStorage implementations with actual data handling
  async getOrders(groupIds?: number[]): Promise<OrderWithRelations[]> {
    let orders = Array.from(this.orders.values());
    if (groupIds && groupIds.length > 0) {
      orders = orders.filter(order => groupIds.includes(order.groupId));
    }
    return orders.map(order => {
      // Récupérer les livraisons associées à cette commande (DEV RELATIONS)
      const associatedDeliveries = Array.from(this.deliveries.values())
        .filter(delivery => delivery.orderId === order.id)
        .map(delivery => ({
          ...delivery,
          supplier: this.suppliers.get(delivery.supplierId),
          group: this.groups.get(delivery.groupId),
          creator: this.users.get(delivery.createdBy || '')
        }));

      return {
        ...order,
        supplier: this.suppliers.get(order.supplierId),
        group: this.groups.get(order.groupId),
        creator: this.users.get(order.createdBy),
        deliveries: associatedDeliveries
      };
    });
  }

  async getOrdersByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<OrderWithRelations[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let orders = Array.from(this.orders.values()).filter(order => {
      const orderDate = new Date(order.plannedDate);
      return orderDate >= start && orderDate <= end;
    });
    
    if (groupIds && groupIds.length > 0) {
      orders = orders.filter(order => groupIds.includes(order.groupId));
    }
    
    return orders.map(order => {
      // Récupérer les livraisons associées à cette commande (DEV RELATIONS)
      const associatedDeliveries = Array.from(this.deliveries.values())
        .filter(delivery => delivery.orderId === order.id)
        .map(delivery => ({
          ...delivery,
          supplier: this.suppliers.get(delivery.supplierId),
          group: this.groups.get(delivery.groupId),
          creator: this.users.get(delivery.createdBy || '')
        }));

      return {
        ...order,
        supplier: this.suppliers.get(order.supplierId),
        group: this.groups.get(order.groupId),
        creator: this.users.get(order.createdBy),
        deliveries: associatedDeliveries
      };
    });
  }

  async getOrder(id: number): Promise<OrderWithRelations | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    // Récupérer les livraisons associées à cette commande
    const associatedDeliveries = Array.from(this.deliveries.values())
      .filter(delivery => delivery.orderId === id)
      .map(delivery => ({
        ...delivery,
        supplier: this.suppliers.get(delivery.supplierId),
        group: this.groups.get(delivery.groupId),
        creator: this.users.get(delivery.createdBy || '')
      }));
    
    return {
      ...order,
      supplier: this.suppliers.get(order.supplierId),
      group: this.groups.get(order.groupId),
      creator: this.users.get(order.createdBy),
      deliveries: associatedDeliveries
    };
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    const id = this.idCounters.order++;
    const order: Order = {
      id,
      ...orderData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: number, orderData: Partial<InsertOrder>): Promise<Order> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) throw new Error('Order not found');
    
    const updatedOrder = {
      ...existingOrder,
      ...orderData,
      updatedAt: new Date(),
    };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async deleteOrder(id: number): Promise<void> {
    this.orders.delete(id);
  }

  async getDeliveries(groupIds?: number[]): Promise<DeliveryWithRelations[]> {
    let deliveries = Array.from(this.deliveries.values());
    if (groupIds && groupIds.length > 0) {
      deliveries = deliveries.filter(delivery => groupIds.includes(delivery.groupId));
    }
    return deliveries.map(delivery => {
      // Récupérer la commande associée à cette livraison si elle existe (DEV RELATIONS)
      let associatedOrder = undefined;
      if (delivery.orderId) {
        const order = this.orders.get(delivery.orderId);
        if (order) {
          associatedOrder = {
            ...order,
            supplier: this.suppliers.get(order.supplierId),
            group: this.groups.get(order.groupId),
            creator: this.users.get(order.createdBy)
          };
        }
      }

      // Compter les commentaires de rapprochement pour cette livraison
      const commentsCount = Array.from(this.reconciliationComments.values())
        .filter(comment => comment.deliveryId === delivery.id).length;

      return {
        ...delivery,
        supplier: this.suppliers.get(delivery.supplierId),
        group: this.groups.get(delivery.groupId),
        creator: this.users.get(delivery.createdBy || ''),
        order: associatedOrder,
        reconciliationCommentsCount: commentsCount
      };
    });
  }

  async getDeliveriesByDateRange(startDate: string, endDate: string, groupIds?: number[]): Promise<DeliveryWithRelations[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let deliveries = Array.from(this.deliveries.values()).filter(delivery => {
      const deliveryDate = new Date(delivery.scheduledDate);
      return deliveryDate >= start && deliveryDate <= end;
    });
    
    if (groupIds && groupIds.length > 0) {
      deliveries = deliveries.filter(delivery => groupIds.includes(delivery.groupId));
    }
    
    return deliveries.map(delivery => {
      // Récupérer la commande associée à cette livraison si elle existe (DEV RELATIONS)
      let associatedOrder = undefined;
      if (delivery.orderId) {
        const order = this.orders.get(delivery.orderId);
        if (order) {
          associatedOrder = {
            ...order,
            supplier: this.suppliers.get(order.supplierId),
            group: this.groups.get(order.groupId),
            creator: this.users.get(order.createdBy)
          };
        }
      }

      // Compter les commentaires de rapprochement pour cette livraison
      const commentsCount = Array.from(this.reconciliationComments.values())
        .filter(comment => comment.deliveryId === delivery.id).length;

      return {
        ...delivery,
        supplier: this.suppliers.get(delivery.supplierId),
        group: this.groups.get(delivery.groupId),
        creator: this.users.get(delivery.createdBy || ''),
        order: associatedOrder,
        reconciliationCommentsCount: commentsCount
      };
    });
  }

  async getDelivery(id: number): Promise<DeliveryWithRelations | undefined> {
    const delivery = this.deliveries.get(id);
    if (!delivery) return undefined;
    
    // Récupérer la commande associée si elle existe
    let associatedOrder = undefined;
    if (delivery.orderId) {
      const order = this.orders.get(delivery.orderId);
      if (order) {
        associatedOrder = {
          ...order,
          supplier: this.suppliers.get(order.supplierId),
          group: this.groups.get(order.groupId),
          creator: this.users.get(order.createdBy)
        };
      }
    }
    
    // Compter les commentaires de rapprochement pour cette livraison
    const commentsCount = Array.from(this.reconciliationComments.values())
      .filter(comment => comment.deliveryId === delivery.id).length;

    return {
      ...delivery,
      supplier: this.suppliers.get(delivery.supplierId),
      group: this.groups.get(delivery.groupId),
      creator: this.users.get(delivery.createdBy || ''),
      order: associatedOrder,
      reconciliationCommentsCount: commentsCount
    };
  }

  async createDelivery(deliveryData: InsertDelivery): Promise<Delivery> {
    const id = this.idCounters.delivery++;
    const delivery: Delivery = {
      id,
      ...deliveryData,
      status: 'planned', // Livraisons créées sont automatiquement planifiées
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.deliveries.set(id, delivery);
    
    // Si une commande est liée, la marquer comme "planned" (pas delivered!)
    if (deliveryData.orderId) {
      try {
        const order = this.orders.get(deliveryData.orderId);
        if (order && order.status === 'pending') {
          console.log(`🔗 Delivery #${id} linked to order #${deliveryData.orderId}, updating order status to 'planned'`);
          await this.updateOrder(deliveryData.orderId, { status: 'planned' });
        }
      } catch (error) {
        console.error(`❌ Failed to update order #${deliveryData.orderId} status to planned:`, error);
      }
    }
    
    return delivery;
  }

  async updateDelivery(id: number, deliveryData: Partial<InsertDelivery>): Promise<Delivery> {
    const existingDelivery = this.deliveries.get(id);
    if (!existingDelivery) throw new Error('Delivery not found');
    
    const updatedDelivery = {
      ...existingDelivery,
      ...deliveryData,
      updatedAt: new Date(),
    };
    this.deliveries.set(id, updatedDelivery);
    
    // CRITICAL FIX: Si une commande est liée lors de l'édition, la marquer comme "planned"
    if (deliveryData.orderId) {
      try {
        const order = this.orders.get(deliveryData.orderId);
        if (order && order.status === 'pending') {
          console.log(`🔗 CALENDAR EDIT (DEV): Delivery #${id} linked to order #${deliveryData.orderId}, updating order status to 'planned'`);
          await this.updateOrder(deliveryData.orderId, { status: 'planned' });
          console.log(`✅ CALENDAR EDIT (DEV): Order #${deliveryData.orderId} status updated to 'planned'`);
        } else if (order) {
          console.log(`ℹ️ CALENDAR EDIT (DEV): Order #${deliveryData.orderId} status is '${order.status}', no update needed`);
        }
      } catch (error) {
        console.error(`❌ CALENDAR EDIT (DEV): Failed to update order #${deliveryData.orderId} status to planned:`, error);
      }
    }
    
    return updatedDelivery;
  }

  async deleteDelivery(id: number): Promise<void> {
    this.deliveries.delete(id);
  }

  async validateDelivery(id: number, blData?: { blNumber: string; blAmount: number }): Promise<void> {
    const delivery = this.deliveries.get(id);
    if (!delivery) throw new Error('Delivery not found');
    
    const updatedDelivery = {
      ...delivery,
      status: 'delivered' as const,
      deliveredDate: new Date(),
      blNumber: blData?.blNumber || delivery.blNumber,
      blAmount: blData?.blAmount || delivery.blAmount,
      updatedAt: new Date(),
    };
    this.deliveries.set(id, updatedDelivery);
  }

  async getUserGroups(): Promise<UserGroup[]> { return []; }
  async assignUserToGroup(): Promise<UserGroup> { return {} as UserGroup; }
  async removeUserFromGroup(): Promise<void> {}

  async getMonthlyStats(): Promise<any> { 
    return {
      ordersCount: 12,
      deliveriesCount: 8,
      pendingOrdersCount: 3,
      averageDeliveryTime: 2.5,
      totalPalettes: 45,
      totalPackages: 156,
    };
  }

  async getYearlyStats(): Promise<any> { 
    return {
      ordersCount: 144, // 12 mois * 12
      deliveriesCount: 96, // 12 mois * 8  
      pendingOrdersCount: 18, // 12 mois * 1.5
      averageDeliveryTime: 2.8, // Délai moyen annuel
      totalPalettes: 540, // 12 mois * 45
      totalPackages: 1872, // 12 mois * 156
    };
  }

  async getPublicities(year?: number, groupIds?: number[]): Promise<PublicityWithRelations[]> {
    let publicities = Array.from(this.publicities.values());
    
    // Filter by year if provided
    if (year) {
      publicities = publicities.filter(pub => pub.year === year);
    }
    
    // Sort by pubNumber in ASCENDING order (smallest first)
    publicities.sort((a, b) => a.pubNumber - b.pubNumber);
    
    // LOG: Debug du tri des publicités
    console.log(`📋 PUBLICITES (DEV): Tri par pubNumber croissant - ${publicities.length} résultats:`, 
      publicities.slice(0, 3).map(p => `N°${p.pubNumber}(${p.designation})`).join(', ') + 
      (publicities.length > 3 ? '...' : '')
    );
    
    // Return with empty participations for now (since we're using MemStorage)
    return publicities.map(pub => ({
      ...pub,
      participations: []
    }));
  }
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
      notes: orderData.notes || null,
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

  async getPendingClientCalls(groupIds?: number[]): Promise<CustomerOrderWithRelations[]> {
    let orders = Array.from(this.customerOrders.values());
    
    // Filter by groupIds if provided
    if (groupIds && groupIds.length > 0) {
      orders = orders.filter(order => groupIds.includes(order.groupId));
    }
    
    // Find orders where client not notified and status is 'Disponible'
    const pendingOrders = orders.filter(order => {
      return !order.customerNotified && 
             (order.status === 'Disponible' || order.status === 'disponible' || 
              order.status === 'Arrivé' || order.status === 'arrivé' ||
              order.status === 'Prêt' || order.status === 'prêt');
    });
    
    return pendingOrders.map(order => ({
      ...order,
      supplier: this.suppliers.get(order.supplierId)!,
      group: this.groups.get(order.groupId)!,
      creator: this.users.get(order.createdBy)!
    }));
  }

  async markClientCalled(customerOrderId: number, calledBy: string): Promise<CustomerOrder> {
    const order = this.customerOrders.get(customerOrderId);
    if (!order) {
      throw new Error(`CustomerOrder with id ${customerOrderId} not found`);
    }
    
    const updatedOrder = {
      ...order,
      customerNotified: true,
      updatedAt: new Date()
    };
    
    this.customerOrders.set(customerOrderId, updatedOrder);
    return updatedOrder;
  }

  async getDlcProducts(groupIds?: number[], filters?: { status?: string; supplierId?: number; search?: string; }): Promise<DlcProductWithRelations[]> {
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
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        products = products.filter(product => {
          const supplier = this.suppliers.get(product.supplierId);
          return product.productName.toLowerCase().includes(searchTerm) ||
                 (supplier && supplier.name.toLowerCase().includes(searchTerm));
        });
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
      notes: productData.notes || null,
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
      status: "valides",
      updatedAt: new Date() 
    };
    this.dlcProducts.set(id, updatedProduct);
    return { ...updatedProduct, dlcDate: new Date(updatedProduct.expiryDate) } as DlcProductFrontend;
  }

  async markDlcProductStockEpuise(id: number, markedBy: string): Promise<DlcProductFrontend> {
    const existingProduct = this.dlcProducts.get(id);
    if (!existingProduct) throw new Error('DLC Product not found');
    
    const updatedProduct = { 
      ...existingProduct, 
      stockEpuise: true,
      stockEpuiseBy: markedBy,
      stockEpuiseAt: new Date(),
      updatedAt: new Date() 
    };
    this.dlcProducts.set(id, updatedProduct);
    return { ...updatedProduct, dlcDate: new Date(updatedProduct.expiryDate) } as DlcProductFrontend;
  }

  async restoreDlcProductStock(id: number): Promise<DlcProductFrontend> {
    const existingProduct = this.dlcProducts.get(id);
    if (!existingProduct) throw new Error('DLC Product not found');
    
    const updatedProduct = { 
      ...existingProduct, 
      stockEpuise: false,
      stockEpuiseBy: null,
      stockEpuiseAt: null,
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

  async getTasks(groupIds?: number[], userRole?: string): Promise<TaskWithRelations[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let tasks = Array.from(this.tasks.values());
    
    if (groupIds && groupIds.length > 0) {
      tasks = tasks.filter(task => groupIds.includes(task.groupId));
    }
    
    // Filtrage par rôle pour la date de départ
    if (userRole === 'manager' || userRole === 'employee') {
      // Managers et employés : seulement les tâches dont la date de départ est atteinte ou passée
      tasks = tasks.filter(task => {
        if (!task.startDate) return true; // Tâches sans date de départ (toujours visibles)
        const startDate = new Date(task.startDate);
        return startDate <= today; // Tâches dont la date de départ est arrivée
      });
    }
    // Admin et directeur voient toutes les tâches, y compris les tâches programmées
    
    return tasks.map(task => ({
      ...task,
      group: this.groups.get(task.groupId)!,
      creator: this.users.get(task.createdBy)!,
      isFutureTask: task.startDate ? new Date(task.startDate) > today : false
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
      description: taskData.description || null,
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
      customerEmail: null,
      productDesignation: 'Table de jardin',
      productReference: null,
      gencode: null,
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
      customerEmail: null,
      productDesignation: 'Chaises pliantes x4',
      productReference: null,
      gencode: null,
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
      gencode: 'YAO001',
      dateType: 'DLC',
      expiryDate: '2025-08-20',
      status: 'en_cours',
      quantity: 24,
      unit: 'pièces',
      notes: 'À vendre rapidement' as string | null,
      location: 'Frigo principal',
      alertThreshold: 5,
      validatedBy: null as string | null,
      validatedAt: null,
      stockEpuise: false,
      stockEpuiseBy: null,
      stockEpuiseAt: null,
      createdAt: new Date('2025-08-10'),
      updatedAt: new Date('2025-08-10'),
    };

    const testDlc2: DlcProduct = {
      id: 2,
      supplierId: 1,
      groupId: 1,
      createdBy: 'admin',
      productName: 'Pain de mie complet',
      gencode: 'PAIN002',
      dateType: 'DLC',
      expiryDate: '2025-08-16',
      status: 'alerte',
      quantity: 8,
      unit: 'unités',
      notes: 'DLC proche, promotion conseillée' as string | null,
      location: 'Rayonnage A3',
      alertThreshold: 3,
      validatedBy: null as string | null,
      validatedAt: null,
      stockEpuise: false,
      stockEpuiseBy: null,
      stockEpuiseAt: null,
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

    // Add test publicity data
    const testPublicity1: Publicity = {
      id: 1,
      pubNumber: 2517,
      designation: 'Prix Fracassés',
      startDate: new Date('2025-10-27'),
      endDate: new Date('2025-11-02'),
      year: 2025,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const testPublicity2: Publicity = {
      id: 2,
      pubNumber: 2520,
      designation: 'Halloween',
      startDate: new Date('2025-10-08'),
      endDate: new Date('2025-10-12'),
      year: 2025,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const testPublicity3: Publicity = {
      id: 3,
      pubNumber: 2521,
      designation: 'Prix Fous',
      startDate: new Date('2025-10-20'),
      endDate: new Date('2025-10-26'),
      year: 2025,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const testPublicity4: Publicity = {
      id: 4,
      pubNumber: 2518,
      designation: 'Le mois anniversaire 1',
      startDate: new Date('2025-11-17'),
      endDate: new Date('2025-11-23'),
      year: 2025,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const testPublicity5: Publicity = {
      id: 5,
      pubNumber: 2523,
      designation: 'Noël',
      startDate: new Date('2025-11-05'),
      endDate: new Date('2025-11-09'),
      year: 2025,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const testPublicity6: Publicity = {
      id: 6,
      pubNumber: 2524,
      designation: 'Cadeaux et noel',
      startDate: new Date('2025-11-17'),
      endDate: new Date('2025-11-23'),
      year: 2025,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const testPublicity7: Publicity = {
      id: 7,
      pubNumber: 2525,
      designation: 'Deco et Table en Fete',
      startDate: new Date('2025-11-24'),
      endDate: new Date('2025-11-30'),
      year: 2025,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const testPublicity8: Publicity = {
      id: 8,
      pubNumber: 2526,
      designation: 'Sous le Sapin',
      startDate: new Date('2025-12-03'),
      endDate: new Date('2025-12-07'),
      year: 2025,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.publicities.set(1, testPublicity1);
    this.publicities.set(2, testPublicity2);
    this.publicities.set(3, testPublicity3);
    this.publicities.set(4, testPublicity4);
    this.publicities.set(5, testPublicity5);
    this.publicities.set(6, testPublicity6);
    this.publicities.set(7, testPublicity7);
    this.publicities.set(8, testPublicity8);
    this.idCounters.publicity = 9;

    // Initialize test SAV data
    this.initializeSavTestData();
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

  // SAV operations
  async getSavTickets(filters?: { 
    groupIds?: number[]; 
    status?: string; 
    supplierId?: number; 
    priority?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SavTicketWithRelations[]> {
    const tickets = Array.from(this.savTickets.values());
    
    let filteredTickets = tickets;
    
    if (filters?.groupIds?.length) {
      filteredTickets = filteredTickets.filter(ticket => filters.groupIds!.includes(ticket.groupId));
    }
    if (filters?.status) {
      filteredTickets = filteredTickets.filter(ticket => ticket.status === filters.status);
    }
    if (filters?.supplierId) {
      filteredTickets = filteredTickets.filter(ticket => ticket.supplierId === filters.supplierId);
    }
    if (filters?.priority) {
      filteredTickets = filteredTickets.filter(ticket => ticket.priority === filters.priority);
    }
    if (filters?.startDate) {
      const startDate = new Date(filters.startDate);
      filteredTickets = filteredTickets.filter(ticket => 
        ticket.createdAt && ticket.createdAt >= startDate
      );
    }
    if (filters?.endDate) {
      const endDate = new Date(filters.endDate);
      filteredTickets = filteredTickets.filter(ticket => 
        ticket.createdAt && ticket.createdAt <= endDate
      );
    }

    // Sort by creation date (newest first)
    filteredTickets.sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    // Add relations for each ticket
    const ticketsWithRelations = await Promise.all(
      filteredTickets.map(async (ticket) => {
        const supplier = this.suppliers.get(ticket.supplierId);
        const group = this.groups.get(ticket.groupId);
        const creator = this.users.get(ticket.createdBy);
        const history = await this.getSavTicketHistory(ticket.id);
        
        return {
          ...ticket,
          supplier: supplier!,
          group: group!,
          creator: creator!,
          history,
        };
      })
    );

    return ticketsWithRelations;
  }

  async getSavTicket(id: number): Promise<SavTicketWithRelations | undefined> {
    const ticket = this.savTickets.get(id);
    if (!ticket) return undefined;

    const supplier = this.suppliers.get(ticket.supplierId);
    const group = this.groups.get(ticket.groupId);
    const creator = this.users.get(ticket.createdBy);
    const history = await this.getSavTicketHistory(id);

    return {
      ...ticket,
      supplier: supplier!,
      group: group!,
      creator: creator!,
      history,
    };
  }

  async createSavTicket(ticketData: InsertSavTicket): Promise<SavTicket> {
    const id = this.idCounters.savTicket++;
    
    // Generate ticket number
    const currentYear = new Date().getFullYear();
    const ticketNumber = `SAV-${currentYear}-${String(id).padStart(4, '0')}`;

    const ticket: SavTicket = {
      id,
      ticketNumber,
      ...ticketData,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
      closedAt: null,
    };

    this.savTickets.set(id, ticket);

    // Add initial history entry
    await this.addSavTicketHistory({
      ticketId: id,
      action: 'created',
      description: `Ticket créé avec le statut "${ticket.status}"`,
      createdBy: ticket.createdBy,
    });

    return ticket;
  }

  async updateSavTicket(id: number, ticketData: Partial<InsertSavTicket>): Promise<SavTicket> {
    const existingTicket = this.savTickets.get(id);
    if (!existingTicket) throw new Error('SAV ticket not found');
    
    const updatedTicket = { 
      ...existingTicket, 
      ...ticketData, 
      updatedAt: new Date() 
    };
    
    // Set resolved/closed dates based on status
    if (ticketData.status === 'resolu' && !updatedTicket.resolvedAt) {
      updatedTicket.resolvedAt = new Date();
    }
    if (ticketData.status === 'ferme' && !updatedTicket.closedAt) {
      updatedTicket.closedAt = new Date();
    }

    this.savTickets.set(id, updatedTicket);
    return updatedTicket;
  }

  async deleteSavTicket(id: number): Promise<void> {
    // Delete history first
    this.savTicketHistories.delete(id);
    // Delete ticket
    this.savTickets.delete(id);
  }

  async getSavTicketHistory(ticketId: number): Promise<SavTicketHistoryWithCreator[]> {
    const histories = this.savTicketHistories.get(ticketId) || [];
    
    const historiesWithCreators = histories.map(history => {
      const creator = this.users.get(history.createdBy);
      return {
        ...history,
        creator: creator!,
      };
    });

    // Sort by creation date (newest first)
    return historiesWithCreators.sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }

  async addSavTicketHistory(historyData: InsertSavTicketHistory): Promise<SavTicketHistory> {
    const id = this.idCounters.savTicketHistory++;
    
    const history: SavTicketHistory = {
      id,
      ...historyData,
      createdAt: new Date(),
    };

    const existingHistories = this.savTicketHistories.get(historyData.ticketId) || [];
    existingHistories.push(history);
    this.savTicketHistories.set(historyData.ticketId, existingHistories);

    return history;
  }

  async getSavTicketStats(groupIds?: number[]): Promise<{
    totalTickets: number;
    newTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    criticalTickets: number;
  }> {
    let tickets = Array.from(this.savTickets.values());
    
    if (groupIds?.length) {
      tickets = tickets.filter(ticket => groupIds.includes(ticket.groupId));
    }

    const stats = {
      totalTickets: tickets.length,
      newTickets: tickets.filter(t => t.status === 'nouveau').length,
      inProgressTickets: tickets.filter(t => 
        ['en_cours', 'attente_pieces', 'attente_echange'].includes(t.status)
      ).length,
      resolvedTickets: tickets.filter(t => 
        ['resolu', 'ferme'].includes(t.status)
      ).length,
      criticalTickets: tickets.filter(t => t.priority === 'critique').length,
    };

    return stats;
  }

  private initializeSavTestData() {
    // Test SAV tickets
    const testTicket1: SavTicket = {
      id: 1,
      ticketNumber: 'SAV-2025-0001',
      groupId: 1,
      supplierId: 1,
      clientName: 'Jean Dupont',
      clientPhone: '03 83 12 34 56',
      problemDescription: 'Produit défaillant après 2 jours d\'utilisation. Écran cassé et boutons non fonctionnels.',
      productGencode: '12345678901234',
      productReference: 'REF-ABC-123',
      productDesignation: 'Tablette Samsung Galaxy Tab A7',
      status: 'nouveau',
      priority: 'haute',
      createdBy: 'admin',
      createdAt: new Date('2025-08-10T08:30:00'),
      updatedAt: new Date('2025-08-10T08:30:00'),
      resolvedAt: null,
      closedAt: null,
    };

    const testTicket2: SavTicket = {
      id: 2,
      ticketNumber: 'SAV-2025-0002',
      groupId: 1,
      supplierId: 2,
      clientName: 'Marie Martin',
      clientPhone: '06 12 34 56 78',
      problemDescription: 'Pièces manquantes dans le colis. Manque le chargeur et les écouteurs.',
      productGencode: '23456789012345',
      productReference: 'REF-XYZ-456',
      productDesignation: 'Smartphone iPhone 14',
      status: 'en_cours',
      priority: 'normale',
      createdBy: 'admin',
      createdAt: new Date('2025-08-09T14:15:00'),
      updatedAt: new Date('2025-08-12T10:20:00'),
      resolvedAt: null,
      closedAt: null,
    };

    const testTicket3: SavTicket = {
      id: 3,
      ticketNumber: 'SAV-2025-0003',
      groupId: 1,
      supplierId: 1,
      clientName: 'Pierre Durand',
      clientPhone: '03 83 98 76 54',
      problemDescription: 'En attente de la pièce de rechange. Écran de remplacement commandé chez le fournisseur.',
      productGencode: '34567890123456',
      productReference: 'REF-DEF-789',
      productDesignation: 'Ordinateur portable Dell Inspiron',
      status: 'attente_pieces',
      priority: 'normale',
      createdBy: 'admin',
      createdAt: new Date('2025-08-08T09:45:00'),
      updatedAt: new Date('2025-08-13T16:30:00'),
      resolvedAt: null,
      closedAt: null,
    };

    const testTicket4: SavTicket = {
      id: 4,
      ticketNumber: 'SAV-2025-0004',
      groupId: 1,
      supplierId: 3,
      clientName: 'Sophie Moreau',
      clientPhone: '06 98 76 54 32',
      problemDescription: 'Problème résolu. Produit réparé et testé. Prêt pour le retour client.',
      productGencode: '45678901234567',
      productReference: 'REF-GHI-012',
      productDesignation: 'Casque Sony WH-1000XM4',
      status: 'resolu',
      priority: 'faible',
      createdBy: 'admin',
      createdAt: new Date('2025-08-05T11:20:00'),
      updatedAt: new Date('2025-08-14T08:00:00'),
      resolvedAt: new Date('2025-08-14T08:00:00'),
      closedAt: null,
    };

    const testTicket5: SavTicket = {
      id: 5,
      ticketNumber: 'SAV-2025-0005',
      groupId: 1,
      supplierId: 2,
      clientName: 'Luc Bernard',
      clientPhone: '03 83 45 67 89',
      problemDescription: 'URGENT - Produit en panne critique pour activité professionnelle. Besoin intervention rapide.',
      productGencode: '56789012345678',
      productReference: 'REF-JKL-345',
      productDesignation: 'Imprimante HP LaserJet Pro',
      status: 'en_cours',
      priority: 'critique',
      createdBy: 'admin',
      createdAt: new Date('2025-08-14T07:30:00'),
      updatedAt: new Date('2025-08-14T07:30:00'),
      resolvedAt: null,
      closedAt: null,
    };

    // Store the tickets
    this.savTickets.set(1, testTicket1);
    this.savTickets.set(2, testTicket2);
    this.savTickets.set(3, testTicket3);
    this.savTickets.set(4, testTicket4);
    this.savTickets.set(5, testTicket5);

    // Add history entries for each ticket
    const histories = [
      // Ticket 1 history
      { ticketId: 1, action: 'created', description: 'Ticket créé avec le statut "nouveau"', createdBy: 'admin', createdAt: new Date('2025-08-10T08:30:00') },
      
      // Ticket 2 history
      { ticketId: 2, action: 'created', description: 'Ticket créé avec le statut "nouveau"', createdBy: 'admin', createdAt: new Date('2025-08-09T14:15:00') },
      { ticketId: 2, action: 'status_change', description: 'Statut changé de "nouveau" vers "en_cours"', createdBy: 'admin', createdAt: new Date('2025-08-12T10:20:00') },
      { ticketId: 2, action: 'comment', description: 'Contact avec le client pour confirmer les pièces manquantes. Commande des accessoires en cours.', createdBy: 'admin', createdAt: new Date('2025-08-12T10:25:00') },
      
      // Ticket 3 history
      { ticketId: 3, action: 'created', description: 'Ticket créé avec le statut "nouveau"', createdBy: 'admin', createdAt: new Date('2025-08-08T09:45:00') },
      { ticketId: 3, action: 'status_change', description: 'Statut changé de "nouveau" vers "en_cours"', createdBy: 'admin', createdAt: new Date('2025-08-10T14:00:00') },
      { ticketId: 3, action: 'status_change', description: 'Statut changé de "en_cours" vers "attente_pieces"', createdBy: 'admin', createdAt: new Date('2025-08-13T16:30:00') },
      { ticketId: 3, action: 'comment', description: 'Écran de remplacement commandé. Délai annoncé de 5-7 jours ouvrables.', createdBy: 'admin', createdAt: new Date('2025-08-13T16:35:00') },
      
      // Ticket 4 history  
      { ticketId: 4, action: 'created', description: 'Ticket créé avec le statut "nouveau"', createdBy: 'admin', createdAt: new Date('2025-08-05T11:20:00') },
      { ticketId: 4, action: 'status_change', description: 'Statut changé de "nouveau" vers "en_cours"', createdBy: 'admin', createdAt: new Date('2025-08-06T09:00:00') },
      { ticketId: 4, action: 'comment', description: 'Diagnostic effectué : problème de connectivité Bluetooth. Réparation en cours.', createdBy: 'admin', createdAt: new Date('2025-08-07T15:30:00') },
      { ticketId: 4, action: 'status_change', description: 'Statut changé de "en_cours" vers "resolu"', createdBy: 'admin', createdAt: new Date('2025-08-14T08:00:00') },
      { ticketId: 4, action: 'comment', description: 'Casque réparé avec succès. Module Bluetooth remplacé. Tests complets effectués.', createdBy: 'admin', createdAt: new Date('2025-08-14T08:05:00') },
      
      // Ticket 5 history
      { ticketId: 5, action: 'created', description: 'Ticket créé avec le statut "nouveau"', createdBy: 'admin', createdAt: new Date('2025-08-14T07:30:00') },
      { ticketId: 5, action: 'status_change', description: 'Statut changé de "nouveau" vers "en_cours"', createdBy: 'admin', createdAt: new Date('2025-08-14T07:30:00') },
      { ticketId: 5, action: 'comment', description: 'Priorité critique - Intervention d\'urgence programmée pour ce matin.', createdBy: 'admin', createdAt: new Date('2025-08-14T07:35:00') },
    ];

    // Initialize history for each ticket
    histories.forEach((historyEntry) => {
      const id = this.idCounters.savTicketHistory++;
      const history: SavTicketHistory = {
        id,
        ...historyEntry,
      };
      
      const existingHistories = this.savTicketHistories.get(historyEntry.ticketId) || [];
      existingHistories.push(history);
      this.savTicketHistories.set(historyEntry.ticketId, existingHistories);
    });

    this.idCounters.savTicket = 6;
    console.log('✅ SAV test data initialized with 5 tickets and comprehensive history');
  }

  // Weather operations
  async getWeatherSettings(): Promise<WeatherSettings | undefined> {
    // In memory storage, return a default setting for development
    return {
      id: 1,
      apiKey: "6PSHYLBJB9EEYNZ7NDQ5BPGBZ", // Token fourni par l'utilisateur
      location: "Nancy, France",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async createWeatherSettings(settings: InsertWeatherSettings): Promise<WeatherSettings> {
    // For development, we'll just return the created settings with an ID
    return {
      id: 1,
      ...settings,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateWeatherSettings(id: number, settings: Partial<InsertWeatherSettings>): Promise<WeatherSettings> {
    const existing = await this.getWeatherSettings();
    return {
      ...existing!,
      ...settings,
      updatedAt: new Date()
    };
  }

  async getWeatherData(date: string, isCurrentYear: boolean): Promise<WeatherData | undefined> {
    // In development, return some mock data for testing
    return undefined; // Will trigger API calls
  }

  async createWeatherData(data: InsertWeatherData): Promise<WeatherData> {
    return {
      id: 1,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateWeatherData(id: number, data: Partial<InsertWeatherData>): Promise<WeatherData> {
    const existing = await this.getWeatherData(data.date || "", data.isCurrentYear || true);
    return {
      ...existing!,
      ...data,
      updatedAt: new Date()
    };
  }

  async deleteOldWeatherData(daysToKeep: number): Promise<void> {
    // In development, this is a no-op
    console.log(`🧹 DEV: Would delete weather data older than ${daysToKeep} days`);
  }

  async clearWeatherCache(): Promise<void> {
    // In development, this is a no-op
    console.log('🧹 DEV: Weather cache cleared due to location change');
  }

  // Webhook BAP Configuration
  async getWebhookBapConfig(): Promise<WebhookBapConfig | undefined> {
    // En développement, retourner une config par défaut
    return {
      id: 1,
      name: "Configuration BAP",
      webhookUrl: "https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d",
      description: "Configuration par défaut pour développement",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async createWebhookBapConfig(config: InsertWebhookBapConfig): Promise<WebhookBapConfig> {
    return {
      id: 1,
      ...config,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateWebhookBapConfig(id: number, config: Partial<InsertWebhookBapConfig>): Promise<WebhookBapConfig> {
    const existing = await this.getWebhookBapConfig();
    return {
      ...existing!,
      ...config,
      updatedAt: new Date()
    };
  }

  // Announcement operations
  async createAnnouncement(announcementData: InsertAnnouncement): Promise<Announcement> {
    const announcementStorage = getAnnouncementStorage(
      async () => Array.from(this.users.values()),
      async () => Array.from(this.groups.values())
    );
    return await announcementStorage.createAnnouncement(announcementData);
  }

  async getAnnouncements(groupIds?: number[]): Promise<AnnouncementWithRelations[]> {
    const announcementStorage = getAnnouncementStorage(
      async () => Array.from(this.users.values()),
      async () => Array.from(this.groups.values())
    );
    return await announcementStorage.getAnnouncements(groupIds);
  }

  async getAnnouncement(id: number): Promise<AnnouncementWithRelations | undefined> {
    const announcementStorage = getAnnouncementStorage(
      async () => Array.from(this.users.values()),
      async () => Array.from(this.groups.values())
    );
    return await announcementStorage.getAnnouncement(id);
  }

  async updateAnnouncement(id: number, announcementData: Partial<InsertAnnouncement>): Promise<AnnouncementWithRelations> {
    const announcementStorage = getAnnouncementStorage(
      async () => Array.from(this.users.values()),
      async () => Array.from(this.groups.values())
    );
    return await announcementStorage.updateAnnouncement(id, announcementData);
  }

  async deleteAnnouncement(id: number): Promise<boolean> {
    const announcementStorage = getAnnouncementStorage(
      async () => Array.from(this.users.values()),
      async () => Array.from(this.groups.values())
    );
    return await announcementStorage.deleteAnnouncement(id);
  }

  // Avoir operations
  async getAvoirs(groupIds?: number[]): Promise<AvoirWithRelations[]> {
    let avoirs = Array.from(this.avoirs.values());
    
    // Filter by groups if provided
    if (groupIds && groupIds.length > 0) {
      avoirs = avoirs.filter(avoir => groupIds.includes(avoir.groupId));
    }

    return avoirs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(avoir => ({
        ...avoir,
        supplier: this.suppliers.get(avoir.supplierId)!,
        group: this.groups.get(avoir.groupId)!,
        creator: this.users.get(avoir.createdBy)!,
      }));
  }

  async getAvoir(id: number): Promise<AvoirWithRelations | undefined> {
    const avoir = this.avoirs.get(id);
    if (!avoir) return undefined;
    
    return {
      ...avoir,
      supplier: this.suppliers.get(avoir.supplierId)!,
      group: this.groups.get(avoir.groupId)!,
      creator: this.users.get(avoir.createdBy)!,
    };
  }

  async createAvoir(avoirData: InsertAvoir): Promise<Avoir> {
    const id = this.idCounters.avoir++;
    const avoir: Avoir = {
      id,
      ...avoirData,
      status: 'En attente de demande',
      webhookSent: false,
      nocodbVerified: false,
      nocodbVerifiedAt: null,
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.avoirs.set(id, avoir);
    return avoir;
  }

  async updateAvoir(id: number, avoirData: Partial<InsertAvoir>): Promise<Avoir> {
    const existingAvoir = this.avoirs.get(id);
    if (!existingAvoir) throw new Error('Avoir not found');
    
    const updatedAvoir = {
      ...existingAvoir,
      ...avoirData,
      updatedAt: new Date(),
    };
    this.avoirs.set(id, updatedAvoir);
    return updatedAvoir;
  }

  async deleteAvoir(id: number): Promise<void> {
    this.avoirs.delete(id);
  }

  async updateAvoirWebhookStatus(id: number, webhookSent: boolean): Promise<void> {
    const avoir = this.avoirs.get(id);
    if (avoir) {
      avoir.webhookSent = webhookSent;
      avoir.updatedAt = new Date();
      this.avoirs.set(id, avoir);
    }
  }

  async updateAvoirNocodbVerification(id: number, verified: boolean): Promise<void> {
    const avoir = this.avoirs.get(id);
    if (avoir) {
      avoir.nocodbVerified = verified;
      avoir.nocodbVerifiedAt = verified ? new Date() : null;
      avoir.updatedAt = new Date();
      this.avoirs.set(id, avoir);
    }
  }

  // Reconciliation Comments operations
  async getReconciliationComments(deliveryId: number): Promise<ReconciliationCommentWithRelations[]> {
    const comments = Array.from(this.reconciliationComments.values())
      .filter(comment => comment.deliveryId === deliveryId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

    return comments.map(comment => {
      const delivery = this.deliveries.get(comment.deliveryId);
      const author = this.users.get(comment.authorId);
      const group = this.groups.get(comment.groupId);
      
      if (!delivery || !author || !group) {
        throw new Error('Missing related data for reconciliation comment');
      }

      const supplier = this.suppliers.get(delivery.supplierId);
      const creator = this.users.get(delivery.createdBy);
      
      if (!supplier || !creator) {
        throw new Error('Missing delivery related data for reconciliation comment');
      }

      return {
        ...comment,
        delivery: {
          ...delivery,
          supplier,
          group,
          creator,
        },
        group,
        author,
      } as ReconciliationCommentWithRelations;
    });
  }

  async getReconciliationCommentById(id: number): Promise<ReconciliationCommentWithRelations | undefined> {
    const comment = this.reconciliationComments.get(id);
    if (!comment) return undefined;

    const delivery = this.deliveries.get(comment.deliveryId);
    const author = this.users.get(comment.authorId);
    const group = this.groups.get(comment.groupId);
    
    if (!delivery || !author || !group) {
      throw new Error('Missing related data for reconciliation comment');
    }

    const supplier = this.suppliers.get(delivery.supplierId);
    const creator = this.users.get(delivery.createdBy);
    
    if (!supplier || !creator) {
      throw new Error('Missing delivery related data for reconciliation comment');
    }

    return {
      ...comment,
      delivery: {
        ...delivery,
        supplier,
        group,
        creator,
      },
      group,
      author,
    } as ReconciliationCommentWithRelations;
  }

  async createReconciliationComment(commentData: InsertReconciliationComment): Promise<ReconciliationComment> {
    const id = this.idCounters.reconciliationComment++;
    const comment: ReconciliationComment = {
      id,
      ...commentData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.reconciliationComments.set(id, comment);
    return comment;
  }

  async updateReconciliationComment(id: number, commentData: Partial<InsertReconciliationComment>): Promise<ReconciliationComment> {
    const existingComment = this.reconciliationComments.get(id);
    if (!existingComment) throw new Error('Reconciliation comment not found');
    
    const updatedComment = {
      ...existingComment,
      ...commentData,
      updatedAt: new Date(),
    };
    this.reconciliationComments.set(id, updatedComment);
    return updatedComment;
  }

  async deleteReconciliationComment(id: number): Promise<void> {
    this.reconciliationComments.delete(id);
  }

  // Analytics implementations for MemStorage
  async getAnalyticsSummary(filters: {
    startDate?: Date;
    endDate?: Date;
    supplierIds?: number[];
    groupIds?: number[];
    status?: string[];
  }): Promise<{
    totalOrders: number;
    totalDeliveries: number;
    onTimeRate: number;
    totalAmount: number;
    avgDeliveryDelay: number;
    topSuppliers: Array<{ id: number; name: string; count: number; amount: number }>;
    topStores: Array<{ id: number; name: string; orders: number; deliveries: number }>;
  }> {
    // Simple implementation for development
    const orders = Array.from(this.orders.values());
    const deliveries = Array.from(this.deliveries.values());
    
    // Apply filters
    const filteredOrders = orders.filter(order => {
      if (filters.startDate && order.plannedDate < filters.startDate) return false;
      if (filters.endDate && order.plannedDate > filters.endDate) return false;
      if (filters.supplierIds?.length && !filters.supplierIds.includes(order.supplierId)) return false;
      if (filters.groupIds?.length && !filters.groupIds.includes(order.groupId)) return false;
      if (filters.status?.length && !filters.status.includes(order.status)) return false;
      return true;
    });

    const filteredDeliveries = deliveries.filter(delivery => {
      if (filters.startDate && delivery.scheduledDate < filters.startDate) return false;
      if (filters.endDate && delivery.scheduledDate > filters.endDate) return false;
      if (filters.supplierIds?.length && !filters.supplierIds.includes(delivery.supplierId)) return false;
      if (filters.groupIds?.length && !filters.groupIds.includes(delivery.groupId)) return false;
      if (filters.status?.length && !filters.status.includes(delivery.status)) return false;
      return true;
    });

    // Calculate metrics
    const totalOrders = filteredOrders.length;
    const totalDeliveries = filteredDeliveries.length;
    const onTimeDeliveries = filteredDeliveries.filter(d => 
      d.deliveredDate && d.deliveredDate <= d.scheduledDate
    ).length;
    const onTimeRate = totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 0;
    
    const totalAmount = filteredDeliveries.reduce((sum, d) => {
      return sum + (parseFloat(d.blAmount as any) || 0) + (parseFloat(d.invoiceAmount as any) || 0);
    }, 0);

    // Top suppliers
    const supplierStats = new Map<number, { name: string; count: number; amount: number }>();
    filteredDeliveries.forEach(d => {
      const supplier = this.suppliers.get(d.supplierId);
      if (supplier) {
        const stats = supplierStats.get(d.supplierId) || { name: supplier.name, count: 0, amount: 0 };
        stats.count++;
        stats.amount += parseFloat(d.blAmount as any) || 0;
        supplierStats.set(d.supplierId, stats);
      }
    });
    const topSuppliers = Array.from(supplierStats.entries())
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top stores
    const storeStats = new Map<number, { name: string; orders: number; deliveries: number }>();
    filteredOrders.forEach(o => {
      const group = this.groups.get(o.groupId);
      if (group) {
        const stats = storeStats.get(o.groupId) || { name: group.name, orders: 0, deliveries: 0 };
        stats.orders++;
        storeStats.set(o.groupId, stats);
      }
    });
    filteredDeliveries.forEach(d => {
      const group = this.groups.get(d.groupId);
      if (group) {
        const stats = storeStats.get(d.groupId) || { name: group.name, orders: 0, deliveries: 0 };
        stats.deliveries++;
        storeStats.set(d.groupId, stats);
      }
    });
    const topStores = Array.from(storeStats.entries())
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => (b.orders + b.deliveries) - (a.orders + a.deliveries))
      .slice(0, 5);

    return {
      totalOrders,
      totalDeliveries,
      onTimeRate,
      totalAmount,
      avgDeliveryDelay: 0, // Simplified for development
      topSuppliers,
      topStores
    };
  }

  async getAnalyticsTimeseries(filters: {
    startDate?: Date;
    endDate?: Date;
    supplierIds?: number[];
    groupIds?: number[];
    granularity?: 'day' | 'week' | 'month';
  }): Promise<Array<{ date: string; orders: number; deliveries: number }>> {
    const dataMap = new Map<string, { orders: number; deliveries: number }>();
    
    // Process orders
    Array.from(this.orders.values()).forEach(order => {
      if (filters.startDate && order.plannedDate < filters.startDate) return;
      if (filters.endDate && order.plannedDate > filters.endDate) return;
      if (filters.supplierIds?.length && !filters.supplierIds.includes(order.supplierId)) return;
      if (filters.groupIds?.length && !filters.groupIds.includes(order.groupId)) return;
      
      const dateKey = order.plannedDate.toISOString().split('T')[0];
      const existing = dataMap.get(dateKey) || { orders: 0, deliveries: 0 };
      existing.orders++;
      dataMap.set(dateKey, existing);
    });

    // Process deliveries
    Array.from(this.deliveries.values()).forEach(delivery => {
      if (filters.startDate && delivery.scheduledDate < filters.startDate) return;
      if (filters.endDate && delivery.scheduledDate > filters.endDate) return;
      if (filters.supplierIds?.length && !filters.supplierIds.includes(delivery.supplierId)) return;
      if (filters.groupIds?.length && !filters.groupIds.includes(delivery.groupId)) return;
      
      const dateKey = delivery.scheduledDate.toISOString().split('T')[0];
      const existing = dataMap.get(dateKey) || { orders: 0, deliveries: 0 };
      existing.deliveries++;
      dataMap.set(dateKey, existing);
    });

    return Array.from(dataMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAnalyticsBySupplier(filters: {
    startDate?: Date;
    endDate?: Date;
    groupIds?: number[];
  }): Promise<Array<{ supplierId: number; supplierName: string; deliveries: number; amount: number }>> {
    const supplierStats = new Map<number, { name: string; deliveries: number; amount: number }>();
    
    Array.from(this.deliveries.values()).forEach(delivery => {
      if (filters.startDate && delivery.scheduledDate < filters.startDate) return;
      if (filters.endDate && delivery.scheduledDate > filters.endDate) return;
      if (filters.groupIds?.length && !filters.groupIds.includes(delivery.groupId)) return;
      
      const supplier = this.suppliers.get(delivery.supplierId);
      if (supplier) {
        const stats = supplierStats.get(delivery.supplierId) || { name: supplier.name, deliveries: 0, amount: 0 };
        stats.deliveries++;
        stats.amount += parseFloat(delivery.blAmount as any) || 0;
        supplierStats.set(delivery.supplierId, stats);
      }
    });

    return Array.from(supplierStats.entries())
      .map(([id, stats]) => ({ supplierId: id, supplierName: stats.name, ...stats }))
      .sort((a, b) => b.deliveries - a.deliveries);
  }

  async getAnalyticsByStore(filters: {
    startDate?: Date;
    endDate?: Date;
    supplierIds?: number[];
  }): Promise<Array<{ groupId: number; storeName: string; orders: number; deliveries: number }>> {
    const storeStats = new Map<number, { name: string; orders: number; deliveries: number }>();
    
    // Count orders
    Array.from(this.orders.values()).forEach(order => {
      if (filters.startDate && order.plannedDate < filters.startDate) return;
      if (filters.endDate && order.plannedDate > filters.endDate) return;
      if (filters.supplierIds?.length && !filters.supplierIds.includes(order.supplierId)) return;
      
      const group = this.groups.get(order.groupId);
      if (group) {
        const stats = storeStats.get(order.groupId) || { name: group.name, orders: 0, deliveries: 0 };
        stats.orders++;
        storeStats.set(order.groupId, stats);
      }
    });

    // Count deliveries
    Array.from(this.deliveries.values()).forEach(delivery => {
      if (filters.startDate && delivery.scheduledDate < filters.startDate) return;
      if (filters.endDate && delivery.scheduledDate > filters.endDate) return;
      if (filters.supplierIds?.length && !filters.supplierIds.includes(delivery.supplierId)) return;
      
      const group = this.groups.get(delivery.groupId);
      if (group) {
        const stats = storeStats.get(delivery.groupId) || { name: group.name, orders: 0, deliveries: 0 };
        stats.deliveries++;
        storeStats.set(delivery.groupId, stats);
      }
    });

    return Array.from(storeStats.entries())
      .map(([id, stats]) => ({ groupId: id, storeName: stats.name, ...stats }))
      .sort((a, b) => (b.orders + b.deliveries) - (a.orders + a.deliveries));
  }
}

// Use DatabaseStorage when DATABASE_URL is available, MemStorage as fallback
const isProduction = process.env.NODE_ENV === 'production';
const hasDatabase = !!process.env.DATABASE_URL;
console.log('🔗 Database initialization:', {
  NODE_ENV: process.env.NODE_ENV,
  isProduction: isProduction,
  hasDbUrl: hasDatabase,
  dbHost: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown'
});

export const storage: IStorage = hasDatabase ? new DatabaseStorage() : new MemStorage();
if (hasDatabase) {
  console.log('✅ Using DatabaseStorage (PostgreSQL database detected)');
} else {
  console.log('🔧 DEV: Using MemStorage (no database URL found)');
}