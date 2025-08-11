import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs'
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv'
dotenv.config()

const delay = ms => new Promise(res => setTimeout(res, ms));

const delayForParsing = +process.env.DELAY
console.log(delayForParsing)

const dataFilePath = "./data.json"
let clothes = {}
let chat = {
  id: 0
}

if (fs.existsSync(dataFilePath)) {
  try {
    const data = fs.readFileSync(dataFilePath, 'utf8');
    const jsonData = JSON.parse(data);

    if (!jsonData.clothes || jsonData.chat?.id === undefined) {
      fs.writeFileSync(dataFilePath, '{"clothes": {}, "chat": {"id": 0}}');
      clothes = {}
      chat = { id: 0 }
    }

    clothes = jsonData.clothes
    chat = jsonData.chat
    console.log(`loaded ${chat.id}: `, clothes)
  } catch (error) {
    fs.writeFileSync(dataFilePath, '{"clothes": {}, "chat": {"id": 0}}')
    clothes = {}
    chat = { id: 0 }
    console.log(`File "${dataFilePath}" was created.`);
  }
} else {
  try {
    // Create an empty file
    fs.writeFileSync(dataFilePath, '{"clothes": {}, "chat": {"id": 0}}')
    clothes = {}
    chat = { id: 0 }

    console.log(`File "${dataFilePath}" was created.`);
  } catch (error) {
    console.error('Failed to create the file:', error);
  }
}

const writeClothesSync = () => {
  const jsonString = JSON.stringify({ clothes, chat: { id: chat.id } })
  try {
    // 4. Write the string to the file synchronously
    fs.writeFileSync(dataFilePath, jsonString);
    console.log(`Successfully wrote object to ${dataFilePath}`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Initialize your bot
const bot = new Telegraf("7987987473:AAEnnlebZV320cFD-vgJi_iQU_0BB5VnkCg");
// Handle the /add command
bot.command('start', (ctx) => {
  // Get the text that comes after the command
  chat = { id: ctx.message.chat.id }
  writeClothesSync(clothes)

  ctx.reply(`Your chat_id ${chat.id} was set as receiver`);
});

bot.command('add', (ctx) => {
  // Get the text that comes after the command
  const [command, name, url, sizesStr] = ctx.message.text.split(' ');


  if (!name || !url || !sizesStr) {
    return ctx.reply('Usage: /add name url [size,size,size]');
  }

  if (sizesStr[0] !== "[" || sizesStr[sizesStr.length - 1] !== "]") {
    return ctx.reply('Invalid sizes, should be [size,size,size]');
  }
  const sizes = sizesStr.slice(1, sizesStr.length - 1).split(",")
  console.log("sizes: ", sizes)

  clothes[name] = {
    url,
    sizes
  };

  console.log(clothes)
  writeClothesSync(clothes)
  ctx.reply(`Added data: ${name} = ${sizesStr}`);
});

bot.command('delete', (ctx) => {
  // Get the text that comes after the command
  const [command, name] = ctx.message.text.split(' ');

  if (!name) {
    return ctx.reply('Usage: /delete name');
  }
  if (!clothes[name]) {
    return ctx.reply(`No clothes with name ${name}`);
  }

  delete clothes[name];

  writeClothesSync(clothes)
  ctx.reply(`Cloth ${name} successfully deleted`);
});

bot.command('get_all', (ctx) => {
  // Get the text that comes after the command
  let finalMessage = "Your clothes \n"
  for (const [name, data] of Object.entries(clothes)) {
    finalMessage += `${name}: [${data.sizes}] \n ${data.url} \n`
    finalMessage += "==========================================\n"
  }

  writeClothesSync(clothes)
  ctx.reply(finalMessage);
});

bot.launch()


puppeteer.use(StealthPlugin());

const getAvailableSizes = async (browser, url) => {
  const page = await browser.newPage();

  // 1. Navigate to the page
  await page.goto(url);

  // 2. Wait for a specific selector to appear, ensuring content is rendered
  // Replace '.your-content-selector' with the actual CSS selector for the content you want
  await page.waitForSelector(".product-actions__action--add-to-cart");
  await delay(2000);

  // 3. Extract the data
  const data = await page.evaluate(() => {
    const sizeBlocks = Array.from(document.querySelectorAll('.size-selector-desktop-pdp__sizes li:not(.is-csbs) .text'));
    //const sizeBlocks = Array.from(document.querySelectorAll('.size-selector-desktop-pdp__sizes li .text'));
    return sizeBlocks.map(item => item.textContent?.trim(" "));
  });

  page.close()

  return data
}

const getMatchingSizes = (existingSizes, requiringSizes) => {
  console.log(existingSizes)
  console.log(requiringSizes)
  const lowercasedRequiring = Array.from(requiringSizes).map(size => size.toLowerCase())
  const requiringSizesSet = new Set(Array.from(lowercasedRequiring))

  const matchedSizes = []
  for (let size of existingSizes) {
    if (requiringSizesSet.has(size.toLowerCase())) {
      matchedSizes.push(size.toLowerCase())
    }
  }

  return matchedSizes

}

let browser = await puppeteer.launch({ headless: !!process.env.HEADLESS });

const parseSizes = async () => {

  for (const [name, data] of Object.entries(clothes)) {
    try {
      if (!browser) continue;
      let sizes = await getAvailableSizes(browser, data.url)
      const matchedSizes = getMatchingSizes(sizes, data.sizes)
      if (matchedSizes.length > 0) {
        await bot.telegram.sendMessage(chat.id, `Found size for ${name}: [${matchedSizes}] \n Url: ${data.url}`);
      }
    } catch (e) {
      console.log(`Error while parsing ${name} ${data.url} ${data.sizes}`, e)
    }

  }
}


async function main() {
  parseSizes(browser)
  setInterval(() => parseSizes(browser), delayForParsing)

  setInterval(() => {
    (async function() {
      await browser.close()
      browser = await puppeteer.launch({ headless: !!process.env.HEADLESS });
    })();
  }, 30 * 60 * 1000)
};

await main()

//PIVO
//PIVO
//PIVO
//PIVO
