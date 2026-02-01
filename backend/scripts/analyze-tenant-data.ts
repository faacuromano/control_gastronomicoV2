/**
 * Script de Análisis Pre-Migración Multi-Tenant
 *
 * Este script verifica el estado actual de los datos en la base de datos
 * para identificar registros con tenantId NULL antes de hacer los campos obligatorios.
 *
 * EJECUTAR ANTES DE APLICAR MIGRACIONES
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AnalysisResult {
  model: string;
  totalRecords: number;
  nullTenantIds: number;
  hasNulls: boolean;
  hasTenantIdField: boolean;
}

async function analyzeModel(modelName: string, modelDelegate: any): Promise<AnalysisResult> {
  try {
    // Primero verificar si el modelo tiene campo tenantId
    const sampleRecord = await modelDelegate.findFirst();
    const hasTenantIdField = sampleRecord && 'tenantId' in sampleRecord;

    if (!hasTenantIdField) {
      return {
        model: modelName,
        totalRecords: await modelDelegate.count(),
        nullTenantIds: 0,
        hasNulls: false,
        hasTenantIdField: false,
      };
    }

    const totalRecords = await modelDelegate.count();
    const nullTenantIds = await modelDelegate.count({
      where: { tenantId: null },
    });

    return {
      model: modelName,
      totalRecords,
      nullTenantIds,
      hasNulls: nullTenantIds > 0,
      hasTenantIdField: true,
    };
  } catch (error: any) {
    console.error(`Error analyzing ${modelName}:`, error.message);
    return {
      model: modelName,
      totalRecords: 0,
      nullTenantIds: 0,
      hasNulls: false,
      hasTenantIdField: false,
    };
  }
}

async function main() {
  console.log('🔍 ANÁLISIS DE DATOS PRE-MIGRACIÓN MULTI-TENANT\n');
  console.log('=' .repeat(80));

  const modelsToAnalyze = [
    { name: 'TenantConfig', delegate: prisma.tenantConfig },
    { name: 'OrderSequence', delegate: prisma.orderSequence },
    { name: 'Role', delegate: prisma.role },
    { name: 'User', delegate: prisma.user },
    { name: 'Category', delegate: prisma.category },
    { name: 'Printer', delegate: prisma.printer },
    { name: 'Product', delegate: prisma.product },
    { name: 'ModifierGroup', delegate: prisma.modifierGroup },
    { name: 'Ingredient', delegate: prisma.ingredient },
    { name: 'Supplier', delegate: prisma.supplier },
    { name: 'PurchaseOrder', delegate: prisma.purchaseOrder },
    { name: 'Invoice', delegate: prisma.invoice },
    { name: 'Order', delegate: prisma.order },
    { name: 'Area', delegate: prisma.area },
    { name: 'Table', delegate: prisma.table },
    { name: 'Client', delegate: prisma.client },
    { name: 'CashShift', delegate: prisma.cashShift },
    { name: 'PaymentMethodConfig', delegate: prisma.paymentMethodConfig },
    { name: 'AuditLog', delegate: prisma.auditLog },
    { name: 'QrCode', delegate: prisma.qrCode },
    { name: 'DeliveryDriver', delegate: prisma.deliveryDriver },
    // Modelos que NO tienen tenantId (falta agregar)
    { name: 'StockMovement', delegate: prisma.stockMovement },
    { name: 'Payment', delegate: prisma.payment },
    { name: 'OrderItem', delegate: prisma.orderItem },
    { name: 'OrderItemModifier', delegate: prisma.orderItemModifier },
    { name: 'PurchaseOrderItem', delegate: prisma.purchaseOrderItem },
    { name: 'ModifierOption', delegate: prisma.modifierOption },
    { name: 'ProductIngredient', delegate: prisma.productIngredient },
    { name: 'ProductModifierGroup', delegate: prisma.productModifierGroup },
    { name: 'AreaPrinterOverride', delegate: prisma.areaPrinterOverride },
    { name: 'ProductChannelPrice', delegate: prisma.productChannelPrice },
  ];

  const results: AnalysisResult[] = [];

  for (const model of modelsToAnalyze) {
    const result = await analyzeModel(model.name, model.delegate);
    results.push(result);
  }

  // Separar resultados
  const modelsWithTenantId = results.filter(r => r.hasTenantIdField);
  const modelsWithoutTenantId = results.filter(r => !r.hasTenantIdField);

  console.log('\n📊 MODELOS CON CAMPO tenantId (Actuales)\n');
  console.log('─'.repeat(80));
  console.log(
    `${'Modelo'.padEnd(25)} | ${'Total'.padEnd(10)} | ${'NULL'.padEnd(10)} | Estado`
  );
  console.log('─'.repeat(80));

  let totalNullRecords = 0;
  let modelsWithNulls = 0;

  for (const result of modelsWithTenantId) {
    const status = result.hasNulls ? '❌ TIENE NULLS' : '✅ OK';
    console.log(
      `${result.model.padEnd(25)} | ${result.totalRecords.toString().padEnd(10)} | ${result.nullTenantIds.toString().padEnd(10)} | ${status}`
    );
    totalNullRecords += result.nullTenantIds;
    if (result.hasNulls) modelsWithNulls++;
  }

  console.log('─'.repeat(80));

  console.log('\n🚨 MODELOS SIN CAMPO tenantId (REQUIEREN MIGRACIÓN)\n');
  console.log('─'.repeat(80));
  console.log(
    `${'Modelo'.padEnd(25)} | ${'Total Registros'.padEnd(15)} | Estado`
  );
  console.log('─'.repeat(80));

  for (const result of modelsWithoutTenantId) {
    if (result.totalRecords > 0) {
      console.log(
        `${result.model.padEnd(25)} | ${result.totalRecords.toString().padEnd(15)} | 🔴 SIN tenantId`
      );
    }
  }

  console.log('─'.repeat(80));

  // Resumen
  console.log('\n📋 RESUMEN EJECUTIVO\n');
  console.log('=' .repeat(80));
  console.log(`Total de modelos analizados: ${results.length}`);
  console.log(`Modelos con tenantId actual: ${modelsWithTenantId.length}`);
  console.log(`Modelos sin tenantId: ${modelsWithoutTenantId.length}`);
  console.log(`Modelos con registros NULL: ${modelsWithNulls}`);
  console.log(`Total de registros con tenantId NULL: ${totalNullRecords}`);
  console.log('=' .repeat(80));

  // Recomendaciones
  console.log('\n💡 RECOMENDACIONES\n');

  if (totalNullRecords > 0) {
    console.log('⚠️  HAY REGISTROS CON tenantId NULL:');
    console.log('   1. Ejecutar script de asignación de tenants');
    console.log('   2. Verificar que todos los registros tengan tenantId válido');
    console.log('   3. LUEGO hacer los campos obligatorios (NOT NULL)\n');
  } else {
    console.log('✅ No hay registros con tenantId NULL en modelos existentes');
    console.log('   Puedes proceder a hacer los campos obligatorios\n');
  }

  if (modelsWithoutTenantId.length > 0) {
    console.log('🔴 HAY MODELOS SIN CAMPO tenantId:');
    console.log('   1. Agregar campo tenantId a estos modelos');
    console.log('   2. Poblar tenantId en registros existentes (via relaciones)');
    console.log('   3. Hacer el campo obligatorio\n');
    console.log('   Modelos afectados:');
    modelsWithoutTenantId
      .filter(r => r.totalRecords > 0)
      .forEach(r => {
        console.log(`   - ${r.model} (${r.totalRecords} registros)`);
      });
  }

  console.log('\n' + '='.repeat(80));
  console.log('🏁 Análisis completado\n');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error ejecutando análisis:', e);
    process.exit(1);
  });
