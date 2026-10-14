import { Router } from 'express';
import * as adminAnalytics from '../controllers/admin/analytics.controller.js';
import * as adminBanners from '../controllers/admin/banners.controller.js';
import * as adminChallenges from '../controllers/admin/challenges.controller.js';
import * as adminDestinations from '../controllers/admin/destinations.controller.js';
import * as adminQr from '../controllers/admin/qr.controller.js';
import * as auth from '../controllers/auth.controller.js';
import * as banners from '../controllers/banner.controller.js';
import * as destinations from '../controllers/destination.controller.js';
import * as itineraries from '../controllers/itinerary.controller.js';
import * as passport from '../controllers/passport.controller.js';
import * as qr from '../controllers/qr.controller.js';
import { requireAdmin, requireAuth, requireStaff } from '../middleware/auth.js';
import { issueCsrfToken } from '../middleware/csrf.js';
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

  // Homepage banners / sponsored covers (active + within schedule only)
  api.get('/banners', banners.listPublicBanners);
  api.post('/banners/:id/click', eventLimiter, banners.recordBannerClick);

  // Destinations (published only)
  api.get('/destinations', destinations.listDestinations);
  api.get('/destinations/recommended', destinations.listRecommendedDestinations);
  api.get('/destinations/:slug', destinations.getDestination);
  api.get('/destinations/:slug/related', destinations.getRelatedDestinations);
  api.post('/events/destination-view', eventLimiter, destinations.recordDestinationView);

  // Itineraries
  api.post('/itineraries/generate', eventLimiter, itineraries.generateItinerary);
  api.post('/itineraries', requireAuth, itineraries.createItinerary);
  api.get('/itineraries/my', requireAuth, itineraries.listMyItineraries);
  api.get('/itineraries/:id', requireAuth, itineraries.getItinerary);
  api.patch('/itineraries/:id', requireAuth, itineraries.updateItinerary);
  api.delete('/itineraries/:id', requireAuth, itineraries.deleteItinerary);

  // QR & challenges
  api.get('/qr/:code', qr.getQrContent);
  api.post('/qr/:code/scan', eventLimiter, qr.recordQrScan);
  api.post('/qr/:code/check-in', challengeLimiter, qr.checkInAtQr);
  api.get('/challenges/:id', qr.getChallenge);
  api.post('/challenges/:id/complete', challengeLimiter, qr.completeChallenge);

  // Passport & favorites
  api.get('/passport/me', passport.getMyPassport);
  api.post('/passport/claim', requireAuth, passport.claimDevicePassport);
  api.get('/favorites', requireAuth, passport.listFavorites);
  api.post('/favorites/:destinationId', requireAuth, passport.addFavorite);
  api.delete('/favorites/:destinationId', requireAuth, passport.removeFavorite);

  // Staff (admin + partner) can manage destinations. Analytics, QR, challenges and banners stay admin-only.
  const admin = Router();
  admin.use(requireStaff);
  admin.get('/analytics', requireAdmin, adminAnalytics.getAnalytics);

  admin.get('/destinations', adminDestinations.listAdminDestinations);
  admin.post('/destinations', adminDestinations.createDestination);
  admin.get('/destinations/:id', adminDestinations.getAdminDestination);
  admin.patch('/destinations/:id', adminDestinations.updateDestination);
  admin.delete('/destinations/:id', adminDestinations.deleteDestination);

  admin.get('/qr', requireAdmin, adminQr.listQrCodes);
  admin.post('/qr', requireAdmin, adminQr.createQrCode);
  admin.get('/qr/:id', requireAdmin, adminQr.getQrCode);
  admin.patch('/qr/:id', requireAdmin, adminQr.updateQrCode);
  admin.get('/qr/:id/image', requireAdmin, adminQr.getQrImage);

  admin.get('/challenges', requireAdmin, adminChallenges.listAdminChallenges);
  admin.post('/challenges', requireAdmin, adminChallenges.createChallenge);
  admin.get('/challenges/:id', requireAdmin, adminChallenges.getAdminChallenge);
  admin.put('/challenges/:id', requireAdmin, adminChallenges.updateChallenge);
  admin.patch('/challenges/:id/status', requireAdmin, adminChallenges.updateChallengeStatus);
  admin.delete('/challenges/:id', requireAdmin, adminChallenges.deleteChallenge);

  admin.get('/banners', requireAdmin, adminBanners.listBanners);
  admin.post('/banners', requireAdmin, adminBanners.createBanner);
  admin.get('/banners/:id', requireAdmin, adminBanners.getBanner);
  admin.patch('/banners/:id', requireAdmin, adminBanners.updateBanner);
  admin.delete('/banners/:id', requireAdmin, adminBanners.deleteBanner);

  api.use('/admin', admin);
  return api;
}
