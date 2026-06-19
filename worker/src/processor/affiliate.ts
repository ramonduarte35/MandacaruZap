import axios from 'axios';

interface UserAffiliateConfig {
  amazonId?: string | null;
  shopeeId?: string | null;
  mercadolivreId?: string | null;
}

/**
 * Resolve encurtadores e redirecionamentos para obter a URL final real do produto.
 */
async function expandUrl(url: string): Promise<string> {
  const shortDomains = ['amzn.to', 'shp.ee', 'mercadolivre.co', 'meli.la', 't.co', 'bit.ly', 'tinyurl.com'];
  const parsedUrl = new URL(url);

  if (!shortDomains.some(domain => parsedUrl.hostname.includes(domain))) {
    return url;
  }

  try {
    // Tenta HEAD primeiro para performance
    const response = await axios.head(url, {
      maxRedirects: 5,
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const expanded = response.request.res.responseUrl || url;
    if (expanded.includes('account-verification') || expanded.includes('login') || expanded.includes('captcha')) {
      return url;
    }
    return expanded;
  } catch (error) {
    try {
      // Fallback para GET caso o servidor rejeite HEAD
      const response = await axios.get(url, {
        maxRedirects: 5,
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      const expanded = response.request.res.responseUrl || url;
      if (expanded.includes('account-verification') || expanded.includes('login') || expanded.includes('captcha')) {
        return url;
      }
      return expanded;
    } catch (err) {
      console.warn(`[Affiliate] Failed to expand URL: ${url}. Using original.`, err);
      return url;
    }
  }
}

/**
 * Converte a URL do produto inserindo a tag/parâmetro de afiliado do usuário.
 */
export async function convertToAffiliateLink(
  url: string,
  user: UserAffiliateConfig
): Promise<string> {
  const expandedUrl = await expandUrl(url);
  const parsedUrl = new URL(expandedUrl);
  const hostname = parsedUrl.hostname.toLowerCase();

  // --- AMAZON ---
  if (hostname.includes('amazon.com.br')) {
    const amazonTag = user.amazonId || 'default-amazon-20'; // Tag padrão ou do usuário
    
    // Procura o ASIN na URL (10 caracteres alfanuméricos começando por B ou números)
    const asinMatch = expandedUrl.match(/\/([A-Z0-9]{10})(?:[\/?]|$)/i);
    
    if (asinMatch && asinMatch[1]) {
      const asin = asinMatch[1];
      return `https://www.amazon.com.br/dp/${asin}?tag=${amazonTag}`;
    }
    
    // Fallback: Apenas anexa a tag se não achar o ASIN estruturado
    parsedUrl.searchParams.set('tag', amazonTag);
    return parsedUrl.toString();
  }

  // --- SHOPEE ---
  if (hostname.includes('shopee.com.br')) {
    const shopeeSubId = user.shopeeId || 'defaultshopee';
    
    // Remove parâmetros de rastreamento de terceiros
    const paramsToRemove = ['spm', 'smtt', 'utm_source', 'utm_medium', 'utm_campaign', 'cv_id'];
    paramsToRemove.forEach(p => parsedUrl.searchParams.delete(p));
    
    // O sistema de afiliados da Shopee permite o parâmetro sub_id ou customId para links diretos de afiliados
    parsedUrl.searchParams.set('sub_id', shopeeSubId);
    parsedUrl.searchParams.set('utm_source', 'whatsapp-bot');
    
    return parsedUrl.toString();
  }

  // --- MERCADO LIVRE ---
  if (hostname.includes('mercadolivre.com.br')) {
    const mlTag = user.mercadolivreId || 'defaultml';
    
    // Remove trackings anteriores
    const paramsToRemove = ['matt_tool', 'matt_word', 'matt_source', 'matt_campaign', 'utm_source', 'utm_medium', 'utm_campaign'];
    paramsToRemove.forEach(p => parsedUrl.searchParams.delete(p));
    
    // Mercado Livre Afiliados permite passar tracking por parametro dependendo da rede ou usar customId
    parsedUrl.searchParams.set('customId', mlTag);
    parsedUrl.searchParams.set('utm_source', 'whatsapp-bot');
    
    return parsedUrl.toString();
  }

  // Se não pertencer a nenhuma plataforma mapeada, retorna a URL limpa de parâmetros comuns de tracking
  const commonTrackers = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
  commonTrackers.forEach(p => parsedUrl.searchParams.delete(p));
  
  return parsedUrl.toString();
}
