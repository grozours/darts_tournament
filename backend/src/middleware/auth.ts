import { auth } from 'express-oauth2-jwt-bearer';
import { config } from '../config/environment';

export const requireAuth = auth({
  audience: config.auth.audience,
  issuerBaseURL: config.auth.issuerBaseURL,
  tokenSigningAlg: 'RS256',
});