/**
 * One-time fix: reset all listings with negative stock_quantity to 0.
 * Run once with: node fix_negative_stock.js
 */

const prisma = require("./src/lib/prisma");

async function fixNegativeStock() {
  console.log("🔍 Scanning for listings with negative stock...");

  const negativeListings = await prisma.listings.findMany({
    where: { stock_quantity: { lt: 0 } },
    select: { id: true, item_name: true, stock_quantity: true },
  });

  if (negativeListings.length === 0) {
    console.log("✅ No listings with negative stock found. Nothing to fix.");
    return;
  }

  console.log(`⚠️  Found ${negativeListings.length} listing(s) with negative stock:`);
  for (const l of negativeListings) {
    console.log(`   ID ${l.id} — "${l.item_name}" — stock: ${l.stock_quantity}`);
  }

  const result = await prisma.listings.updateMany({
    where: { stock_quantity: { lt: 0 } },
    data: { stock_quantity: 0 },
  });

  console.log(`✅ Fixed ${result.count} listing(s). All negative stock values set to 0.`);
}

fixNegativeStock()
  .catch((err) => {
    console.error("🔥 Error running fix:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
