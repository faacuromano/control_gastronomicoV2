/**
 * Script de Corrección de tenantId NULL
 *
 * Este script asigna tenantId a registros que tienen NULL antes de hacer
 * los campos obligatorios en el schema.
 *
 * ESTRATEGIA:
 * 1. Identificar tenant por defecto (primer tenant o tenant con code="default")
 * 2. Para registros relacionados, obtener tenantId de la relación padre
 * 3. Asignar tenantId por defecto si no hay relación
 *
 * EJECUTAR ANTES DE HACER tenantId OBLIGATORIO
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getDefaultTenant() {
  // Buscar tenant "default"
  let tenant = await prisma.tenant.findFirst({ where: { code: 'default' } });

  // Si no existe, tomar el primero
  if (!tenant) {
    tenant = await prisma.tenant.findFirst();
  }

  // Si no hay ningún tenant, crear uno por defecto
  if (!tenant) {
    console.log('⚠️  No hay tenants en la base de datos. Creando tenant por defecto...');
    tenant = await prisma.tenant.create({
      data: {
        name: 'Default Tenant',
        code: 'default',
        activeSubscription: true,
      },
    });
    console.log(`✅ Tenant creado: ${tenant.name} (ID: ${tenant.id})`);
  }

  return tenant;
}

async function fixAreaNulls(defaultTenantId: number) {
  const nullAreas = await prisma.area.findMany({
    // @ts-expect-error Pre-migration script queries NULL tenantId before NOT NULL constraint
    where: { tenantId: null },
  });

  if (nullAreas.length === 0) {
    console.log('✅ Area: Sin registros NULL');
    return 0;
  }

  console.log(`🔧 Corrigiendo ${nullAreas.length} Area(s) con tenantId NULL...`);

  for (const area of nullAreas) {
    await prisma.area.update({
      where: { id: area.id },
      data: { tenantId: defaultTenantId },
    });
    console.log(`   - Area ID ${area.id} ("${area.name}") → tenantId: ${defaultTenantId}`);
  }

  return nullAreas.length;
}

async function fixTableNulls(defaultTenantId: number) {
  const nullTables = await prisma.table.findMany({
    // @ts-expect-error Pre-migration script queries NULL tenantId before NOT NULL constraint
    where: { tenantId: null },
    include: { area: true },
  });

  if (nullTables.length === 0) {
    console.log('✅ Table: Sin registros NULL');
    return 0;
  }

  console.log(`🔧 Corrigiendo ${nullTables.length} Table(s) con tenantId NULL...`);

  for (const table of nullTables) {
    // Intentar obtener tenantId del Area relacionada
    let tenantId = defaultTenantId;
    const tableWithArea = table as typeof table & { area?: { tenantId: number } };

    if (tableWithArea.area && tableWithArea.area.tenantId) {
      tenantId = tableWithArea.area.tenantId;
      console.log(
        `   - Table ID ${table.id} ("${table.name}") → tenantId: ${tenantId} (from Area)`
      );
    } else {
      console.log(
        `   - Table ID ${table.id} ("${table.name}") → tenantId: ${tenantId} (default)`
      );
    }

    await prisma.table.update({
      where: { id: table.id },
      data: { tenantId },
    });
  }

  return nullTables.length;
}

async function fixAuditLogNulls(defaultTenantId: number) {
  const nullLogs = await prisma.auditLog.findMany({
    // @ts-expect-error Pre-migration script queries NULL tenantId before NOT NULL constraint
    where: { tenantId: null },
  });

  if (nullLogs.length === 0) {
    console.log('✅ AuditLog: Sin registros NULL');
    return 0;
  }

  console.log(`🔧 Corrigiendo ${nullLogs.length} AuditLog(s) con tenantId NULL...`);

  for (const log of nullLogs) {
    // Intentar obtener tenantId del User relacionado
    let tenantId = defaultTenantId;

    if (log.userId) {
      const user = await prisma.user.findUnique({
        where: { id: log.userId },
        select: { tenantId: true },
      });

      if (user && user.tenantId) {
        tenantId = user.tenantId;
      }
    }

    await prisma.auditLog.update({
      where: { id: log.id },
      data: { tenantId },
    });
  }

  console.log(
    `   - ${nullLogs.length} registros actualizados (tenantId asignado por usuario o default)`
  );

  return nullLogs.length;
}

async function main() {
  console.log('🔧 CORRECCIÓN DE REGISTROS CON tenantId NULL\n');
  console.log('=' .repeat(80));

  // 1. Obtener tenant por defecto
  console.log('\n1️⃣  Identificando tenant por defecto...\n');
  const defaultTenant = await getDefaultTenant();
  console.log(`✅ Tenant por defecto: ${defaultTenant.name} (ID: ${defaultTenant.id})\n`);

  // 2. Corregir registros NULL
  console.log('2️⃣  Corrigiendo registros con tenantId NULL...\n');

  let totalFixed = 0;

  totalFixed += await fixAreaNulls(defaultTenant.id);
  totalFixed += await fixTableNulls(defaultTenant.id);
  totalFixed += await fixAuditLogNulls(defaultTenant.id);

  // 3. Verificar que no queden NULL
  console.log('\n3️⃣  Verificando resultado...\n');

  const remainingNulls = {
    // @ts-expect-error Pre-migration script queries NULL tenantId before NOT NULL constraint
    area: await prisma.area.count({ where: { tenantId: null } }),
    // @ts-expect-error Pre-migration script queries NULL tenantId before NOT NULL constraint
    table: await prisma.table.count({ where: { tenantId: null } }),
    // @ts-expect-error Pre-migration script queries NULL tenantId before NOT NULL constraint
    auditLog: await prisma.auditLog.count({ where: { tenantId: null } }),
  };

  const totalRemaining = Object.values(remainingNulls).reduce((a, b) => a + b, 0);

  if (totalRemaining === 0) {
    console.log('✅ VERIFICACIÓN EXITOSA: No quedan registros con tenantId NULL\n');
  } else {
    console.log('❌ ADVERTENCIA: Aún hay registros NULL:\n');
    Object.entries(remainingNulls).forEach(([model, count]) => {
      if (count > 0) {
        console.log(`   - ${model}: ${count} registros`);
      }
    });
    console.log('');
  }

  // Resumen
  console.log('=' .repeat(80));
  console.log(`📊 RESUMEN:`);
  console.log(`   - Registros corregidos: ${totalFixed}`);
  console.log(`   - Registros NULL restantes: ${totalRemaining}`);
  console.log('=' .repeat(80));

  if (totalRemaining === 0) {
    console.log('\n✅ Base de datos lista para hacer tenantId obligatorio (NOT NULL)\n');
  } else {
    console.log('\n⚠️  Corrige los registros restantes antes de continuar\n');
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error ejecutando corrección:', e);
    process.exit(1);
  });
