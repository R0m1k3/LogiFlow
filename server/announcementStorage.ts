import { Announcement, InsertAnnouncement, AnnouncementWithRelations, User, Group } from "@shared/schema";

// Stockage en mémoire partagé pour les annonces (maximum 5)
class AnnouncementMemoryStorage {
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

  async deleteAnnouncement(id: number): Promise<boolean> {
    const existed = this.announcements.has(id);
    const deleted = this.announcements.delete(id);
    
    if (deleted) {
      console.log(`🗑️ Annonce supprimée: ID ${id} (${this.announcements.size}/${this.MAX_ANNOUNCEMENTS} restantes)`);
    }
    
    return deleted;
  }
}

// Instance globale partagée
let globalAnnouncementStorage: AnnouncementMemoryStorage | null = null;

export function getAnnouncementStorage(
  usersGetter: () => Promise<User[]>,
  groupsGetter: () => Promise<Group[]>
): AnnouncementMemoryStorage {
  if (!globalAnnouncementStorage) {
    globalAnnouncementStorage = new AnnouncementMemoryStorage(usersGetter, groupsGetter);
    console.log('📢 Stockage mémoire des annonces initialisé');
  }
  return globalAnnouncementStorage;
}