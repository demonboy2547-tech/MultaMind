import { FREE_MODELS } from './models.free';
import { PRO_MODELS } from './models.pro';

export function getModelsForPlan(plan: 'free' | 'pro') {
  return plan === 'pro' ? PRO_MODELS : FREE_MODELS;
}
