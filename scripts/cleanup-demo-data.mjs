#!/usr/bin/env node

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar credenciales de Firebase
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

const COLECCIONES_A_LIMPIAR = [
  'orders',           // pedidos
  'cashClosings',     // cierre de caja
  'expenses',         // gastos
  'checks',           // cheques
  'trucks',           // camiones
  'receipts',         // remitos
  'bitacora',         // bitácora
  'productCosts',     // costos de productos (mantener pero resetear a 0)
];

async function cleanupData() {
  console.log('🧹 Iniciando limpieza de datos de Los Amigos...\n');

  try {
    // 1. Limpiar colecciones
    for (const coleccion of COLECCIONES_A_LIMPIAR) {
      console.log(`  Limpiando ${coleccion}...`);
      const snapshot = await db.collection(coleccion).get();
      const batch = db.batch();

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      if (snapshot.size > 0) {
        await batch.commit();
        console.log(`    ✓ ${snapshot.size} documentos eliminados`);
      } else {
        console.log(`    ✓ (vacío)`);
      }
    }

    // 2. Resetear stock en productos
    console.log(`\n  Reseteando stock en productos...`);
    const productsSnapshot = await db.collection('products').get();
    const batch = db.batch();

    productsSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        stock: 0,
        destacado: false,
        precioOferta: 0,
      });
    });

    if (productsSnapshot.size > 0) {
      await batch.commit();
      console.log(`    ✓ Stock reseteado en ${productsSnapshot.size} productos`);
    }

    // 3. Resetear productCosts a 0
    console.log(`\n  Reseteando costos de productos...`);
    const costsSnapshot = await db.collection('productCosts').get();
    const costBatch = db.batch();

    costsSnapshot.docs.forEach((doc) => {
      costBatch.update(doc.ref, { cost: 0 });
    });

    if (costsSnapshot.size > 0) {
      await costBatch.commit();
      console.log(`    ✓ Costos reseteados en ${costsSnapshot.size} productos`);
    }

    // 4. Limpiar colección de usuarios (excepto superadmins)
    console.log(`\n  Limpiando usuarios de demostración...`);
    const usersSnapshot = await db.collection('users').get();
    const userBatch = db.batch();

    let deletedCount = 0;
    usersSnapshot.docs.forEach((doc) => {
      const role = doc.data().role;
      // Mantener solo superadmin, el resto se borra (se recrearán como demo)
      if (role !== 'superadmin') {
        userBatch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await userBatch.commit();
      console.log(`    ✓ ${deletedCount} usuarios de demostración eliminados`);
    }

    console.log(`\n✅ Limpieza completada exitosamente`);
    console.log(`\n📋 Resumen:`);
    console.log(`   • Pedidos, caja, gastos, cheques, camiones: eliminados`);
    console.log(`   • Stock de productos: reseteado a 0`);
    console.log(`   • Costos de productos: reseteados a 0`);
    console.log(`   • Usuarios de demostración: eliminados`);
    console.log(`   • Mantenido: catálogo, imágenes, precios públicos, EAN\n`);

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    process.exit(1);
  }

  process.exit(0);
}

cleanupData();
