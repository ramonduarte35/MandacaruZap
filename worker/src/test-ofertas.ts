import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function testScrape() {
  const url = 'https://www.mercadolivre.com.br/ofertas';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
  };

  try {
    const html = fs.readFileSync('ofertas.html', 'utf8');
    const $ = cheerio.load(html);
    
    const productLinks: any[] = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && (href.includes('/p/') || href.includes('produto.mercadolivre.com.br/'))) {
        const title = $(el).text().trim() || $(el).attr('title');
        const parentClasses = $(el).parent().attr('class');
        const grandParentClasses = $(el).parent().parent().attr('class');
        productLinks.push({ href: href.substring(0, 50) + '...', title: title?.substring(0, 30), parentClasses, grandParentClasses });
      }
    });

    console.log(`Found ${productLinks.length} product links.`);
    if (productLinks.length > 0) {
      console.log('First 5 links:', productLinks.slice(0, 5));
    }
  } catch (error: any) {
    console.error('Error fetching:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testScrape();
