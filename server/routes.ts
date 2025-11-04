import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupLocalAuth, requireAuth } from "./localAuth";
import { requireModulePermission, requireAdmin, requirePermission } from "./permissions";
import { db, pool } from "./db";

console.log('🔍 Using development storage and authentication');

// Fonction de normalisation des dates pour gérer différents formats de NocoDB
function normalizeDateString(dateString: string | null | undefined): string | null {
  if (!dateString || typeof dateString !== 'string') return null;
  
  const trimmed = dateString.trim();
  if (!trimmed) return null;
  
  try {
    // Si déjà au format ISO (YYYY-MM-DD), le retourner tel quel
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    
    // Format slash ou tiret : DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, MM-DD-YYYY
    const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (slashMatch) {
      const [, first, second, year] = slashMatch;
      const firstNum = parseInt(first);
      const secondNum = parseInt(second);
      
      // Validation basique des valeurs
      if (firstNum > 31 || secondNum > 31 || firstNum === 0 || secondNum === 0) {
        console.warn(`⚠️ Date invalide (valeurs hors limites): ${trimmed}`);
        return null;
      }
      
      // Déterminer le format en fonction des valeurs
      let day: string, month: string;
      
      if (firstNum > 12) {
        // first > 12 → forcément DD/MM (format français/européen)
        day = first.padStart(2, '0');
        month = second.padStart(2, '0');
      } else if (secondNum > 12) {
        // second > 12 → forcément MM/DD (format américain)
        day = second.padStart(2, '0');
        month = first.padStart(2, '0');
      } else {
        // Ambiguïté (les deux < 12) → on assume format français DD/MM par défaut
        // Pour être plus sûr, on pourrait vérifier la configuration du groupe/locale
        day = first.padStart(2, '0');
        month = second.padStart(2, '0');
      }
      
      // Validation finale : mois entre 1-12, jour entre 1-31
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
        console.warn(`⚠️ Date invalide après parsing: ${trimmed} → month=${month}, day=${day}`);
        return null;
      }
      
      return `${year}-${month}-${day}`;
    }
    
    // Essayer de parser avec Date (format ISO complet avec heures)
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Si aucun format reconnu, retourner null (ne pas persister une date invalide)
    console.warn(`⚠️ Format de date non reconnu: ${trimmed}`);
    return null;
  } catch (error) {
    console.error('❌ Erreur normalisation date:', error);
    return null; // Retourner null en cas d'erreur pour éviter de persister des données invalides
  }
}

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
  insertWeatherDataSchema,
  insertWeatherSettingsSchema,
  insertWebhookBapConfigSchema,
  insertUtilitiesSchema,
  insertAvoirSchema,
  insertReconciliationCommentSchema,
  users, groups, userGroups, suppliers, orders, deliveries, publicities, publicityParticipations,
  customerOrders, nocodbConfig, dlcProducts, tasks, invoiceVerificationCache, dashboardMessages, webhookBapConfig,
  utilities,
  avoirs
} from "@shared/schema";
import { hasPermission } from "@shared/permissions";
import { z } from "zod";
import { eq, desc, or, isNull } from "drizzle-orm";
import { invoiceVerificationService } from "./invoiceVerification";
import { backupService } from "./backupService";
import { weatherService } from "./weatherService.js";
import fetch from "node-fetch";

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

  // Routes pour configuration webhook BAP
  app.get('/api/webhook-bap-config', isAuthenticated, async (req: any, res) => {
    try {
      // Vérifier que l'utilisateur est admin
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé - Admin uniquement' });
      }

      const config = await storage.getWebhookBapConfig();
      res.json(config || null);
      
    } catch (error: any) {
      console.error('❌ Erreur récupération config webhook BAP:', error);
      
      // Si la table n'existe pas, retourner une configuration par défaut
      if (error.code === '42P01') { // Relation does not exist
        console.log('⚠️ Table webhook_bap_config n\'existe pas, retour config par défaut');
        return res.json({
          id: 1,
          name: "Configuration BAP",
          webhookUrl: "https://workflow.ffnancy.fr/webhook/a3d03176-b72f-412d-8fb9-f920b9fbab4d",
          description: "Configuration par défaut (table non créée)",
          isActive: true,
          needsTableCreation: true
        });
      }
      
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  app.post('/api/webhook-bap-config', isAuthenticated, async (req: any, res) => {
    try {
      // Vérifier que l'utilisateur est admin
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé - Admin uniquement' });
      }

      // Valider les données avec Zod
      const validatedData = insertWebhookBapConfigSchema.parse(req.body);

      // Vérifier si une configuration existe déjà
      const existingConfig = await storage.getWebhookBapConfig();
      
      let config: any;
      if (existingConfig) {
        // Mettre à jour la configuration existante
        config = await storage.updateWebhookBapConfig(existingConfig.id, validatedData);
      } else {
        // Créer une nouvelle configuration
        config = await storage.createWebhookBapConfig(validatedData);
      }

      console.log('✅ Configuration webhook BAP sauvegardée:', { 
        id: config.id, 
        name: config.name,
        isActive: config.isActive 
      });
      
      res.json(config);
      
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde config webhook BAP:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  app.post('/api/webhook-bap-config/test', isAuthenticated, async (req: any, res) => {
    try {
      // Vérifier que l'utilisateur est admin
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé - Admin uniquement' });
      }

      const { webhookUrl } = req.body;
      if (!webhookUrl) {
        return res.status(400).json({ error: 'URL webhook requise' });
      }

      console.log('🔍 Test webhook BAP:', { url: webhookUrl });

      // Tester la connectivité avec le webhook
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes

      const testResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          message: 'Test de connectivité depuis LogiFlow'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('🌐 Réponse test webhook:', { status: testResponse.status, ok: testResponse.ok });

      if (!testResponse.ok) {
        throw new Error(`HTTP ${testResponse.status}: ${testResponse.statusText}`);
      }

      const result = await testResponse.text();
      
      res.json({
        success: true,
        status: testResponse.status,
        message: 'Webhook accessible',
        response: result.substring(0, 200) // Limiter la réponse
      });
      
    } catch (error: any) {
      console.error('❌ Erreur test webhook BAP:', error);
      
      let errorMessage = 'Échec du test de connectivité';
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout - Le webhook ne répond pas';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      res.status(500).json({ error: errorMessage, details: error.message });
    }
  });

  // Routes pour configuration utilities
  app.get('/api/utilities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'admin' && user.role !== 'directeur')) {
        return res.status(403).json({ error: 'Accès refusé - Admin ou Directeur uniquement' });
      }

      const config = await storage.getUtilities();
      res.json(config || null);
      
    } catch (error: any) {
      console.error('❌ Erreur récupération utilities:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  app.post('/api/utilities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'admin' && user.role !== 'directeur')) {
        return res.status(403).json({ error: 'Accès refusé - Admin ou Directeur uniquement' });
      }

      const validatedData = insertUtilitiesSchema.parse(req.body);

      const existingConfig = await storage.getUtilities();
      
      let config: any;
      if (existingConfig) {
        config = await storage.updateUtilities(existingConfig.id, validatedData);
      } else {
        config = await storage.createUtilities(validatedData);
      }

      console.log('✅ Configuration utilities sauvegardée:', { 
        id: config.id, 
        salesAnalysisUrl: config.salesAnalysisUrl
      });
      res.json(config);
      
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde utilities:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // Route pour récupérer l'échéancier des paiements fournisseurs
  app.get('/api/payment-schedule', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'admin' && user.role !== 'directeur')) {
        return res.status(403).json({ error: 'Accès refusé - Admin ou Directeur uniquement' });
      }

      // Validation du groupId avec Zod
      const groupIdSchema = z.coerce.number().int().positive();
      const validation = groupIdSchema.safeParse(req.query.groupId);
      
      if (!validation.success) {
        return res.status(400).json({ error: 'groupId invalide - doit être un entier positif' });
      }
      
      const groupId = validation.data;

      // Vérifier l'autorisation : directeur ne peut voir que ses groupes
      if (user.role === 'directeur') {
        const userGroupIds = await storage.getUserGroups(user.id);
        if (!userGroupIds.includes(groupId)) {
          return res.status(403).json({ error: 'Accès refusé - Vous ne pouvez accéder qu\'aux données de votre groupe' });
        }
      }

      // Récupérer le groupe
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.json({ schedules: [], message: 'Groupe non trouvé' });
      }

      console.log('📅 Récupération échéances depuis deliveries:', { groupId, groupName: group.name });

      // Récupérer toutes les livraisons du groupe
      const allDeliveries = await storage.getDeliveries();
      const groupDeliveries = allDeliveries.filter((d: any) => d.groupId === groupId && d.invoiceReference);

      // Séparer les livraisons avec et sans dueDate
      const deliveriesWithDueDate = groupDeliveries.filter((d: any) => d.dueDate);
      const deliveriesWithoutDueDate = groupDeliveries.filter((d: any) => !d.dueDate);

      console.log(`📅 Livraisons avec échéance: ${deliveriesWithDueDate.length}, sans échéance: ${deliveriesWithoutDueDate.length}`);

      // FALLBACK : Pour les livraisons sans dueDate, interroger NocoDB
      const { InvoiceVerificationService } = await import('./invoiceVerification.js');
      const verificationService = new InvoiceVerificationService();
      
      for (const delivery of deliveriesWithoutDueDate) {
        try {
          const result = await verificationService.verifyInvoice(
            delivery.invoiceReference!,
            delivery.groupId,
            false, // Ne pas forcer le refresh, utiliser cache si disponible
            delivery.reconciled || false
          );
          
          if (result.exists && result.dueDate) {
            // Normaliser la date avant de la stocker
            const normalizedDateString = normalizeDateString(result.dueDate);
            if (normalizedDateString) {
              // Convertir la string normalisée en objet Date pour Drizzle
              const normalizedDate = new Date(normalizedDateString);
              // Mettre à jour deliveries avec la date normalisée (caching)
              await storage.updateDelivery(delivery.id, { dueDate: normalizedDate });
              delivery.dueDate = normalizedDate;
              console.log(`📅 Fallback: échéance récupérée et normalisée pour livraison #${delivery.id}`);
            }
          }
        } catch (error) {
          console.error(`❌ Fallback échéance échoué pour livraison #${delivery.id}:`, error);
        }
      }

      // Combiner toutes les livraisons qui ont maintenant une dueDate
      const allDeliveriesWithDueDate = [...deliveriesWithDueDate, ...deliveriesWithoutDueDate.filter((d: any) => d.dueDate)];

      // Récupérer tous les fournisseurs pour le mapping du mode de paiement
      const allSuppliers = await storage.getSuppliers();
      const supplierMap = new Map(allSuppliers.map((s: any) => [s.id, s]));

      // Formatter les échéances
      const schedules = allDeliveriesWithDueDate.map((delivery: any) => {
        const supplier = supplierMap.get(delivery.supplierId);
        
        return {
          id: delivery.id,
          invoiceReference: delivery.invoiceReference,
          dueDate: delivery.dueDate,
          amount: delivery.invoiceAmount ? parseFloat(delivery.invoiceAmount) : 0,
          supplierName: supplier?.name || 'Fournisseur inconnu',
          paymentMethod: supplier?.paymentMethod || null,
          groupId: group.id,
          groupName: group.name
        };
      });

      console.log(`📅 Total échéances retournées: ${schedules.length}`);
      res.json({ schedules });
      
    } catch (error: any) {
      console.error('❌ Erreur récupération échéances:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // Route BAP pour envoi webhook n8n
  app.post('/api/bap/send-webhook', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🔍 BAP: Requête reçue', { 
        hasUser: !!req.user, 
        userType: typeof req.user,
        hasClaims: !!(req.user?.claims),
        hasId: !!(req.user?.id),
        bodyKeys: Object.keys(req.body || {})
      });

      // Vérifier que l'utilisateur est admin
      const userId = req.user?.claims?.sub || req.user?.id;
      console.log('🔍 BAP: User ID extracted:', userId);
      
      if (!userId) {
        console.error('❌ BAP: No user ID found');
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      const user = await storage.getUser(userId);
      console.log('🔍 BAP: User found:', { id: user?.id, role: user?.role });
      
      if (!user || user.role !== 'admin') {
        console.error('❌ BAP: Access denied', { user: user?.role });
        return res.status(403).json({ error: 'Accès refusé - Admin uniquement' });
      }

      // Récupérer les données JSON du body
      const { pdfBase64, fileName, recipient } = req.body;

      // Valider les données
      if (!pdfBase64 || !fileName || !recipient) {
        return res.status(400).json({ error: 'Données manquantes: pdfBase64, fileName ou recipient' });
      }

      if (!['Prissela', 'Célia'].includes(recipient)) {
        return res.status(400).json({ error: 'Destinataire invalide' });
      }

      // Vérifier l'extension PDF
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'Le fichier doit être un PDF' });
      }

      // Décoder le base64 en buffer
      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(pdfBase64, 'base64');
      } catch (error) {
        return res.status(400).json({ error: 'Format base64 invalide' });
      }

      console.log('📤 BAP: Envoi webhook n8n', { 
        recipient, 
        fileName, 
        fileSize: fileBuffer.length,
        userId: user.id
      });

      // Préparer les données JSON pour le webhook n8n (sans form-data)
      const webhookPayload = {
        recipient: recipient,
        fileName: fileName,
        fileSize: fileBuffer.length,
        pdfBase64: pdfBase64, // On renvoie le base64 directement
        contentType: 'application/pdf'
      };

      console.log('✅ BAP: Payload JSON préparé', { 
        recipient, 
        fileName, 
        fileSize: fileBuffer.length 
      });

      // Récupérer l'URL du webhook depuis la configuration
      const webhookConfig = await storage.getWebhookBapConfig();
      if (!webhookConfig || !webhookConfig.isActive) {
        console.error('❌ BAP: Configuration webhook non trouvée ou inactive');
        return res.status(500).json({ error: 'Configuration webhook BAP non disponible' });
      }

      const webhookUrl = webhookConfig.webhookUrl;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes

      console.log('🌐 BAP: Envoi vers webhook n8n (POST avec body JSON)...');
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      console.log('🌐 BAP: Réponse webhook reçue', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ BAP: Erreur webhook', { status: response.status, errorText });
        throw new Error(`Erreur webhook: ${response.status} ${response.statusText}`);
      }

      const result = await response.text();
      
      console.log('✅ BAP: Webhook n8n réussi', { recipient, result: result.substring(0, 100) });
      
      res.json({
        success: true,
        message: 'Fichier envoyé avec succès',
        webhookResponse: result
      });

    } catch (error: any) {
      console.error('❌ BAP: Erreur complète:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500)
      });
      
      let errorMessage = 'Erreur lors de l\'envoi du fichier';
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout - Le traitement a pris trop de temps';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      res.status(500).json({ 
        error: errorMessage,
        details: error.message 
      });
    }
  });

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
        const userGroups = (user as any).userGroups?.map((ug: any) => ug.group).filter(Boolean) || [];
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
      const dlcFilter = req.query.dlc === 'true';
      const suppliers = await storage.getSuppliers();
      
      // Filter suppliers for DLC enabled only if requested
      if (dlcFilter) {
        const dlcSuppliers = suppliers.filter(supplier => supplier.hasDlc === true);
        res.json(dlcSuppliers);
      } else {
        res.json(suppliers);
      }
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
          console.log('🔍 Admin orders filtering by store:', { storeId, groupIds, role: user.role });
        } else {
          console.log('🔍 Admin orders - showing all stores', { role: user.role });
        }
        
        // Only filter by date if both startDate and endDate are provided
        if (startDate && endDate) {
          console.log('Fetching orders by date range:', startDate, 'to', endDate);
          orders = await storage.getOrdersByDateRange(startDate as string, endDate as string, groupIds);
        } else {
          console.log('Fetching all orders');
          orders = await storage.getOrders(groupIds);
        }
      } else {
        // For manager and employee roles, filter by their assigned groups
        const userGroupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
        let groupIds: number[] | undefined;
        
        if (storeId) {
          // If a specific store is requested, verify user has access to it
          const requestedStoreId = parseInt(storeId as string);
          if (userGroupIds.includes(requestedStoreId)) {
            groupIds = [requestedStoreId];
            console.log('🔍 Non-admin orders - filtering by accessible store:', { 
              userId: user.id, 
              role: user.role, 
              requestedStoreId 
            });
          } else {
            // User doesn't have access to this store, return empty array
            console.log('🚫 Non-admin orders - user has no access to requested store:', {
              userId: user.id,
              role: user.role,
              requestedStoreId,
              userGroups: userGroupIds
            });
            return res.json([]);
          }
        } else {
          // For directeur role, automatically use their assigned store (but with full permissions within that store)
          if (user.role === 'directeur') {
            if (userGroupIds.length > 0) {
              groupIds = [userGroupIds[0]]; // Use first assigned store automatically
              console.log('🔍 Directeur orders - using assigned store automatically:', {
                userId: user.id,
                role: user.role,
                assignedStore: userGroupIds[0],
                allUserGroups: userGroupIds
              });
            } else {
              console.log('🚫 Directeur has no assigned stores:', {
                userId: user.id,
                role: user.role
              });
              return res.json([]);
            }
          }
          // For manager role, automatically use their assigned store
          else if (user.role === 'manager') {
            if (userGroupIds.length > 0) {
              groupIds = [userGroupIds[0]]; // Use first assigned store automatically
              console.log('🔍 Manager orders - using assigned store automatically:', {
                userId: user.id,
                role: user.role,
                assignedStore: userGroupIds[0],
                allUserGroups: userGroupIds
              });
            } else {
              console.log('🚫 Manager has no assigned stores:', {
                userId: user.id,
                role: user.role
              });
              return res.json([]);
            }
          } else {
            // For employee role, require explicit store selection
            console.log('🔍 Employee orders - no store selection, returning empty:', {
              userId: user.id,
              role: user.role,
              userGroups: userGroupIds
            });
            return res.json([]);
          }
        }
        
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
          console.log('🔍 Admin deliveries filtering by store:', { storeId, groupIds, role: user.role });
        } else {
          console.log('🔍 Admin deliveries - showing all stores', { role: user.role });
        }
        
        // Only filter by date if both startDate and endDate are provided
        if (startDate && endDate) {
          console.log('Fetching deliveries by date range:', startDate, 'to', endDate);
          deliveries = await storage.getDeliveriesByDateRange(startDate as string, endDate as string, groupIds);
        } else {
          console.log('Fetching all deliveries');
          deliveries = await storage.getDeliveries(groupIds);
        }
      } else {
        // For manager and employee roles, filter by their assigned groups
        const userGroupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
        let groupIds: number[] | undefined;
        
        if (storeId) {
          // If a specific store is requested, verify user has access to it
          const requestedStoreId = parseInt(storeId as string);
          if (userGroupIds.includes(requestedStoreId)) {
            groupIds = [requestedStoreId];
            console.log('🔍 Non-admin deliveries - filtering by accessible store:', { 
              userId: user.id, 
              role: user.role, 
              requestedStoreId 
            });
          } else {
            // User doesn't have access to this store, return empty array
            console.log('🚫 Non-admin deliveries - user has no access to requested store:', {
              userId: user.id,
              role: user.role,
              requestedStoreId,
              userGroups: userGroupIds
            });
            return res.json([]);
          }
        } else {
          // For directeur role, automatically use their assigned store (but with full permissions within that store)
          if (user.role === 'directeur') {
            if (userGroupIds.length > 0) {
              groupIds = [userGroupIds[0]]; // Use first assigned store automatically
              console.log('🔍 Directeur deliveries - using assigned store automatically:', {
                userId: user.id,
                role: user.role,
                assignedStore: userGroupIds[0],
                allUserGroups: userGroupIds
              });
            } else {
              console.log('🚫 Directeur has no assigned stores:', {
                userId: user.id,
                role: user.role
              });
              return res.json([]);
            }
          }
          // For manager role, automatically use their assigned store
          else if (user.role === 'manager') {
            if (userGroupIds.length > 0) {
              groupIds = [userGroupIds[0]]; // Use first assigned store automatically
              console.log('🔍 Manager deliveries - using assigned store automatically:', {
                userId: user.id,
                role: user.role,
                assignedStore: userGroupIds[0],
                allUserGroups: userGroupIds
              });
            } else {
              console.log('🚫 Manager has no assigned stores:', {
                userId: user.id,
                role: user.role
              });
              return res.json([]);
            }
          } else {
            // For employee role, require explicit store selection
            console.log('🔍 Employee deliveries - no store selection, returning empty:', {
              userId: user.id,
              role: user.role,
              userGroups: userGroupIds
            });
            return res.json([]);
          }
        }
        
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
      
      // Convert decimal amounts to strings or null (schema expects string for decimal fields)
      if (transformedData.blAmount !== undefined) {
        transformedData.blAmount = (transformedData.blAmount === null || transformedData.blAmount === '') 
          ? null 
          : transformedData.blAmount.toString();
      }
      if (transformedData.invoiceAmount !== undefined) {
        transformedData.invoiceAmount = (transformedData.invoiceAmount === null || transformedData.invoiceAmount === '') 
          ? null 
          : transformedData.invoiceAmount.toString();
      }
      
      // Convert text fields - allow null for clearing
      if (transformedData.invoiceReference !== undefined) {
        transformedData.invoiceReference = (transformedData.invoiceReference === '') 
          ? null 
          : transformedData.invoiceReference;
      }
      if (transformedData.blNumber !== undefined) {
        transformedData.blNumber = (transformedData.blNumber === '') 
          ? null 
          : transformedData.blNumber;
      }
      
      // Convert timestamp fields to Date objects or null (schema expects Date for timestamp fields)
      if (transformedData.validatedAt !== undefined) {
        transformedData.validatedAt = (transformedData.validatedAt === null || transformedData.validatedAt === '') 
          ? null 
          : new Date(transformedData.validatedAt);
      }
      if (transformedData.dueDate !== undefined) {
        transformedData.dueDate = (transformedData.dueDate === null || transformedData.dueDate === '') 
          ? null 
          : new Date(transformedData.dueDate);
      }
      
      const data = insertDeliverySchema.partial().parse(transformedData);
      
      // CRITICAL FIX: Si une commande est liée lors de la modification, vérifier qu'elle appartient au même magasin
      if (data.orderId !== undefined) {
        if (data.orderId !== null) {
          const linkedOrder = await storage.getOrder(data.orderId);
          if (!linkedOrder) {
            return res.status(400).json({ message: "La commande liée n'existe pas" });
          }
          if (linkedOrder.groupId !== delivery.groupId) {
            return res.status(400).json({ 
              message: `Impossible de lier une livraison du magasin ${delivery.groupId} avec une commande du magasin ${linkedOrder.groupId}` 
            });
          }
          console.log(`✅ Validation OK: Livraison #${id} et commande #${data.orderId} appartiennent au même magasin ${delivery.groupId}`);
        }
      }
      
      // GESTION ÉCHÉANCE : Si la référence facture change, mettre à jour la date d'échéance
      if (data.invoiceReference !== undefined && data.invoiceReference !== delivery.invoiceReference) {
        if (data.invoiceReference && data.invoiceReference.trim()) {
          // Nouvelle référence facture : reverifier dans NocoDB pour récupérer l'échéance
          try {
            const { InvoiceVerificationService } = await import('./invoiceVerification.js');
            const verificationService = new InvoiceVerificationService();
            const result = await verificationService.verifyInvoice(
              data.invoiceReference,
              delivery.groupId,
              true, // forceRefresh
              delivery.reconciled || false
            );
            
            if (result.exists && result.dueDate) {
              // Normaliser la date avant de la stocker
              const normalizedDateString = normalizeDateString(result.dueDate);
              if (normalizedDateString) {
                // Convertir la string normalisée en objet Date pour Drizzle
                data.dueDate = new Date(normalizedDateString);
                console.log(`📅 Date d'échéance récupérée et normalisée: ${normalizedDateString} (original: ${result.dueDate})`);
              } else {
                data.dueDate = null;
                console.log(`📅 Date d'échéance invalide, ignorée`);
              }
            } else {
              data.dueDate = null;
              console.log(`📅 Aucune date d'échéance trouvée dans NocoDB`);
            }
          } catch (error) {
            console.error('❌ Erreur récupération échéance:', error);
            // Ne pas bloquer la mise à jour, juste ne pas avoir d'échéance
            data.dueDate = null;
          }
        } else {
          // Référence facture vidée : vider aussi l'échéance
          data.dueDate = null;
          console.log(`📅 Référence facture vidée, échéance également vidée`);
        }
      }
      
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

      // CRITICAL FIX: Si une commande est liée, vérifier qu'elle appartient au même magasin
      if (data.orderId) {
        const linkedOrder = await storage.getOrder(data.orderId);
        if (!linkedOrder) {
          return res.status(400).json({ message: "La commande liée n'existe pas" });
        }
        if (linkedOrder.groupId !== data.groupId) {
          return res.status(400).json({ 
            message: `Impossible de lier une livraison du magasin ${data.groupId} avec une commande du magasin ${linkedOrder.groupId}` 
          });
        }
        console.log(`✅ Validation OK: Livraison et commande #${data.orderId} appartiennent au même magasin ${data.groupId}`);
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

  // Route obsolète supprimée - utiliser le système de commentaires de rapprochement à la place
  // Les commentaires sont désormais gérés via /api/deliveries/:id/reconciliation-comments

  // Routes pour les commentaires de rapprochement
  // GET - Récupérer les commentaires d'une livraison
  app.get('/api/deliveries/:id/reconciliation-comments', isAuthenticated, async (req: any, res) => {
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

      // Check group access
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(delivery.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const comments = await storage.getReconciliationComments(deliveryId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching reconciliation comments:", error);
      res.status(500).json({ message: "Failed to fetch reconciliation comments" });
    }
  });

  // POST - Créer un nouveau commentaire
  app.post('/api/deliveries/:id/reconciliation-comments', isAuthenticated, async (req: any, res) => {
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
      if (!hasPermission(user.role, 'deliveries', 'edit')) {
        return res.status(403).json({ message: "Insufficient permissions to create comments" });
      }

      // Check group access
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(delivery.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const commentData = insertReconciliationCommentSchema.parse({
        ...req.body,
        deliveryId,
        authorId: user.id,
        groupId: delivery.groupId,
      });

      const comment = await storage.createReconciliationComment(commentData);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating reconciliation comment:", error);
      res.status(500).json({ message: "Failed to create reconciliation comment" });
    }
  });

  // PUT - Modifier un commentaire
  app.put('/api/reconciliation-comments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const commentId = parseInt(req.params.id);
      const comment = await storage.getReconciliationCommentById(commentId);
      
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Check permissions - only author or admin can edit
      if (user.role !== 'admin' && comment.authorId !== user.id) {
        return res.status(403).json({ message: "Only comment author or admin can edit comments" });
      }

      // Check group access
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(comment.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const updateData = insertReconciliationCommentSchema.partial().parse(req.body);
      const updatedComment = await storage.updateReconciliationComment(commentId, updateData);
      
      res.json(updatedComment);
    } catch (error) {
      console.error("Error updating reconciliation comment:", error);
      res.status(500).json({ message: "Failed to update reconciliation comment" });
    }
  });

  // DELETE - Supprimer un commentaire
  app.delete('/api/reconciliation-comments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const commentId = parseInt(req.params.id);
      const comment = await storage.getReconciliationCommentById(commentId);
      
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Check permissions - only author or admin can delete
      if (user.role !== 'admin' && comment.authorId !== user.id) {
        return res.status(403).json({ message: "Only comment author or admin can delete comments" });
      }

      // Check group access
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(comment.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      await storage.deleteReconciliationComment(commentId);
      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting reconciliation comment:", error);
      res.status(500).json({ message: "Failed to delete reconciliation comment" });
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

      // Only admin have access to all deliveries, others must be in the same group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(delivery.groupId)) {
          console.log('🚫 Access denied - User groups check:', {
            userId: user.id,
            userRole: user.role,
            userGroupIds,
            deliveryGroupId: delivery.groupId,
            deliverySupplier: delivery.supplier?.name
          });
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
          forceRefresh || false,
          delivery.reconciled || false
        );
      } else if (blNumber && blNumber.trim()) {
        // Vérifier par numéro BL
        result = await invoiceVerificationService.verifyInvoiceByBL(
          blNumber,
          delivery.supplier.name,
          delivery.groupId,
          forceRefresh || false,
          delivery.reconciled || false
        );
      } else {
        result = {
          exists: false,
          matchType: 'none',
          errorMessage: 'Aucune référence de facture ou numéro BL fourni'
        };
      }

      console.log('✅ Résultat vérification:', result);
      
      // CRITICAL FIX: Sauvegarder les données dans la table deliveries après vérification réussie
      if (result.exists && (result.invoiceAmount !== undefined || result.invoiceAmountTTC !== undefined || result.dueDate !== undefined || result.invoiceReference !== undefined)) {
        try {
          const updateData: any = {};
          
          // Ajouter la référence facture si trouvée
          if (result.invoiceReference) {
            updateData.invoiceReference = result.invoiceReference;
          }
          
          // Ajouter le montant facture HT si trouvé
          if (result.invoiceAmount !== undefined && result.invoiceAmount !== null) {
            updateData.invoiceAmount = result.invoiceAmount.toString();
          }
          
          // Ajouter le montant facture TTC si trouvé
          if (result.invoiceAmountTTC !== undefined && result.invoiceAmountTTC !== null) {
            updateData.invoiceAmountTTC = result.invoiceAmountTTC.toString();
          }
          
          // Ajouter l'échéance si trouvée
          if (result.dueDate) {
            const normalizedDateString = normalizeDateString(result.dueDate);
            if (normalizedDateString) {
              updateData.dueDate = new Date(normalizedDateString);
              console.log(`✅ Sauvegarde échéance dans deliveries: ${normalizedDateString}`);
            }
          }
          
          // Mettre à jour la livraison si on a des données
          if (Object.keys(updateData).length > 0) {
            await storage.updateDelivery(deliveryId, updateData);
            console.log(`✅ Livraison #${deliveryId} mise à jour avec:`, updateData);
          }
        } catch (error) {
          console.error('❌ Erreur sauvegarde données vérification:', error);
          // Ne pas bloquer la réponse, juste logger l'erreur
        }
      }
      
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
      
      // Le numéro de BL est maintenant obligatoire pour valider une livraison
      if (!blNumber || !blNumber.trim()) {
        return res.status(400).json({ message: "Le numéro de bon de livraison est obligatoire pour valider une livraison" });
      }
      
      let blData: any = { blNumber: blNumber.trim() };
      if (blAmount !== undefined && blAmount !== null && blAmount !== '') {
        blData.blAmount = blAmount;
      }
      
      await storage.validateDelivery(id, blData);
      
      // MISE À JOUR DU CACHE : Marquer le cache comme permanent pour cette livraison validée
      try {
        if (delivery.invoiceReference && delivery.invoiceReference.trim()) {
          console.log('🔄 [CACHE] Mise à jour cache permanent après validation livraison');
          await invoiceVerificationService.updateCacheAsReconciled(delivery.invoiceReference, delivery.groupId);
        }
        if (delivery.blNumber && delivery.blNumber.trim()) {
          console.log('🔄 [CACHE] Mise à jour cache permanent BL après validation livraison');
          await invoiceVerificationService.updateCacheAsReconciled(delivery.blNumber, delivery.groupId);
        }
      } catch (error) {
        console.error('❌ Erreur mise à jour cache après validation:', error);
      }
      
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

  // Marquer le contrôle d'une livraison comme effectué
  app.put('/api/deliveries/:id/control', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }

      // Vérifier que la livraison existe
      const delivery = await storage.getDeliveryById(id);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      // Vérifier les permissions
      if (!hasPermission(user.role, 'deliveries', 'edit')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Mettre à jour le contrôle
      await storage.markDeliveryControlValidated(id, user.id);
      
      res.json({ message: "Delivery control validated successfully" });
    } catch (error) {
      console.error("Error validating delivery control:", error);
      res.status(500).json({ message: "Failed to validate delivery control" });
    }
  });

  // Route pour diagnostiquer le cache des livraisons
  app.get('/api/cache/diagnosis', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Vérifier que c'est un admin
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Seuls les admins peuvent exécuter cette opération" });
      }

      // Récupérer des statistiques sur le cache
      const deliveries = await storage.getDeliveries();
      const reconciledCount = deliveries.filter(d => d.reconciled).length;
      const totalCount = deliveries.length;
      
      // Vérifier quelques caches
      const sampleCaches = [];
      const reconciledDeliveries = deliveries.filter(d => d.reconciled).slice(0, 5); // Prendre 5 exemples
      
      for (const delivery of reconciledDeliveries) {
        if (delivery.invoiceReference) {
          const cacheKey = `${delivery.invoiceReference.toLowerCase()}_${delivery.groupId}`;
          const cached = await storage.getInvoiceVerificationCache(cacheKey);
          sampleCaches.push({
            deliveryId: delivery.id,
            invoiceRef: delivery.invoiceReference,
            groupId: delivery.groupId,
            reconciled: delivery.reconciled,
            cacheExists: !!cached,
            cacheReconciled: cached?.isReconciled || false,
            cacheExpires: cached?.expiresAt
          });
        }
      }
      
      res.json({
        statistics: {
          totalDeliveries: totalCount,
          reconciledDeliveries: reconciledCount,
          percentageReconciled: Math.round((reconciledCount / totalCount) * 100)
        },
        sampleCaches,
        message: "Diagnostic du cache terminé"
      });
    } catch (error) {
      console.error("Erreur diagnostic cache:", error);
      res.status(500).json({ 
        message: "Erreur lors du diagnostic",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Route pour mettre à jour les caches existants des livraisons validées
  app.post('/api/cache/update-reconciled', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Vérifier que c'est un admin
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Seuls les admins peuvent exécuter cette opération" });
      }

      console.log('🔧 [ADMIN] Exécution mise à jour des caches permanents...');
      await invoiceVerificationService.updateExistingReconciledCaches();
      
      res.json({ 
        message: "Mise à jour des caches permanents terminée avec succès",
        success: true 
      });
    } catch (error) {
      console.error("Erreur mise à jour caches:", error);
      res.status(500).json({ 
        message: "Erreur lors de la mise à jour des caches",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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

  // Route pour marquer un produit DLC comme traité temporairement (expire bientôt) - accessible à tous
  app.put('/api/dlc-products/:id/mark-processed', isAuthenticated, async (req: any, res) => {
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

      console.log('🔍 DLC Product mark as processed attempt:', { 
        userId: user.id,
        userRole: user.role, 
        dlcProductId: id,
        dlcGroupId: dlcProduct.groupId
      });

      const processedProduct = await storage.markDlcProductAsProcessed(id, user.id);
      console.log('✅ DLC Product marked as processed by:', user.role, user.id);
      
      res.json(processedProduct);
    } catch (error) {
      console.error("Error marking DLC product as processed:", error);
      res.status(500).json({ message: "Failed to mark DLC product as processed" });
    }
  });

  // Route pour annuler le traitement temporaire d'un produit DLC - réservé aux admins, directeurs et managers
  app.put('/api/dlc-products/:id/unmark-processed', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has permission to unmark processed (admin, directeur, manager)
      if (!['admin', 'directeur', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions to unmark DLC product as processed" });
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

      console.log('🔍 DLC Product unmark processed attempt:', { 
        userId: user.id,
        userRole: user.role, 
        dlcProductId: id,
        dlcGroupId: dlcProduct.groupId
      });

      const unprocessedProduct = await storage.unmarkDlcProductAsProcessed(id);
      console.log('✅ DLC Product unmarked as processed by:', user.role, user.id);
      
      res.json(unprocessedProduct);
    } catch (error) {
      console.error("Error unmarking DLC product as processed:", error);
      res.status(500).json({ message: "Failed to unmark DLC product as processed" });
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
        console.log('🔍 Admin tasks filtering:', { 
          storeId, 
          groupIds,
          message: storeId ? `Filtering by store ${storeId}` : 'Showing all stores' 
        });
      } else {
        // For directeur and other non-admin users: always restrict to their assigned groups
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        
        if (storeId) {
          // If a specific store is requested, verify user has access to it
          const requestedStoreId = parseInt(storeId as string);
          if (userGroupIds.includes(requestedStoreId)) {
            groupIds = [requestedStoreId];
            console.log('🔍 Non-admin user requesting specific accessible store:', { 
              userId: user.id,
              role: user.role,
              requestedStoreId,
              hasAccess: true
            });
          } else {
            // User doesn't have access to this store, return empty array
            console.log('🚫 Non-admin user requesting inaccessible store:', {
              userId: user.id,
              role: user.role,
              requestedStoreId,
              userGroups: userGroupIds,
              hasAccess: false
            });
            return res.json([]);
          }
        } else {
          // IMPORTANT FIX: For directeur/manager roles, when no specific store is selected,
          // we should NOT show data from all their groups. This was causing the issue
          // where after page refresh, data from multiple groups was displayed.
          // Return empty result to force explicit store selection for non-admin users.
          console.log('🔍 Non-admin user with no store selection - returning empty result:', {
            userId: user.id,
            role: user.role,
            userGroups: userGroupIds,
            message: 'Forcing explicit store selection'
          });
          return res.json([]);
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
      
      const tasks = await storage.getTasks(groupIds, user.role);
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

      // Check permissions for creating tasks
      if (!hasPermission(user.role, 'tasks', 'create')) {
        return res.status(403).json({ message: "Permission denied: cannot create tasks" });
      }

      const data = {
        ...req.body,
        createdBy: user.id,
      };

      console.log('📝 POST /api/tasks - Received data:', {
        originalBody: req.body,
        processedData: data,
        dueDate: data.dueDate,
        dueDateType: typeof data.dueDate,
        dueDateValue: data.dueDate
      });

      // Assign a default groupId if not provided
      if (!data.groupId) {
        if (user.role === 'admin') {
          data.groupId = 1; // Default for admin
        } else {
          const userGroupIds = user.userGroups?.map(ug => ug.groupId) || [];
          data.groupId = userGroupIds.length > 0 ? userGroupIds[0] : 1;
        }
        console.log('📝 POST /api/tasks - Assigned default groupId:', data.groupId);
      }

      // Check if user has access to the group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map(ug => ug.groupId) || [];
        console.log('📝 POST /api/tasks - User group access check:', {
          userGroupIds,
          requestedGroupId: data.groupId,
          hasUserGroups: !!user.userGroups
        });
        if (userGroupIds.length > 0 && !userGroupIds.includes(data.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const task = await storage.createTask(data);
      console.log('✅ Task created:', {
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
        dueDateType: typeof task.dueDate
      });
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

      console.log('🔄 PUT /api/tasks/:id - Received data:', {
        taskId: id,
        originalTask: {
          id: task.id,
          title: task.title,
          dueDate: task.dueDate,
          dueDateType: typeof task.dueDate
        },
        updateBody: req.body,
        newDueDate: req.body.dueDate,
        newDueDateType: typeof req.body.dueDate
      });

      // Check permissions
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(task.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Nettoyer les données reçues pour éviter les problèmes de types
      const cleanData: any = {};
      
      // Ne pas utiliser de conditions qui ignorent les valeurs falsy légitimes
      if (req.body.title !== undefined) cleanData.title = req.body.title;
      if (req.body.description !== undefined) cleanData.description = req.body.description;
      if (req.body.priority !== undefined) cleanData.priority = req.body.priority;
      if (req.body.status !== undefined) cleanData.status = req.body.status;
      if (req.body.assignedTo !== undefined) cleanData.assignedTo = req.body.assignedTo;
      if (req.body.startDate !== undefined) {
        cleanData.startDate = req.body.startDate === '' ? null : req.body.startDate;
      }
      if (req.body.dueDate !== undefined) {
        cleanData.dueDate = req.body.dueDate === '' ? null : req.body.dueDate;
      }

      console.log('🧹 Cleaned data for update:', cleanData);

      const updatedTask = await storage.updateTask(id, cleanData);
      console.log('✅ Task updated:', {
        id: updatedTask.id,
        title: updatedTask.title,
        dueDate: updatedTask.dueDate,
        dueDateType: typeof updatedTask.dueDate
      });
      res.json(updatedTask);
    } catch (error) {
      const taskId = parseInt(req.params.id);
      console.error("❌ Error updating task in route:", {
        taskId: taskId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        reqBody: req.body,
        cleanData: req.body ? {
          title: req.body.title,
          description: req.body.description,
          priority: req.body.priority,
          status: req.body.status,
          assignedTo: req.body.assignedTo,
          startDate: req.body.startDate,
          dueDate: req.body.dueDate,
        } : null
      });
      res.status(500).json({ 
        message: "Failed to update task",
        details: error instanceof Error ? error.message : String(error)
      });
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

  // Client call tracking routes
  app.get('/api/customer-orders/pending-calls', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let groupIds: number[] | undefined;

      // Only admin, directeur, and manager can view pending calls
      if (user.role === 'employee') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      if (user.role === 'admin') {
        // Admin can optionally filter by store
        const { storeId } = req.query;
        if (storeId) {
          groupIds = [parseInt(storeId as string)];
        }
      } else {
        // For directeur and manager, filter by their assigned groups
        const userGroupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
        groupIds = userGroupIds;
      }

      const pendingCalls = await storage.getPendingClientCalls(groupIds);
      
      console.log(`📞 Pending client calls fetched: ${pendingCalls.length} calls for user ${user.role}`);
      res.json(pendingCalls);
    } catch (error) {
      console.error("Error fetching pending client calls:", error);
      res.status(500).json({ message: "Failed to fetch pending client calls" });
    }
  });

  app.patch('/api/customer-orders/:id/mark-called', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);

      // Only admin, directeur, and manager can mark calls
      if (user.role === 'employee') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Check if user has access to this customer order
      const customerOrder = await storage.getCustomerOrder(id);
      if (!customerOrder) {
        return res.status(404).json({ message: "Customer order not found" });
      }

      if (user.role !== 'admin') {
        const userGroupIds = (user as any).userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(customerOrder.groupId)) {
          return res.status(403).json({ message: "Access denied to this customer order" });
        }
      }

      const updatedOrder = await storage.markClientCalled(id, user.id);
      
      console.log(`📞 Client marked as called: order ${id} by user ${user.id} (${user.role})`);
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error marking client as called:", error);
      res.status(500).json({ message: "Failed to mark client as called" });
    }
  });

  // Avoir routes
  app.get('/api/avoirs', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { storeId } = req.query;
      let groupIds: number[] | undefined;
      
      if (user.role === 'admin' || user.role === 'directeur') {
        groupIds = storeId ? [parseInt(storeId as string)] : undefined;
      } else {
        // Managers can only see their group's avoirs
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (storeId && userGroupIds.includes(parseInt(storeId as string))) {
          groupIds = [parseInt(storeId as string)];
        } else if (!storeId) {
          groupIds = userGroupIds;
        } else {
          return res.json([]);
        }
      }

      console.log('🔍 Avoirs API called with:', { groupIds, userRole: user.role });
      const avoirs = await storage.getAvoirs(groupIds);
      console.log('📋 Avoirs returned:', avoirs.length, 'items');
      res.json(avoirs);
    } catch (error) {
      console.error("Error fetching avoirs:", error);
      res.status(500).json({ message: "Failed to fetch avoirs" });
    }
  });

  app.get('/api/avoirs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const avoir = await storage.getAvoir(id);
      
      if (!avoir) {
        return res.status(404).json({ message: "Avoir not found" });
      }

      // Check if user has access to this avoir's group
      if (user.role !== 'admin' && user.role !== 'directeur') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(avoir.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(avoir);
    } catch (error) {
      console.error("Error fetching avoir:", error);
      res.status(500).json({ message: "Failed to fetch avoir" });
    }
  });

  app.post('/api/avoirs', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // DEBUG: Log des données reçues
      console.log('🔍 [POST AVOIR] Données reçues:', JSON.stringify(req.body, null, 2));
      console.log('🔍 [POST AVOIR] User:', { id: user.id, role: user.role });

      // Validate data with Zod schema
      const validatedData = insertAvoirSchema.parse({
        ...req.body,
        createdBy: user.id,
      });

      console.log('✅ [POST AVOIR] Données validées:', JSON.stringify(validatedData, null, 2));

      // Check if user has access to the specified group
      if (user.role !== 'admin' && user.role !== 'directeur') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(validatedData.groupId)) {
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const avoir = await storage.createAvoir(validatedData);
      console.log('✅ Avoir created:', avoir.id, 'by user:', user.id);
      
      // Send webhook after avoir creation
      try {
        const group = await storage.getGroup(avoir.groupId);
        if (group && group.webhookUrl) {
          const webhookData = {
            type: "Avoir",
            avoirId: avoir.id,
            invoiceReference: avoir.invoiceReference,
            amount: avoir.amount,
            supplierName: "Unknown", // Will be fetched from relations
            groupName: group.name,
            comment: avoir.comment || "",
            commercialProcessed: avoir.commercialProcessed,
            createdBy: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username,
            createdAt: avoir.createdAt
          };
          
          const webhookResponse = await fetch(group.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookData)
          });
          
          if (webhookResponse.ok) {
            await storage.updateAvoirWebhookStatus(avoir.id, true);
            console.log('✅ Avoir webhook sent successfully:', avoir.id);
          } else {
            console.error('❌ Failed to send avoir webhook:', webhookResponse.status);
          }
        }
      } catch (webhookError) {
        console.error('❌ Error sending avoir webhook:', webhookError);
      }
      
      res.json(avoir);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ [POST AVOIR] ERREURS VALIDATION ZOD:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("❌ [POST AVOIR] Erreur générale:", error);
      res.status(500).json({ message: "Failed to create avoir" });
    }
  });

  app.put('/api/avoirs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const existingAvoir = await storage.getAvoir(id);
      
      if (!existingAvoir) {
        return res.status(404).json({ message: "Avoir not found" });
      }

      // Check permissions
      if (user.role !== 'admin' && user.role !== 'directeur') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(existingAvoir.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // ✅ CRITICAL FIX: Validate data with Zod schema (partial)
      console.log('💰 PUT Avoir - Raw body received:', JSON.stringify(req.body, null, 2));
      const validatedData = insertAvoirSchema.partial().parse(req.body);
      console.log('💰 PUT Avoir - Validated data:', JSON.stringify(validatedData, null, 2));

      // ✅ FIX: Convertir undefined en null pour les champs optionnels (important pour PostgreSQL)
      const dataForDb: any = {
        ...validatedData,
        amount: validatedData.amount === undefined ? null : validatedData.amount,
        invoiceReference: validatedData.invoiceReference === undefined ? null : validatedData.invoiceReference,
        comment: validatedData.comment === undefined ? null : validatedData.comment,
      };
      console.log('💰 PUT Avoir - Data for DB (undefined → null):', JSON.stringify(dataForDb, null, 2));

      const updatedAvoir = await storage.updateAvoir(id, dataForDb);
      console.log('✅ Avoir updated:', id, 'by user:', user.id);
      
      // 🎯 WEBHOOK QUAND STATUT PASSE À "Reçu"
      if (validatedData.status === 'Reçu' && existingAvoir.status !== 'Reçu') {
        try {
          // Utiliser groupe par défaut (1) pour admin si pas de groupe sélectionné
          const groupId = updatedAvoir.groupId || (user.role === 'admin' ? 1 : updatedAvoir.groupId);
          const group = await storage.getGroup(groupId);
          
          if (group && group.webhookUrl) {
            const webhookData = {
              type: "Avoir",
              avoirId: updatedAvoir.id,
              invoiceReference: updatedAvoir.invoiceReference,
              amount: updatedAvoir.amount,
              supplierName: "Fournisseur", // Sera enrichi avec relations
              groupName: group.name,
              comment: updatedAvoir.comment || "",
              commercialProcessed: updatedAvoir.commercialProcessed,
              status: "Reçu",
              createdBy: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username,
              processedAt: new Date().toISOString()
            };
            
            console.log('🌐 Envoi webhook avoir reçu:', { groupId, webhookUrl: group.webhookUrl });
            
            const webhookResponse = await fetch(group.webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(webhookData)
            });
            
            if (webhookResponse.ok) {
              await storage.updateAvoirWebhookStatus(updatedAvoir.id, true);
              console.log('✅ Webhook avoir reçu envoyé:', updatedAvoir.id);
            } else {
              console.error('❌ Échec envoi webhook avoir:', webhookResponse.status);
            }
          }
        } catch (webhookError) {
          console.error('❌ Erreur webhook avoir reçu:', webhookError);
        }
      }
      
      res.json(updatedAvoir);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ [PUT AVOIR] ERREURS VALIDATION ZOD:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating avoir:", error);
      res.status(500).json({ message: "Failed to update avoir" });
    }
  });

  app.delete('/api/avoirs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const avoir = await storage.getAvoir(id);
      
      if (!avoir) {
        return res.status(404).json({ message: "Avoir not found" });
      }

      // Check permissions (only admin and directeur can delete)
      if (user.role !== 'admin' && user.role !== 'directeur') {
        return res.status(403).json({ message: "Insufficient permissions to delete avoirs" });
      }

      // For directeur, check group access
      if (user.role === 'directeur') {
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (!userGroupIds.includes(avoir.groupId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteAvoir(id);
      console.log('✅ Avoir deleted:', id, 'by user:', user.id);
      res.json({ message: "Avoir deleted successfully" });
    } catch (error) {
      console.error("Error deleting avoir:", error);
      res.status(500).json({ message: "Failed to delete avoir" });
    }
  });

  // Route de vérification de facture NocoDB pour les avoirs
  app.post('/api/avoirs/:id/verify-invoice', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const avoirId = parseInt(req.params.id);
      const avoir = await storage.getAvoir(avoirId);
      
      if (!avoir) {
        return res.status(404).json({ message: "Avoir not found" });
      }

      // Check permissions (using 'deliveries' module for similar logic)
      if (!hasPermission(user.role, 'deliveries', 'view')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Only admin have access to all avoirs, others must be in the same group
      if (user.role !== 'admin') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        if (!userGroupIds.includes(avoir.groupId)) {
          console.log('🚫 Access denied - User groups check:', {
            userId: user.id,
            userRole: user.role,
            userGroupIds,
            avoirGroupId: avoir.groupId,
            avoirSupplier: avoir.supplier?.name
          });
          return res.status(403).json({ message: "Access denied to this group" });
        }
      }

      const { invoiceReference, forceRefresh } = req.body;
      
      if (!avoir.supplier || !avoir.group) {
        console.log('❌ Avoir manque informations:', {
          avoirId,
          hasSupplier: !!avoir.supplier,
          hasGroup: !!avoir.group
        });
        return res.status(400).json({ message: "Avoir missing supplier or group information" });
      }

      // Vérifier que la référence facture est présente
      if (!invoiceReference || !invoiceReference.trim()) {
        return res.status(400).json({ message: "Référence de facture requise" });
      }

      console.log('🔍 Vérification facture avoir:', {
        avoirId,
        invoiceReference,
        supplier: avoir.supplier?.name,
        group: avoir.group?.name,
        groupId: avoir.groupId
      });

      // Vérifier par référence de facture uniquement
      const result = await invoiceVerificationService.verifyInvoice(
        invoiceReference,
        avoir.groupId,
        forceRefresh || false,
        false // Les avoirs ne sont pas "réconciliés" comme les livraisons
      );

      console.log('✅ Résultat vérification avoir:', result);
      res.json(result);
    } catch (error) {
      console.error("Error verifying avoir invoice:", error);
      res.status(500).json({ 
        message: "Failed to verify avoir invoice",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Avoir status update routes
  app.put('/api/avoirs/:id/webhook-status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const { webhookSent } = req.body;
      
      // Only allow admin and directeur to update webhook status
      if (user.role !== 'admin' && user.role !== 'directeur') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      await storage.updateAvoirWebhookStatus(id, webhookSent);
      res.json({ message: "Webhook status updated successfully" });
    } catch (error) {
      console.error("Error updating avoir webhook status:", error);
      res.status(500).json({ message: "Failed to update webhook status" });
    }
  });

  app.put('/api/avoirs/:id/nocodb-verification', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const id = parseInt(req.params.id);
      const { verified } = req.body;
      
      // Only allow admin and directeur to update verification status
      if (user.role !== 'admin' && user.role !== 'directeur') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      await storage.updateAvoirNocodbVerification(id, verified);

      // Si validé, marquer le cache comme réconcilié (permanent)
      if (verified) {
        try {
          const avoir = await storage.getAvoir(id);
          if (avoir?.invoiceReference?.trim()) {
            await invoiceVerificationService.updateCacheAsReconciled(
              avoir.invoiceReference, 
              avoir.groupId
            );
            console.log('✅ Cache marqué comme réconcilié pour avoir:', id);
          }
        } catch (cacheError) {
          console.error('❌ Erreur marquage cache réconcilié:', cacheError);
          // Ne pas faire échouer la validation si le cache échoue
        }
      }

      console.log('✅ Avoir NocoDB verification updated:', id, 'verified:', verified, 'by user:', user.id);
      res.json({ message: "NocoDB verification status updated successfully" });
    } catch (error) {
      console.error("Error updating avoir NocoDB verification:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  // Route pour marquer explicitement le cache comme réconcilié
  app.post('/api/cache/mark-reconciled', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { invoiceReference, groupId } = req.body;
      
      if (!invoiceReference || !groupId) {
        return res.status(400).json({ message: "Invoice reference and group ID required" });
      }

      // Seuls admin et directeur peuvent marquer comme réconcilié
      if (user.role !== 'admin' && user.role !== 'directeur') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      await invoiceVerificationService.updateCacheAsReconciled(invoiceReference, groupId);
      console.log('✅ Cache marqué comme réconcilié:', { invoiceReference, groupId, user: user.id });
      
      res.json({ message: "Cache marked as reconciled successfully" });
    } catch (error) {
      console.error("Error marking cache as reconciled:", error);
      res.status(500).json({ message: "Failed to mark cache as reconciled" });
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

  // Route pour les statistiques annuelles
  app.get('/api/stats/yearly', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { year, storeId } = req.query;
      const currentYear = year ? parseInt(year as string) : new Date().getFullYear();

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

      const stats = await storage.getYearlyStats(currentYear, groupIds);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching yearly stats:", error);
      res.status(500).json({ message: "Failed to fetch yearly statistics" });
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
      if (!user || !['admin', 'directeur', 'manager'].includes(user.role)) {
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

  // Publicity routes (renamed to campaigns to avoid adblocker issues)
  app.get('/api/campaigns', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { year, storeId } = req.query;
      const filterYear = year ? parseInt(year as string) : undefined;

      // DEBUG: Log pour identifier le problème avec 2025
      console.log(`📋 API PUBLICITIES REQUEST:`, { year, filterYear, storeId, userRole: user.role });

      let groupIds: number[] | undefined;
      
      if (user.role === 'admin') {
        // Admin can view all publicities or filter by selected store
        groupIds = storeId ? [parseInt(storeId as string)] : undefined;
      } else {
        // Non-admin users: filter by their assigned groups
        groupIds = user.userGroups.map(ug => ug.groupId);
      }

      console.log(`📋 CALLING storage.getPublicities:`, { filterYear, groupIds });
      const publicities = await storage.getPublicities(filterYear, groupIds);
      console.log(`📋 PUBLICITIES RETURNED:`, { count: publicities.length });
      
      res.json(publicities);
    } catch (error) {
      console.error("❌ ERROR fetching publicities:", error);
      res.status(500).json({ message: "Failed to fetch publicities", error: (error as Error).message });
    }
  });

  app.get('/api/campaigns/:id', isAuthenticated, async (req: any, res) => {
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

  // Get all publicities (with optional year and store filtering)
  app.get('/api/publicities', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { year, storeId } = req.query;
      let groupIds: number[] | undefined;
      
      // Determine which groups to filter by
      if (user.role === 'admin') {
        // Admins can filter by specific store or see all
        groupIds = storeId ? [parseInt(storeId as string)] : undefined;
      } else {
        // Non-admins see only their assigned groups
        const userGroupIds = user.userGroups.map(ug => ug.groupId);
        if (storeId && userGroupIds.includes(parseInt(storeId as string))) {
          groupIds = [parseInt(storeId as string)];
        } else {
          groupIds = userGroupIds;
        }
      }

      const yearNum = year ? parseInt(year as string) : undefined;
      const publicities = await storage.getPublicities(yearNum, groupIds);
      
      res.json(publicities);
    } catch (error) {
      console.error("Error fetching publicities:", error);
      res.status(500).json([]);
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
    const publicityId = req.params.id;
    console.log(`🗑️ [API] DELETE request received for publicity ID: ${publicityId}`);
    console.log(`🗑️ [API] User info:`, { 
      hasUser: !!req.user, 
      userId: req.user?.id || req.user?.claims?.sub,
      method: req.method,
      url: req.url,
      headers: { 'content-type': req.headers['content-type'] }
    });

    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        console.log(`❌ [API] User not found for publicity deletion: ${publicityId}`);
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`🗑️ [API] User found:`, { id: user.id, role: user.role, name: user.name });

      // Check permissions (admin only for deletion)
      if (user.role !== 'admin') {
        console.log(`❌ [API] Insufficient permissions for publicity deletion: ${publicityId}, user role: ${user.role}`);
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(publicityId);
      console.log(`🗑️ [API] Admin ${user.name} (${user.id}) attempting to delete publicity ${id}`);
      
      await storage.deletePublicity(id);
      
      console.log(`✅ [API] Successfully deleted publicity ${id} by admin ${user.name}`);
      res.json({ message: "Publicity deleted successfully" });
    } catch (error) {
      console.error(`❌ [API] Error deleting publicity ${publicityId}:`, error);
      res.status(500).json({ message: "Failed to delete publicity", error: error.message });
    }
  });

  // Alternative DELETE route using POST (for production environments that block DELETE)
  app.post('/api/publicities/:id/delete', isAuthenticated, async (req: any, res) => {
    const publicityId = req.params.id;
    console.log(`🗑️ [API-POST] DELETE via POST request received for publicity ID: ${publicityId}`);
    console.log(`🗑️ [API-POST] User info:`, { 
      hasUser: !!req.user, 
      userId: req.user?.id || req.user?.claims?.sub,
      method: req.method,
      url: req.url
    });

    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        console.log(`❌ [API-POST] User not found for publicity deletion: ${publicityId}`);
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`🗑️ [API-POST] User found:`, { id: user.id, role: user.role, name: user.name });

      // Check permissions (admin only for deletion)
      if (user.role !== 'admin') {
        console.log(`❌ [API-POST] Insufficient permissions for publicity deletion: ${publicityId}, user role: ${user.role}`);
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const id = parseInt(publicityId);
      console.log(`🗑️ [API-POST] Admin ${user.name} (${user.id}) attempting to delete publicity ${id} via POST`);
      
      await storage.deletePublicity(id);
      
      console.log(`✅ [API-POST] Successfully deleted publicity ${id} by admin ${user.name} via POST`);
      res.json({ message: "Publicity deleted successfully" });
    } catch (error) {
      console.error(`❌ [API-POST] Error deleting publicity ${publicityId} via POST:`, error);
      res.status(500).json({ message: "Failed to delete publicity", error: error.message });
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
      // const historyData = insertSavTicketHistorySchema.parse({
      //   ticketId: ticketId,
      //   action: 'comment',
      //   description: req.body.description,
      //   createdBy: user.id,
      // });

      const history = await storage.addSavTicketHistory({
        ticketId: ticketId,
        action: 'comment',
        description: req.body.description,
        createdBy: user.id,
      });
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
            messages.map(async (message: any) => {
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

  // API d'exécution SQL pour admin uniquement
  app.post('/api/admin/execute-sql', isAuthenticated, async (req: any, res) => {
    try {
      // Vérifier que l'utilisateur est admin
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé - Admin uniquement' });
      }

      const { sql: sqlQuery } = req.body;
      
      if (!sqlQuery || typeof sqlQuery !== 'string') {
        return res.status(400).json({ error: 'SQL query requis' });
      }

      console.log('🔧 [SQL-EXECUTOR] Début exécution SQL pour admin:', userId);
      console.log('🔧 [SQL-EXECUTOR] Query:', sqlQuery.substring(0, 200) + '...');

      const logs = [`🔄 Exécution SQL démarrée...`];
      
      try {
        // Utilisation de drizzle-orm pour l'exécution
        const { sql } = await import('drizzle-orm');
        const result = await db.execute(sql.raw(sqlQuery));
        
        logs.push(`✅ SQL exécuté avec succès`);
        logs.push(`📊 Nombre de lignes affectées: ${result.rowCount || 0}`);
        
        if (result.rows && result.rows.length > 0) {
          logs.push(`📋 Nombre de lignes retournées: ${result.rows.length}`);
          if (result.rows.length <= 10) {
            logs.push(`📋 Résultats: ${JSON.stringify(result.rows, null, 2)}`);
          } else {
            logs.push(`📋 Échantillon (10 premières lignes): ${JSON.stringify(result.rows.slice(0, 10), null, 2)}`);
          }
        }
        
        console.log('✅ [SQL-EXECUTOR] Exécution réussie');
        
        res.json({ 
          success: true, 
          logs,
          results: result.rows,
          rowCount: result.rowCount
        });

      } catch (sqlError: any) {
        console.error('❌ [SQL-EXECUTOR] Erreur SQL:', sqlError);
        logs.push(`❌ Erreur SQL: ${sqlError.message}`);
        
        return res.status(500).json({ 
          error: `Erreur SQL: ${sqlError.message}`,
          logs 
        });
      }

    } catch (error: any) {
      console.error('❌ [SQL-EXECUTOR] Erreur générale:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // Analytics routes
  app.get('/api/analytics/summary', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Parse query parameters
      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        supplierIds: req.query.supplierIds ? req.query.supplierIds.split(',').map(Number) : undefined,
        groupIds: req.query.groupIds ? req.query.groupIds.split(',').map(Number) : undefined,
        status: req.query.status ? req.query.status.split(',') : undefined
      };

      // Apply role-based filtering
      if (user.role !== 'admin' && user.role !== 'directeur') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        filters.groupIds = filters.groupIds 
          ? filters.groupIds.filter(id => userGroupIds.includes(id))
          : userGroupIds;
      }

      const summary = await storage.getAnalyticsSummary(filters);
      res.json(summary);
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
      res.status(500).json({ message: 'Failed to fetch analytics summary' });
    }
  });

  app.get('/api/analytics/timeseries', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        supplierIds: req.query.supplierIds ? req.query.supplierIds.split(',').map(Number) : undefined,
        groupIds: req.query.groupIds ? req.query.groupIds.split(',').map(Number) : undefined,
        granularity: (req.query.granularity as 'day' | 'week' | 'month') || 'day'
      };

      // Apply role-based filtering
      if (user.role !== 'admin' && user.role !== 'directeur') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        filters.groupIds = filters.groupIds 
          ? filters.groupIds.filter(id => userGroupIds.includes(id))
          : userGroupIds;
      }

      const timeseries = await storage.getAnalyticsTimeseries(filters);
      res.json(timeseries);
    } catch (error) {
      console.error('Error fetching analytics timeseries:', error);
      res.status(500).json({ message: 'Failed to fetch analytics timeseries' });
    }
  });

  app.get('/api/analytics/by-supplier', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        groupIds: req.query.groupIds ? req.query.groupIds.split(',').map(Number) : undefined
      };

      // Apply role-based filtering
      if (user.role !== 'admin' && user.role !== 'directeur') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        filters.groupIds = filters.groupIds 
          ? filters.groupIds.filter(id => userGroupIds.includes(id))
          : userGroupIds;
      }

      const bySupplier = await storage.getAnalyticsBySupplier(filters);
      res.json(bySupplier);
    } catch (error) {
      console.error('Error fetching analytics by supplier:', error);
      res.status(500).json({ message: 'Failed to fetch analytics by supplier' });
    }
  });

  app.get('/api/analytics/by-store', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        supplierIds: req.query.supplierIds ? req.query.supplierIds.split(',').map(Number) : undefined
      };

      const byStore = await storage.getAnalyticsByStore(filters);
      res.json(byStore);
    } catch (error) {
      console.error('Error fetching analytics by store:', error);
      res.status(500).json({ message: 'Failed to fetch analytics by store' });
    }
  });

  app.get('/api/analytics/export', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const type = req.query.type || 'summary';
      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        supplierIds: req.query.supplierIds ? req.query.supplierIds.split(',').map(Number) : undefined,
        groupIds: req.query.groupIds ? req.query.groupIds.split(',').map(Number) : undefined,
        status: req.query.status ? req.query.status.split(',') : undefined
      };

      // Apply role-based filtering
      if (user.role !== 'admin' && user.role !== 'directeur') {
        const userGroupIds = user.userGroups?.map((ug: any) => ug.groupId) || [];
        filters.groupIds = filters.groupIds 
          ? filters.groupIds.filter(id => userGroupIds.includes(id))
          : userGroupIds;
      }

      let data: any;
      let filename = `analytics_${type}_${new Date().toISOString().split('T')[0]}.csv`;
      
      switch(type) {
        case 'timeseries':
          data = await storage.getAnalyticsTimeseries({ ...filters, granularity: 'day' });
          break;
        case 'suppliers':
          data = await storage.getAnalyticsBySupplier(filters);
          break;
        case 'stores':
          data = await storage.getAnalyticsByStore(filters);
          break;
        default:
          data = [await storage.getAnalyticsSummary(filters)];
      }

      // Convert to CSV
      if (data && data.length > 0) {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map((item: any) => 
          Object.values(item).map((val: any) => 
            typeof val === 'object' ? JSON.stringify(val) : val
          ).join(',')
        ).join('\n');
        
        const csv = `${headers}\n${rows}`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
      } else {
        res.status(404).json({ message: 'No data to export' });
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      res.status(500).json({ message: 'Failed to export analytics' });
    }
  });

  // Create server instance
  const httpServer = createServer(app);

  // Server startup
  return httpServer;
}
