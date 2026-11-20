import { Router } from 'express';
import * as adminAnalytics from '../controllers/admin/analytics.controller.js';
import * as adminAuditLogs from '../controllers/admin/auditLogs.controller.js';
import * as adminBadges from '../controllers/admin/badges.controller.js';
import * as adminBanners from '../controllers/admin/banners.controller.js';
import * as adminChallenges from '../controllers/admin/challenges.controller.js';
import * as adminCommerce from '../controllers/admin/adminCommerce.controller.js';
import * as adminDestinations from '../controllers/admin/destinations.controller.js';
import * as adminItineraries from '../controllers/admin/itineraries.controller.js';
import * as adminModeration from '../controllers/admin/moderation.controller.js';
import * as adminPartner from '../controllers/admin/partner.controller.js';
import * as adminPartnerCommerce from '../controllers/admin/partnerCommerce.controller.js';
import * as adminPassportLogs from '../controllers/admin/passportLogs.controller.js';
import * as adminQr from '../controllers/admin/qr.controller.js';
import * as adminReviews from '../controllers/admin/reviews.controller.js';
import * as adminSystem from '../controllers/admin/system.controller.js';
import * as adminUpload from '../controllers/admin/upload.controller.js';
import * as adminUsers from '../controllers/admin/users.controller.js';
import * as aiController from '../controllers/ai.controller.js';
import * as auth from '../controllers/auth.controller.js';
import * as banners from '../controllers/banner.controller.js';
import * as destinations from '../controllers/destination.controller.js';
import * as footprints from '../controllers/footprint.controller.js';
import * as itineraries from '../controllers/itinerary.controller.js';
import * as passport from '../controllers/passport.controller.js';
import * as partnerPublic from '../controllers/partnerPublic.controller.js';
import * as qr from '../controllers/qr.controller.js';
import * as reviews from '../controllers/review.controller.js';
import * as safety from '../controllers/safety.controller.js';
import { requireAdmin, requireAuth, requireStaff } from '../middleware/auth.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { requireAiPlannerEnabled } from '../middleware/maintenance.js';
import { challengeLimiter, eventLimiter, loginLimiter, registerLimiter } from '../middleware/rateLimit.js';
import { isDatabaseReady } from '../config/db.js';

export function buildApiRouter(): Router {
  const api = Router();

  api.get('/health', (_req, res) => {
    const db = isDatabaseReady();
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', database: db ? 'connected' : 'disconnected' });
  });
  api.get('/csrf', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ csrfToken: issueCsrfToken(req, res) });
  });

  // Authentication
  api.post('/auth/register', registerLimiter, auth.register);
  api.post('/auth/login', loginLimiter, auth.login);
  api.post('/auth/logout', auth.logout);
  api.get('/auth/me', auth.me);
  api.patch('/auth/profile', requireAuth, auth.updateProfile);

  // AI Copilot, Voice Assistant & Visual Scene Search
  api.post('/ai/copilot', eventLimiter, requireAiPlannerEnabled, aiController.handleCopilotChat);
  api.post(
    '/ai/visual-search',
    eventLimiter,
    aiController.visualUploadMiddleware.single('image'),
    aiController.handleVisualSearch,
  );

  // Real-Time Safety Guardian (Weather, Accidents, Landslides & Safe Alternatives)
  api.post('/safety/check-itinerary', eventLimiter, safety.checkItinerarySafetyHandler);
  api.get('/safety/alerts', safety.listActiveAlertsHandler);
  api.post('/safety/alerts', requireStaff, safety.createSafetyAlertHandler);
  api.delete('/safety/alerts/:id', requireStaff, safety.deactivateSafetyAlertHandler);

  // Homepage banners / sponsored covers (active + within schedule only)
  api.get('/banners', banners.listPublicBanners);
  api.post('/banners/:id/click', eventLimiter, banners.recordBannerClick);

  // Destinations (published only)
  api.get('/destinations', destinations.listDestinations);
  api.get('/destinations/recommended', destinations.listRecommendedDestinations);
  api.get('/destinations/nearby', destinations.listNearbyDestinations);
  api.post('/destinations/:id/check-in', challengeLimiter, destinations.checkInDestinationGps);
  api.get('/destinations/:slug', destinations.getDestination);
  api.get('/destinations/:slug/related', destinations.getRelatedDestinations);
  api.get('/destinations/:slug/vouchers', partnerPublic.listDestinationVouchers);
  api.post('/destinations/:slug/inquiries', eventLimiter, partnerPublic.createGroupInquiry);
  api.post('/vouchers/:id/claim', requireAuth, challengeLimiter, partnerPublic.claimDestinationVoucher);
  api.post('/events/destination-view', eventLimiter, destinations.recordDestinationView);

  // Destination Reviews & Ratings (Google Maps style)
  api.get('/destinations/:idOrSlug/reviews', reviews.listReviews);
  api.post('/destinations/:idOrSlug/reviews', eventLimiter, reviews.createReview);
  api.post('/reviews/:reviewId/like', eventLimiter, reviews.likeReview);
  api.post('/reviews/:reviewId/report', eventLimiter, reviews.reportReview);

  // Trip Planner V9 (AI & Manual + Valhalla routing + Replan)
  api.get('/trip-planner/health', itineraries.getTripPlannerHealth);
  api.get('/trip-planner/places', itineraries.listTripPlannerPlaces);
  api.post('/trip-planner/recommend', eventLimiter, requireAiPlannerEnabled, itineraries.recommendTripPlanner);
  api.post('/trip-planner/itinerary', eventLimiter, requireAiPlannerEnabled, itineraries.planTripV9);

  // Itineraries
  api.post('/itineraries/generate', eventLimiter, requireAiPlannerEnabled, itineraries.generateItinerary);
  api.post('/itineraries', requireAuth, itineraries.createItinerary);
  api.get('/itineraries/my', requireAuth, itineraries.listMyItineraries);
  api.get('/itineraries/:id', requireAuth, itineraries.getItinerary);
  api.patch('/itineraries/:id', requireAuth, itineraries.updateItinerary);
  api.post('/itineraries/:id/replan', requireAuth, eventLimiter, itineraries.replanItinerary);
  api.delete('/itineraries/:id', requireAuth, itineraries.deleteItinerary);

  // QR & challenges
  api.get('/qr/:code', qr.getQrContent);
  api.post('/qr/:code/scan', eventLimiter, qr.recordQrScan);
  api.post('/qr/:code/check-in', challengeLimiter, qr.checkInAtQr);
  api.get('/challenges/:id', qr.getChallenge);
  api.post('/challenges/:id/complete', challengeLimiter, qr.completeChallenge);

  // Passport & favorites
  api.get('/passport/me', passport.getMyPassport);
  api.get('/passport/vouchers', requireAuth, partnerPublic.listMyVoucherClaims);
  api.post('/passport/claim', requireAuth, passport.claimDevicePassport);
  api.get('/footprints', footprints.listFootprintsHandler);
  api.post('/footprints/sync', eventLimiter, footprints.syncFootprintsHandler);
  api.delete('/footprints/:clientId', footprints.deleteFootprintHandler);
  api.get('/favorites', requireAuth, passport.listFavorites);
  api.post('/favorites/:destinationId', requireAuth, passport.addFavorite);
  api.delete('/favorites/:destinationId', requireAuth, passport.removeFavorite);

  // Staff (admin + partner)
  const admin = Router();
  admin.use(requireStaff);

  // Analytics: Admin views overall system
  admin.get('/analytics', requireAdmin, adminAnalytics.getAnalytics);
  admin.get('/analytics/export', requireAdmin, adminAnalytics.exportAdminAnalyticsCsv);

  // Centralized Moderation Queue, Safety Oversight & Commerce Oversight (Admin only)
  admin.get('/moderation/summary', requireAdmin, adminModeration.getModerationSummary);
  admin.patch('/destinations/:id/review', requireAdmin, adminModeration.reviewDestination);
  admin.get('/safety-alerts', requireAdmin, safety.listAllAlertsAdminHandler);
  admin.get('/commerce/overview', requireAdmin, adminCommerce.getAdminCommerceOverview);
  admin.patch('/commerce/vouchers/:id/status', requireAdmin, adminCommerce.adminTogglePartnerVoucher);

  // Media Upload (Staff: Admin & Partner, rate-limited + magic-bytes verified)
  admin.post('/upload', eventLimiter, adminUpload.uploadMiddleware.single('file'), adminUpload.handleSingleUpload);
  admin.post('/upload/multiple', eventLimiter, adminUpload.uploadMiddleware.array('files', 10), adminUpload.handleMultipleUpload);

  // Destinations management (Staff)
  admin.get('/destinations', adminDestinations.listAdminDestinations);
  admin.post('/destinations', adminDestinations.createDestination);
  admin.get('/destinations/:id', adminDestinations.getAdminDestination);
  admin.patch('/destinations/:id', adminDestinations.updateDestination);
  admin.delete('/destinations/:id', adminDestinations.deleteDestination);

  // Reviews management (Staff: Admin & Partner)
  admin.get('/reviews', adminReviews.listAdminReviews);
  admin.post('/reviews/:id/respond', adminReviews.respondReview);
  admin.delete('/reviews/:id/respond', adminReviews.deleteReviewResponse);
  admin.patch('/reviews/:id/status', adminReviews.updateReviewStatus);
  admin.delete('/reviews/:id', adminReviews.deleteReview);

  // Partner Dedicated Hub (Operational control, full scoped CRUD, Alerts, Export, Audit & AI)
  admin.get('/partner/overview', adminPartner.getPartnerOverview);
  admin.patch('/partner/destination/status', adminPartner.toggleOperationalStatus);
  admin.post('/partner/challenges', adminPartner.createPartnerChallenge);
  admin.patch('/partner/challenges/:id', adminPartner.updatePartnerChallenge);
  admin.delete('/partner/challenges/:id', adminPartner.deletePartnerChallenge);
  admin.post('/partner/qr', adminPartner.createPartnerQr);
  admin.patch('/partner/qr/:id', adminPartner.updatePartnerQr);
  admin.delete('/partner/qr/:id', adminPartner.deletePartnerQr);
  admin.get('/partner/qr/:id/image', adminPartner.getPartnerQrImage);
  admin.post('/partner/badges', adminPartner.createPartnerBadge);
  admin.patch('/partner/badges/:id', adminPartner.updatePartnerBadge);
  admin.delete('/partner/badges/:id', adminPartner.deletePartnerBadge);
  admin.get('/partner/alerts', adminPartner.listPartnerAlerts);
  admin.post('/partner/alerts', adminPartner.createPartnerAlert);
  admin.delete('/partner/alerts/:id', adminPartner.deactivatePartnerAlert);
  admin.get('/partner/export', adminPartner.exportPartnerReportCsv);
  admin.get('/partner/audit-logs', adminPartner.listPartnerAuditLogs);
  admin.post('/partner/ai/generate-challenge', eventLimiter, adminPartner.generatePartnerChallengeDraft);
  admin.post('/partner/ai/suggest-review-reply', eventLimiter, adminPartner.suggestPartnerReviewReply);

  // Partner Hub Đợt 2: Vouchers & Counter Redemption, Service Catalog, Group Inquiries, Promo Banner Submissions
  admin.get('/partner/vouchers/lookup', adminPartnerCommerce.lookupPartnerVoucherClaim);
  admin.post('/partner/vouchers/redeem', adminPartnerCommerce.redeemPartnerVoucherClaim);
  admin.get('/partner/vouchers', adminPartnerCommerce.listPartnerVouchers);
  admin.post('/partner/vouchers', adminPartnerCommerce.createPartnerVoucher);
  admin.patch('/partner/vouchers/:id', adminPartnerCommerce.updatePartnerVoucher);
  admin.delete('/partner/vouchers/:id', adminPartnerCommerce.deletePartnerVoucher);

  admin.get('/partner/services', adminPartnerCommerce.listPartnerServices);
  admin.post('/partner/services', adminPartnerCommerce.createPartnerService);
  admin.patch('/partner/services/:serviceId', adminPartnerCommerce.updatePartnerService);
  admin.delete('/partner/services/:serviceId', adminPartnerCommerce.deletePartnerService);

  admin.get('/partner/inquiries', adminPartnerCommerce.listPartnerInquiries);
  admin.patch('/partner/inquiries/:id', adminPartnerCommerce.updatePartnerInquiry);

  admin.get('/partner/banners', adminPartnerCommerce.listPartnerBanners);
  admin.post('/partner/banners', adminPartnerCommerce.submitPartnerBanner);
  admin.delete('/partner/banners/:id', adminPartnerCommerce.withdrawPartnerBanner);

  // Audit Logs (Admin only)
  admin.get('/audit-logs', requireAdmin, adminAuditLogs.listAuditLogs);
  admin.get('/audit-logs/stats', requireAdmin, adminAuditLogs.getAuditLogStats);
  admin.get('/audit-logs/export', requireAdmin, adminAuditLogs.exportAuditLogsCsv);

  // Badges & Achievements management (Admin only)
  admin.get('/badges', requireAdmin, adminBadges.listBadges);
  admin.post('/badges', requireAdmin, adminBadges.createBadge);
  admin.get('/badges/analytics', requireAdmin, adminBadges.getBadgeAnalytics);
  admin.get('/badges/:id', requireAdmin, adminBadges.getBadge);
  admin.patch('/badges/:id', requireAdmin, adminBadges.updateBadge);
  admin.delete('/badges/:id', requireAdmin, adminBadges.deleteBadge);

  // QR codes management (Admin only)
  admin.get('/qr', requireAdmin, adminQr.listQrCodes);
  admin.post('/qr', requireAdmin, adminQr.createQrCode);
  admin.get('/qr/:id', requireAdmin, adminQr.getQrCode);
  admin.patch('/qr/:id', requireAdmin, adminQr.updateQrCode);
  admin.get('/qr/:id/image', requireAdmin, adminQr.getQrImage);

  // Challenges management (Admin only)
  admin.get('/challenges', requireAdmin, adminChallenges.listAdminChallenges);
  admin.post('/challenges', requireAdmin, adminChallenges.createChallenge);
  admin.get('/challenges/:id', requireAdmin, adminChallenges.getAdminChallenge);
  admin.put('/challenges/:id', requireAdmin, adminChallenges.updateChallenge);
  admin.patch('/challenges/:id/status', requireAdmin, adminChallenges.updateChallengeStatus);
  admin.delete('/challenges/:id', requireAdmin, adminChallenges.deleteChallenge);

  // Banners management (Admin only)
  admin.get('/banners', requireAdmin, adminBanners.listBanners);
  admin.post('/banners', requireAdmin, adminBanners.createBanner);
  admin.get('/banners/:id', requireAdmin, adminBanners.getBanner);
  admin.patch('/banners/:id', requireAdmin, adminBanners.updateBanner);
  admin.patch('/banners/:id/review', requireAdmin, adminBanners.reviewPartnerBanner);
  admin.delete('/banners/:id', requireAdmin, adminBanners.deleteBanner);

  // Users & Permissions management (Admin only)
  admin.get('/users', requireAdmin, adminUsers.listUsers);
  admin.post('/users', requireAdmin, adminUsers.createUser);
  admin.patch('/users/:id/role', requireAdmin, adminUsers.updateUserRole);
  admin.patch('/users/:id/status', requireAdmin, adminUsers.updateUserStatus);
  admin.post('/users/:id/reset-password', requireAdmin, adminUsers.resetUserPassword);
  admin.put('/users/:id/destinations', requireAdmin, adminUsers.assignPartnerDestinations);
  admin.delete('/users/:id', requireAdmin, adminUsers.deleteUser);

  // Tourist Itineraries management (Admin only)
  admin.get('/itineraries', requireAdmin, adminItineraries.listAdminItineraries);
  admin.get('/itineraries/:id', requireAdmin, adminItineraries.getAdminItinerary);
  admin.delete('/itineraries/:id', requireAdmin, adminItineraries.deleteAdminItinerary);

  // Passport & Activity logs (Admin only)
  admin.get('/passport-logs', requireAdmin, adminPassportLogs.listPassportLogs);
  admin.get('/passport-logs/export', requireAdmin, adminPassportLogs.exportPassportLogsCsv);

  // System Health & Settings (Admin only)
  admin.get('/system/status', requireAdmin, adminSystem.getSystemStatus);
  admin.get('/system/settings', requireAdmin, adminSystem.getSystemSettings);
  admin.put('/system/settings', requireAdmin, adminSystem.updateSystemSettings);

  // Public announcement & info
  api.get('/system/announcement', adminSystem.getPublicAnnouncement);

  api.use('/admin', admin);
  return api;
}
