import axios from 'axios';
import * as cheerio from 'cheerio';
import { convertToAffiliateLink } from './processor/affiliate.js';
import { scrapeProductData } from './processor/scraper.js';

async function testDetail2() {
  const url = 'https://meli.la/1wbKLZK';
  console.log(`Testing link: ${url}`);

  const userMock = { 
    mercadolivreId: 'test_ml_aff',
    mercadolivreChannel: 'ramonduarte1',
    mercadolivreTool: '85424440',
    mercadolivreWord: 'ramonduarte',
    mercadolivreCookie: 'ssid=mock_ssid_for_test; _csrf=mock_csrf_for_test'
  };
  
  try {
    const convertedUrl = await convertToAffiliateLink(url, userMock);
    console.log(`Expanded URL: ${convertedUrl}`);

    const res = await axios.get(convertedUrl, {
      headers: {
        'User-Agent': 'WhatsApp/2.24.4.76 A',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const $ = cheerio.load(res.data);

    console.log("\n=== OG PROPERTIES ===");
    console.log("og:title:", $('meta[property="og:title"]').attr('content'));
    console.log("og:description:", $('meta[property="og:description"]').attr('content'));
    console.log("product:price:amount:", $('meta[property="product:price:amount"]').attr('content'));

    console.log("\n=== MONEY AMOUNT SELECTORS ===");
    console.log("andes-money-amount fraction:", $('.andes-money-amount__fraction').first().text());
    console.log("andes-money-amount cents:", $('.andes-money-amount__cents').first().text());
    console.log("price-tag-fraction:", $('.price-tag-fraction').first().text());

    const result = await scrapeProductData(convertedUrl);
    console.log("\n=== SCRAPED RESULT ===");
    console.log(result);

  } catch (err: any) {
    console.error("Error inspecting URL:", err.message);
  }
}

testDetail2();
