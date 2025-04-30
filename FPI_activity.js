import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();
const wpApiUrl = process.env.WP_API_FPI_ACTIVITY;

const scrapeFPI= async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'accept-language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  });

  try {
    await page.goto('https://web.stockedge.com/fii-activity?section=fpi-sectoral-activity&asset-type=equity', {
      waitUntil: 'networkidle2',
      timeout: 180000
    });

    const dates = await page.evaluate(() => {
      const dateElements = document.querySelectorAll('se-date-label > ion-text');
      return Array.from(dateElements).map(el => el.textContent.trim());
    });

    console.log("Dates:", dates);

    const companiesData = await page.evaluate(() => {
      const rows = document.querySelectorAll('ion-item');
      const data = [];
      rows.forEach(row => {
        const CompanyName = row.querySelector('ion-text.ion-accordion-toggle-icon.normal-font.md')?.innerText.trim();
        const finalPrice = row.querySelector('ion-text.font-weight-medium.ion-color.ion-color-se.md')?.innerText.trim().replace(/,/g, '');
        if (CompanyName) {
          data.push({
            company: CompanyName,
            finalPrice: finalPrice
          });
        }
      });
      return data;
    });

    console.log('Company Rows:', companiesData);

    const allResults = [];
    companiesData.forEach(comp => {
      console.log(`\n${comp.company}:`);
      console.log(`${dates[dates.length - 1]}: ${comp.finalPrice}`);
      allResults.push({
        company: comp.company,
        date: dates[dates.length - 1],
        finalPrice: comp.finalPrice
      });
    });

    console.log('All Results:', allResults);
    for(const items of allResults){
      const wpData = { 
        company: items.company,
        date: items.date, 
        finalprice: items.finalPrice
       
      };
      
      const stored = await storeInWordPress(wpData);
      if (stored) {
        console.log(`Successfully stored "${items.company}" in WordPress.`);
      } else if(stored?.duplicate) {
        console.log(` Skipped duplicate: "${items.company}"`);
      } else {
        console.log(`Failed to store "${items.company}" in WordPress.`);
      }
    }

  } catch (error) {
    console.error("Failed to extract:", error.message);
  } finally {
    await browser.close();
  }
}

async function storeInWordPress(data) {
  try {
    const response = await axios.post(wpApiUrl, {
      company:data.company,
      date: data.date,
      finalprice: data.finalprice
      
    });

    console.log('Stored in WordPress:', response.data);
    return true;
  } catch (error) {
    console.error('WP API Error:', error.response?.data || error.message);
    return false;
  }
}


if (process.argv[1] === import.meta.url) {
  scrapeFPI();
}

export default scrapeFPI;