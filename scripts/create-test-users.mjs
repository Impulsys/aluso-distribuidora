#!/usr/bin/env node

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json no encontrado');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

// Usuarios de prueba por rol
const TEST_USERS = {
  superadmin: {
    email: 'superadmin@aluso.test',
    password: 'SuperAdmin123!',
    displayName: 'Anabela Dueño',
    role: 'superadmin',
  },
  socio: {
    email: 'socio@aluso.test',
    password: 'Socio123!',
    displayName: 'Luciano Socio',
    role: 'socio',
  },
  deposito: {
    email: 'deposito@aluso.test',
    password: 'Deposito123!',
    displayName: 'Juan Depósito',
    role: 'deposito',
  },
  vendedor_base: {
    email: 'vendedor@aluso.test',
    password: 'Vendedor123!',
    displayName: 'Carlos Vendedor',
    role: 'vendedor',
  },
  vendedor_premium: {
    email: 'vendedor.premium@aluso.test',
    password: 'VendedorPremium123!',
    displayName: 'María Vendedor Premium',
    role: 'vendedor',
  },
  cliente: {
    email: 'cliente@aluso.test',
    password: 'Cliente123!',
    displayName: 'Roberto Cliente',
    role: 'cliente',
  },
};

async function createTestUsers() {
  console.log('👤 Creando usuarios de prueba...\n');

  try {
    for (const [key, userData] of Object.entries(TEST_USERS)) {
      try {
        // Intentar crear usuario en Auth
        let userRecord;
        try {
          userRecord = await auth.getUserByEmail(userData.email);
          console.log(`  ⚠️  ${userData.email} ya existe en Auth, actualizando...`);
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            userRecord = await auth.createUser({
              email: userData.email,
              password: userData.password,
              displayName: userData.displayName,
            });
            console.log(`  ✓ ${userData.email} creado en Auth`);
          } else {
            throw error;
          }
        }

        // Crear/actualizar doc en Firestore
        await db.collection('users').doc(userRecord.uid).set(
          {
            email: userData.email,
            displayName: userData.displayName,
            role: userData.role,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        console.log(`    ✓ Firestore: ${userData.role}`);

      } catch (error) {
        console.error(`  ❌ Error creando ${userData.email}:`, error.message);
      }
    }

    console.log(`\n✅ Usuarios de prueba creados/actualizados\n`);
    console.log('📋 Credenciales de prueba:');
    console.log('────────────────────────────────────────');

    for (const [key, userData] of Object.entries(TEST_USERS)) {
      console.log(`\n${userData.role.toUpperCase()}: ${userData.displayName}`);
      console.log(`  Email:    ${userData.email}`);
      console.log(`  Password: ${userData.password}`);
    }

    console.log('\n────────────────────────────────────────');
    console.log('\n💡 Estas credenciales aparecerán en el desplegable de login en modo DEMO\n');

  } catch (error) {
    console.error('❌ Error grave:', error);
    process.exit(1);
  }

  process.exit(0);
}

createTestUsers();
