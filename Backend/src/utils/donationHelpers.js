const prisma = require('../lib/prisma');

const PROOF_WINDOW_MS = 24 * 60 * 60 * 1000;

const DONATION_STATUS = {
  AVAILABLE: 'available',
  ACCEPTED: 'accepted',
  PROOF_PENDING: 'proof_pending',
  VERIFIED: 'verified',
  DELIVERY_UNCONFIRMED: 'delivery_unconfirmed',
};

/**
 * Flag proof_pending donations past the 24h window without a photo.
 */
async function flagExpiredProofDonations(filter = {}) {
  const now = new Date();
  const result = await prisma.donations.updateMany({
    where: {
      status: DONATION_STATUS.PROOF_PENDING,
      proof_deadline_at: { lt: now },
      proof_image_url: null,
      ...filter,
    },
    data: { status: DONATION_STATUS.DELIVERY_UNCONFIRMED },
  });
  return result.count;
}

async function updateImpactStats(donation) {
  const estimatedKg = donation.quantity * 0.5;
  const co2Saved = estimatedKg * 2.5;

  await prisma.impact_stats.upsert({
    where: { id: 1 },
    create: {
      meals_saved: donation.quantity,
      kg_rescued: estimatedKg,
      co2_reduced: co2Saved,
    },
    update: {
      meals_saved: { increment: donation.quantity },
      kg_rescued: { increment: estimatedKg },
      co2_reduced: { increment: co2Saved },
    },
  });
}

function formatDonationRow(d) {
  const now = new Date();
  let displayStatus = d.status;
  let hoursRemaining = null;

  if (
    d.status === DONATION_STATUS.PROOF_PENDING &&
    d.proof_deadline_at &&
    !d.proof_image_url
  ) {
    const msLeft = new Date(d.proof_deadline_at).getTime() - now.getTime();
    hoursRemaining = Math.max(0, Math.ceil(msLeft / (60 * 60 * 1000)));
    if (msLeft <= 0) {
      displayStatus = DONATION_STATUS.DELIVERY_UNCONFIRMED;
    }
  }

  return {
    id: d.id,
    listing_id: d.listing_id,
    quantity: d.quantity,
    status: d.status,
    display_status: displayStatus,
    created_at: d.created_at,
    accepted_at: d.accepted_at,
    picked_up_at: d.picked_up_at,
    proof_deadline_at: d.proof_deadline_at,
    proof_uploaded_at: d.proof_uploaded_at,
    proof_image_url: d.proof_image_url,
    hours_remaining: hoursRemaining,
    certificate_requested: d.certificate_requested || false,
    certificate_requested_at: d.certificate_requested_at || null,
    certificate_url: d.certificate_url || null,
    item_name: d.listings?.item_name || 'Surprise Bag',
    category: d.listings?.category || 'General',
    image_url: d.listings?.image_url || null,
    original_price: d.listings?.original_price || 0,
    rescue_deadline: d.listings?.rescue_deadline || null,
    ngo_expiry: d.listings?.ngo_expiry || null,
    store_name: d.listings?.users?.store_name || 'Unknown Store',
    store_phone: d.listings?.users?.phone || null,
    store_image: d.listings?.users?.profile_image || null,
    ngo_name: d.ngo?.full_name || null,
  };
}

module.exports = {
  PROOF_WINDOW_MS,
  DONATION_STATUS,
  flagExpiredProofDonations,
  updateImpactStats,
  formatDonationRow,
};
