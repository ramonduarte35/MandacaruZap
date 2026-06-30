/**
 * Definição central dos planos do MandacaruZap.
 *
 * Os limites aqui são a ÚNICA fonte de verdade para enforcement no backend.
 * Não colocar limites no banco de dados — eles mudam frequentemente e
 * precisam ser atualizados instantaneamente sem migrations.
 */

export type PlanId = 'FREE' | 'TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS';

export interface PlanLimits {
  maxInstances: number;    // máx de instâncias/números de WhatsApp
  maxMappings: number;     // máx de regras de mapeamento (grupo origem → destino)
  maxDailyMessages: number; // máx de mensagens enviadas por dia
  canUseOffers: boolean;   // pode usar a busca de Ofertas do Dia
  canUseTelegram: boolean; // pode usar integração com Telegram
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  FREE: {
    maxInstances: 0,
    maxMappings: 0,
    maxDailyMessages: 0,
    canUseOffers: false,
    canUseTelegram: false,
  },
  TRIAL: {
    // Mesmos limites do STARTER — usuário precisa sentir o valor antes de pagar
    maxInstances: 1,
    maxMappings: 3,
    maxDailyMessages: 30,
    canUseOffers: false,
    canUseTelegram: false,
  },
  STARTER: {
    maxInstances: 1,
    maxMappings: 3,
    maxDailyMessages: 30,
    canUseOffers: false,
    canUseTelegram: false,
  },
  PRO: {
    maxInstances: 3,
    maxMappings: 10,
    maxDailyMessages: 100,
    canUseOffers: true,
    canUseTelegram: true,
  },
  BUSINESS: {
    maxInstances: 10,
    maxMappings: 999, // ilimitado na prática
    maxDailyMessages: 500,
    canUseOffers: true,
    canUseTelegram: true,
  },
};

export const PLAN_NAMES: Record<PlanId, string> = {
  FREE: 'Gratuito',
  TRIAL: 'Trial (7 dias)',
  STARTER: 'Starter',
  PRO: 'Pro',
  BUSINESS: 'Business',
};

export const PLAN_PRICES_BRL: Record<PlanId, number | null> = {
  FREE: null,
  TRIAL: null,
  STARTER: 49,
  PRO: 99,
  BUSINESS: 199,
};

/**
 * Duração padrão do trial para novos usuários (em dias).
 */
export const TRIAL_DURATION_DAYS = 7;

/**
 * Retorna os limites do plano de um usuário.
 * Usa FREE como fallback se o plan não for reconhecido.
 */
export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.FREE;
}

/**
 * Verifica se o plano de um usuário está ativo (trial válido ou plano pago válido).
 */
export function isPlanActive(plan: string, trialEndsAt: Date | null, planExpiresAt: Date | null): boolean {
  const now = new Date();

  if (plan === 'FREE') return false;

  if (plan === 'TRIAL') {
    return trialEndsAt !== null && trialEndsAt > now;
  }

  // Planos pagos: se não tiver data de expiração, assume ativo indefinidamente
  if (!planExpiresAt) return true;
  return planExpiresAt > now;
}
