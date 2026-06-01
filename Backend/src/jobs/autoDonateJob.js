const prisma = require('../lib/prisma');

/**
 * Auto-Donation Job
 * 
 * Runs periodically to check for surprise bag listings that have:
 * - auto_donate = true
 * - rescue_deadline has passed (compared to current time)
 * - stock_quantity > 0
 * - is_active = true
 * 
 * When found, it:
 * 1. Creates a donation record with status "available"
 * 2. Deactivates the listing (is_active = false)
 */

async function runAutoDonateCheck() {
  try {
    const now = new Date();
    console.log(`\n⏰ [Auto-Donate] Running check at ${now.toISOString()}`);

    // Find all listings with auto_donate enabled and deadline passed
    const expiredCandidates = await prisma.listings.findMany({
      where: {
        auto_donate: true,
        is_active: true,
        stock_quantity: { gt: 0 },
        rescue_deadline: { 
          not: null,
          lte: now 
        },
      },
      include: {
        users: { select: { store_name: true } },
      },
    });

    if (expiredCandidates.length === 0) {
      console.log('⏰ [Auto-Donate] No expired candidates found.');
      return;
    }

    let donatedCount = 0;

    for (const listing of expiredCandidates) {
      console.log(`🔄 [Auto-Donate] Listing #${listing.id} "${listing.item_name}" from "${listing.users?.store_name}" — deadline expired. Creating donation...`);

      // Create a donation record
      await prisma.donations.create({
        data: {
          listing_id: listing.id,
          quantity: listing.stock_quantity,
          status: 'available',
        },
      });

      // Deactivate the listing
      await prisma.listings.update({
        where: { id: listing.id },
        data: { is_active: false },
      });

      donatedCount++;
    }

    console.log(`⏰ [Auto-Donate] Completed. ${donatedCount} listing(s) auto-donated.`);
  } catch (error) {
    console.error('🚨 [Auto-Donate] Job Error:', error.message);
  }
}

/**
 * Start the auto-donate cron job.
 * Runs every 5 minutes.
 */
function startAutoDonateJob() {
  const INTERVAL_MS = 30 * 1000; // 30 seconds
  
  console.log('⏰ [Auto-Donate] Job scheduled — checking every 30 seconds.');
  
  // Run once immediately on startup
  runAutoDonateCheck();

  // Then run on interval
  setInterval(runAutoDonateCheck, INTERVAL_MS);
}

module.exports = { startAutoDonateJob, runAutoDonateCheck };
