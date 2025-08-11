import { relations } from "drizzle-orm/relations";
import { suppliers, dlcProducts, users, groups, tasks, publicities, publicityParticipations, roles, rolePermissions, permissions, userRoles } from "./schema";

export const dlcProductsRelations = relations(dlcProducts, ({one}) => ({
	supplier: one(suppliers, {
		fields: [dlcProducts.supplierId],
		references: [suppliers.id]
	}),
	user_validatedBy: one(users, {
		fields: [dlcProducts.validatedBy],
		references: [users.id],
		relationName: "dlcProducts_validatedBy_users_id"
	}),
	group: one(groups, {
		fields: [dlcProducts.groupId],
		references: [groups.id]
	}),
	user_createdBy: one(users, {
		fields: [dlcProducts.createdBy],
		references: [users.id],
		relationName: "dlcProducts_createdBy_users_id"
	}),
}));

export const suppliersRelations = relations(suppliers, ({many}) => ({
	dlcProducts: many(dlcProducts),
}));

export const usersRelations = relations(users, ({many}) => ({
	dlcProducts_validatedBy: many(dlcProducts, {
		relationName: "dlcProducts_validatedBy_users_id"
	}),
	dlcProducts_createdBy: many(dlcProducts, {
		relationName: "dlcProducts_createdBy_users_id"
	}),
	tasks_completedBy: many(tasks, {
		relationName: "tasks_completedBy_users_id"
	}),
	tasks_createdBy: many(tasks, {
		relationName: "tasks_createdBy_users_id"
	}),
	userRoles: many(userRoles),
}));

export const groupsRelations = relations(groups, ({many}) => ({
	dlcProducts: many(dlcProducts),
	tasks: many(tasks),
	publicityParticipations: many(publicityParticipations),
}));

export const tasksRelations = relations(tasks, ({one}) => ({
	user_completedBy: one(users, {
		fields: [tasks.completedBy],
		references: [users.id],
		relationName: "tasks_completedBy_users_id"
	}),
	group: one(groups, {
		fields: [tasks.groupId],
		references: [groups.id]
	}),
	user_createdBy: one(users, {
		fields: [tasks.createdBy],
		references: [users.id],
		relationName: "tasks_createdBy_users_id"
	}),
}));

export const publicityParticipationsRelations = relations(publicityParticipations, ({one}) => ({
	publicity: one(publicities, {
		fields: [publicityParticipations.publicityId],
		references: [publicities.id]
	}),
	group: one(groups, {
		fields: [publicityParticipations.groupId],
		references: [groups.id]
	}),
}));

export const publicitiesRelations = relations(publicities, ({many}) => ({
	publicityParticipations: many(publicityParticipations),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	role: one(roles, {
		fields: [rolePermissions.roleId],
		references: [roles.id]
	}),
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	}),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	rolePermissions: many(rolePermissions),
	userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id]
	}),
}));