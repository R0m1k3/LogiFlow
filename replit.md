# Enterprise Weather Management Platform

## Overview
This platform is an enterprise weather management system with advanced multi-tenant logistics tracking and comprehensive order management capabilities. It provides robust delivery workflow management with enhanced reconciliation features, focusing on operational efficiency through detailed financial tracking, granular access controls, and sophisticated permission management.

**Business Vision & Market Potential:** The platform aims to streamline logistics and order fulfillment processes for businesses, improving efficiency and providing critical weather insights for operational planning. Its multi-tenant architecture makes it scalable for various enterprise sizes, offering a competitive edge in logistics management.

## User Preferences
- Langue préférée : Français
- Communication : Langue simple et accessible, éviter les détails techniques
- Nettoyage : Préfère un projet optimisé sans fichiers inutiles

## System Architecture
The platform is built with a clear separation of concerns, utilizing a modern full-stack JavaScript architecture.

**UI/UX Decisions:**
- Frontend uses React.js with custom UI components from `shadcn/ui` and styled with Tailwind CSS for a consistent and modern aesthetic.
- The design emphasizes clean interfaces, responsive layouts for various screen sizes, and intuitive navigation.
- Color schemes prioritize readability and user comfort, with an elegant gradient and shadow design for key elements like the weather widget.

**Technical Implementations & Design Patterns:**
- **Frontend:** React.js for building interactive user interfaces. State management is handled efficiently with React Query for data fetching, caching, and synchronization.
- **Backend:** Node.js Express (ESM) provides a robust API layer. Data validation is performed using Zod schemas.
- **Database:** PostgreSQL is used as the primary data store, with Drizzle ORM facilitating interaction. Database migrations ensure schema consistency.
- **Authentication:** Secure role-based access control (RBAC) is implemented for granular permissions.
- **Multi-tenancy:** The system supports multi-tenant operations with group and permission management.
- **Module for Backup:** An integrated PostgreSQL backup manager allows manual and scheduled backups, with tracking in a `DATABASE_BACKUPS` table.
- **Error Handling:** Robust error management ensures graceful degradation and informative logging, especially for production environments. API responses are logged conditionally to reduce console clutter in production.
- **Data Synchronization:** Logic is implemented to ensure data consistency between development (in-memory storage) and production (PostgreSQL) environments, particularly for order status and relationships.

**Feature Specifications:**
- **Weather Integration:** A comprehensive, modern weather interface displays detailed weather conditions sourced directly from the Visual Crossing API with French language support. Features intelligent date comparison using the same day of the week from the previous year for more relevant weather pattern analysis (e.g., Friday August 15, 2025 vs Friday August 16, 2024). Enhanced with automatic geolocation detection moved to weather settings utility page for better UX organization. Fixed critical production error by removing unused toast dependencies from weather widget (August 2025).
- **Order and Delivery Management:** Full CRUD operations for orders and deliveries, including linking orders to deliveries and managing their statuses.
- **Reconciliation:** Functionality for reconciling Bills of Lading (BL) and invoices with immediate UI updates.
- **Invoice Verification Cache:** Robust caching system for invoice verification results with automatic expiration and conflict resolution. Enhanced with unique constraint handling and graceful error management for production stability (August 2025). Fixed production SSL certificate errors and fetch timeout loops with enhanced error handling, network timeout protection, and error result caching to prevent infinite retry loops (August 2025).
- **UI Scrollbar Optimization:** Eliminated redundant vertical scrollbar on the right side of the screen while preserving necessary internal page scrolling. Implemented global CSS rules with `overflow: hidden` on html/body/root and Layout height management to prevent vertical overflow issues in production (August 2025).
- **Task Management:** Système complet de gestion des tâches avec fonctionnalités temporelles avancées - tri intelligent (pending > priorité > date), dates d'échéance avec sélecteur calendrier, indicateurs visuels pour tâches en retard/urgentes, filtres par échéance (aujourd'hui, cette semaine, en retard, sans échéance), vue Kanban et liste, badges colorés pour statut temporel. Interface optimisée pour suivi prioritaire des tâches non validées. Correction critique de l'isolation des données : chaque magasin ne voit maintenant que ses propres tâches (Août 2025). **PRODUCTION FIX (Août 2025)** : Résolution du problème de rechargements multiples nécessaires pour l'administrateur - le cache des tâches s'invalide maintenant automatiquement lors du changement de magasin sélectionné.
- **DLC Module Permissions:** Correction des permissions de validation DLC pour permettre aux admin, directeur et manager de valider les produits DLC. Ajout de logs de debug pour traçabilité des validations (Août 2025).
- **User and Permission Management:** Granular access controls ensuring that users (e.g., employees) have appropriate permissions for tasks like creating customer orders.
- **Reporting:** Statistical reporting, including monthly summaries of deliveries based on `deliveredDate`.

## External Dependencies
- **API Météo:** Visual Crossing API for weather data.
- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM for database interaction.
- **UI Components:** `shadcn/ui`.
- **Styling:** Tailwind CSS.