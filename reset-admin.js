#!/usr/bin/env node

// Script pour réinitialiser le mot de passe admin en production
// Usage: node reset-admin.js [URL_PRODUCTION]

const url = process.argv[2] || 'http://localhost:3000';
const endpoint = `${url}/api/emergency-admin-reset`;

const resetPassword = async () => {
  try {
    console.log(`🔄 Tentative de réinitialisation admin sur ${url}...`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: 'logiflow-admin-reset-2025'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Succès:', result.message);
      console.log('📋 ID Admin:', result.adminId);
      console.log('🔑 Identifiants: admin/admin');
    } else {
      console.error('❌ Erreur:', result.error);
    }
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
  }
};

resetPassword();