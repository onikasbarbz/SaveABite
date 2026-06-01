const { flagExpiredProofDonations } = require('../utils/donationHelpers');

/**
 * Flags proof_pending donations without a photo after 24 hours.
 */
async function runDonationProofCheck() {
  try {
    const count = await flagExpiredProofDonations();
    if (count > 0) {
      console.log(`⏰ [Donation-Proof] Flagged ${count} donation(s) as delivery_unconfirmed.`);
    }
  } catch (error) {
    console.error('🚨 [Donation-Proof] Job Error:', error.message);
  }
}

function startDonationProofJob() {
  const INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
  console.log('⏰ [Donation-Proof] Job scheduled — checking every 15 minutes.');
  runDonationProofCheck();
  setInterval(runDonationProofCheck, INTERVAL_MS);
}

module.exports = { startDonationProofJob, runDonationProofCheck };
