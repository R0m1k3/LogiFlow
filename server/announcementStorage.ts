import { DashboardMessage, InsertDashboardMessage, DashboardMessageWithRelations, User, Group } from "@shared/schema";
import { db } from "./db";
import { dashboardMessages, users, groups } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

// Type aliases pour compatibilité
type Announcement = DashboardMessage;
type InsertAnnouncement = InsertDashboardMessage;
type AnnouncementWithRelations = DashboardMessageWithRelations;

// Interface commune pour le stockage
interface IAnnouncementStorage {
  getAnnouncements(groupIds?: number[]): Promise<AnnouncementWithRelations[]>;
  getAnnouncement(id: number): Promise<AnnouncementWithRelations | null>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<DashboardMessage>;
  updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<DashboardMessage>;
  deleteAnnouncement(id: number): Promise<void>;
}

// Stockage PostgreSQL pour la production
class AnnouncementDatabaseStorage implements IAnnouncementStorage {
  async getAnnouncements(groupIds?: number[]): Promise<AnnouncementWithRelations[]> {
    let query = db
      .select({
        id: dashboardMessages.id,
        title: dashboardMessages.title,
        content: dashboardMessages.content,
        type: dashboardMessages.type,
        storeId: dashboardMessages.storeId,
        createdBy: dashboardMessages.createdBy,
        createdAt: dashboardMessages.createdAt,
        author: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
        },
        group: {
          id: groups.id,
          name: groups.name,
        },
      })
      .from(dashboardMessages)
      .leftJoin(users, eq(dashboardMessages.createdBy, users.username))
      .leftJoin(groups, eq(dashboardMessages.storeId, groups.id))
      .orderBy(desc(dashboardMessages.createdAt));

    const results = await query;
    
    return results.map((result: any) => ({
      id: result.id,
      title: result.title,
      content: result.content,
      type: result.type,
      storeId: result.storeId,
      createdBy: result.createdBy,
      createdAt: result.createdAt,
      author: result.author as User,
      group: result.group as Group | undefined,
    }));
  }

  async getAnnouncement(id: number): Promise<AnnouncementWithRelations | null> {
    console.log('🔍 [DB] Getting single announcement:', id);
    
    const result = await db
      .select({
        id: dashboardMessages.id,
        title: dashboardMessages.title,
        content: dashboardMessages.content,
        type: dashboardMessages.type,
        storeId: dashboardMessages.storeId,
        createdBy: dashboardMessages.createdBy,
        createdAt: dashboardMessages.createdAt,
        author: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
        },
        group: {
          id: groups.id,
          name: groups.name,
        },
      })
      .from(dashboardMessages)
      .leftJoin(users, eq(dashboardMessages.createdBy, users.username))
      .leftJoin(groups, eq(dashboardMessages.storeId, groups.id))
      .where(eq(dashboardMessages.id, id))
      .limit(1);

    if (result.length === 0) {
      console.log('❌ [DB] Announcement not found:', id);
      return null;
    }

    const announcement = result[0];
    console.log('✅ [DB] Found announcement:', announcement.id, announcement.title);

    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      storeId: announcement.storeId,
      createdBy: announcement.createdBy,
      createdAt: announcement.createdAt,
      author: announcement.author as User,
      group: announcement.group as Group | undefined,
    };
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<DashboardMessage> {
    const [created] = await db
      .insert(dashboardMessages)
      .values(announcement)
      .returning();
    return created;
  }

  async updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<DashboardMessage> {
    console.log('📝 [DB] Updating announcement with data:', announcement);
    
    const [updated] = await db
      .update(dashboardMessages)
      .set(announcement)
      .where(eq(dashboardMessages.id, id))
      .returning();
      
    console.log('📝 [DB] Updated announcement:', updated);
    
    if (!updated) {
      throw new Error(`Announcement with id ${id} not found`);
    }
    
    return updated;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db
      .delete(dashboardMessages)
      .where(eq(dashboardMessages.id, id));
  }
}

// Stockage en mémoire pour le développement
class AnnouncementMemoryStorage implements IAnnouncementStorage {
  private announcements = new Map<number, Announcement>();
  private idCounter = 1;
  private readonly MAX_ANNOUNCEMENTS = 5;

  // Référence vers les utilisateurs et groupes pour les relations
  private usersGetter: () => Promise<User[]>;
  private groupsGetter: () => Promise<Group[]>;

  constructor(usersGetter: () => Promise<User[]>, groupsGetter: () => Promise<Group[]>) {
    this.usersGetter = usersGetter;
    this.groupsGetter = groupsGetter;
    this.initializeTestData();
  }

  private initializeTestData() {
    // Créer quelques annonces de test avec la nouvelle structure DASHBOARD_MESSAGES
    const testAnnouncement: Announcement = {
      id: this.idCounter++,
      title: "Bienvenue dans le système d'informations",
      content: "Ce nouveau système remplace l'ancienne carte des commandes clients. Vous pouvez maintenant créer et gérer des annonces importantes.",
      type: 'warning',
      createdBy: 'admin',
      storeId: 1,
      createdAt: new Date(),
    };
    this.announcements.set(testAnnouncement.id, testAnnouncement);

    const testAnnouncement2: Announcement = {
      id: this.idCounter++,
      title: "Maintenance programmée",
      content: "Une maintenance système aura lieu dimanche prochain de 2h à 4h du matin.",
      type: 'info',
      createdBy: 'admin',
      storeId: null, // Annonce globale
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Hier
    };
    this.announcements.set(testAnnouncement2.id, testAnnouncement2);
  }

  async getAnnouncement(id: number): Promise<AnnouncementWithRelations | null> {
    const announcement = this.announcements.get(id);
    if (!announcement) {
      return null;
    }

    // Ajouter les relations
    const users = await this.usersGetter();
    const groups = await this.groupsGetter();

    const author = users.find(u => u.id === announcement.createdBy || u.username === announcement.createdBy);
    const group = announcement.storeId ? groups.find(g => g.id === announcement.storeId) : undefined;

    return {
      ...announcement,
      author: author || { id: announcement.createdBy, firstName: 'Utilisateur', lastName: 'Inconnu', username: announcement.createdBy } as User,
      group,
    };
  }

  async getAnnouncements(groupIds?: number[]): Promise<AnnouncementWithRelations[]> {
    const announcements = Array.from(this.announcements.values());
    
    let filteredAnnouncements = announcements;
    
    // Filtrer par groupIds si fourni (pour le filtrage admin par magasin)
    if (groupIds && groupIds.length > 0) {
      filteredAnnouncements = announcements.filter(announcement => 
        !announcement.storeId || groupIds.includes(announcement.storeId)
      );
    }

    // Récupérer les utilisateurs et groupes pour les relations
    const [users, groups] = await Promise.all([
      this.usersGetter(),
      this.groupsGetter()
    ]);

    const usersMap = new Map(users.map(u => [u.id, u]));
    const groupsMap = new Map(groups.map(g => [g.id, g]));

    // Ajouter les relations
    const announcementsWithRelations = filteredAnnouncements.map(announcement => {
      const author = usersMap.get(announcement.createdBy);
      const group = announcement.storeId ? groupsMap.get(announcement.storeId) : undefined;
      
      return {
        ...announcement,
        author: author!,
        group,
      };
    }).filter(a => a.author); // Filtrer celles sans auteur valide

    // Trier par type (error > warning > success > info) puis par date (plus récent d'abord)
    return announcementsWithRelations.sort((a, b) => {
      const typeOrder = { error: 4, warning: 3, success: 2, info: 1 };
      const typeDiff = (typeOrder[b.type as keyof typeof typeOrder] || 1) - 
                       (typeOrder[a.type as keyof typeof typeOrder] || 1);
      if (typeDiff !== 0) return typeDiff;
      return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });
  }

  async createAnnouncement(announcementData: InsertAnnouncement): Promise<Announcement> {
    // Vérifier la limite de 5 annonces maximum
    if (this.announcements.size >= this.MAX_ANNOUNCEMENTS) {
      // Supprimer l'annonce la plus ancienne (par ordre de création)
      const oldestAnnouncement = Array.from(this.announcements.values())
        .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())[0];
      
      if (oldestAnnouncement) {
        this.announcements.delete(oldestAnnouncement.id);
        console.log(`🗑️ Annonce supprimée automatiquement (limite de ${this.MAX_ANNOUNCEMENTS}): ${oldestAnnouncement.title}`);
      }
    }

    const id = this.idCounter++;
    const announcement: Announcement = {
      id,
      ...announcementData,
      type: announcementData.type || 'info',
      storeId: announcementData.storeId || null,
      createdAt: new Date(),
    };
    
    this.announcements.set(id, announcement);
    console.log(`✅ Nouvelle annonce créée: ${announcement.title} (${this.announcements.size}/${this.MAX_ANNOUNCEMENTS})`);
    
    return announcement;
  }

  async getAnnouncement(id: number): Promise<AnnouncementWithRelations | undefined> {
    const announcement = this.announcements.get(id);
    if (!announcement) {
      return undefined;
    }

    // Récupérer les utilisateurs et groupes pour les relations
    const [users, groups] = await Promise.all([
      this.usersGetter(),
      this.groupsGetter()
    ]);

    const usersMap = new Map(users.map(u => [u.id, u]));
    const groupsMap = new Map(groups.map(g => [g.id, g]));

    const author = usersMap.get(announcement.createdBy);
    const group = announcement.storeId ? groupsMap.get(announcement.storeId) : undefined;

    if (!author) {
      return undefined;
    }

    return {
      ...announcement,
      author,
      group,
    };
  }

  async updateAnnouncement(id: number, announcementData: Partial<InsertAnnouncement>): Promise<AnnouncementWithRelations> {
    const existingAnnouncement = this.announcements.get(id);
    if (!existingAnnouncement) {
      throw new Error(`Announcement with ID ${id} not found`);
    }

    const updatedAnnouncement: Announcement = {
      ...existingAnnouncement,
      ...announcementData,
      id, // Ensure ID doesn't change
      // Note: DASHBOARD_MESSAGES table n'a pas de champ updatedAt
    };

    this.announcements.set(id, updatedAnnouncement);
    console.log(`✏️ Annonce mise à jour: ${updatedAnnouncement.title} (ID: ${id})`);

    // Return the announcement with relations
    const announcementWithRelations = await this.getAnnouncement(id);
    if (!announcementWithRelations) {
      throw new Error(`Failed to get updated announcement with relations`);
    }

    return announcementWithRelations;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    const deleted = this.announcements.delete(id);
    
    if (deleted) {
      console.log(`🗑️ Annonce supprimée: ID ${id} (${this.announcements.size}/${this.MAX_ANNOUNCEMENTS} restantes)`);
    }
  }
}

// Instances globales pour les différents environnements
let memoryInstance: AnnouncementMemoryStorage | null = null;
let databaseInstance: AnnouncementDatabaseStorage | null = null;

export function getAnnouncementStorage(
  usersGetter?: () => Promise<User[]>,
  groupsGetter?: () => Promise<Group[]>
): IAnnouncementStorage {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    if (!databaseInstance) {
      databaseInstance = new AnnouncementDatabaseStorage();
      console.log('📢 Stockage PostgreSQL des annonces initialisé pour la production');
    }
    return databaseInstance;
  } else {
    if (!memoryInstance) {
      if (!usersGetter || !groupsGetter) {
        throw new Error("usersGetter and groupsGetter are required for memory storage initialization");
      }
      memoryInstance = new AnnouncementMemoryStorage(usersGetter, groupsGetter);
      console.log('📢 Stockage mémoire des annonces initialisé pour le développement');
    }
    return memoryInstance;
  }
}