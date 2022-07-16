require("dotenv").config();
const { writeFileSync, readFileSync } = require("fs");
const puppeteer = require("puppeteer");
const jsdom = require("jsdom");
const nodeFetch = require("node-fetch");

const WIDTH = 1920;
const HEIGHT = 1080;

const data = readFileSync("db.json", { encoding: "utf8", flag: "r" });
const pastResults = new Set(JSON.parse(data) || []);
console.log("pastResults:", pastResults);
const newResults = new Set();
const houses = [];
const { CHAT_ID, BOT_API } = process.env;

const urls = [
  "https://www.njuskalo.hr/prodaja-stanova?geo%5BlocationIds%5D=1248%2C1250%2C1252%2C1262%2C1261&price%5Bmax%5D=200000",
  "https://www.njuskalo.hr/prodaja-kuca/zagreb?price%5Bmax%5D=200000",
  "https://www.njuskalo.hr/prodaja-stanova/labin?price%5Bmax%5D=200000",
  "https://www.njuskalo.hr/prodaja-stanova/pula?price%5Bmax%5D=200000",
];

const runTask = async () => {
  for (const url of urls) {
    await runPuppeteer(url);
  }

  console.log("newResults:", newResults);

  if (newResults.size > 0) {
    writeFileSync(
      "db.json",
      JSON.stringify(Array.from([...newResults, ...pastResults]))
    );

    console.log("sending messages to Telegram");
    houses.forEach(({ path }) => {
      let glava = `Nova nekretnina na njuškalu: [click here](${path})`;
      nodeFetch(`https://api.telegram.org/bot${BOT_API}/sendMessage`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: glava,
          chat_id: CHAT_ID,
          parse_mode: "markdown",
        }),
      })
        .then((response) => response.json())
        .then((response) => console.log(response))
        .catch((err) => console.error(err));
    });
  }
};

const runPuppeteer = async (url) => {
  console.log("opening headless browser");
  const browser = await puppeteer.launch({
    headless: true,
    args: [`--window-size=${WIDTH},${HEIGHT}`],
    defaultViewport: {
      width: WIDTH,
      height: HEIGHT,
    },
  });

  const page = await browser.newPage();
  // https://stackoverflow.com/a/51732046/4307769 https://stackoverflow.com/a/68780400/4307769
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36"
  );

  console.log("going to njuskalo");
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const htmlString = await page.content();
  const dom = new jsdom.JSDOM(htmlString);

  console.log("parsing njuskalo.hr data");
  const result = dom.window.document.querySelectorAll(".EntityList.EntityList--Standard.EntityList--Regular.EntityList--ListItemRegularAd"); // do tuda radi kako treba, neznam sta tu treeba hvatat
  console.log({result});
  for (const element of result) {
    const urlPath = element?.querySelectorAll("a")?.[0]?.href; 
    console.log({urlPath});

    let path = urlPath;
    if (!path.includes("https://www.njuskalo.hr")) {
      path = `https://www.njuskalo.hr${urlPath}`;
    }
    console.log({urlPath});
    path = path.replace("?navigateSource=resultlist", ""); 
    if (path && !pastResults.has(path) && !newResults.has(path)) {
      newResults.add(path);
      houses.push({
        path,
      });
    }
  }

  console.log("closing browser");
  await browser.close();
};

if (CHAT_ID && BOT_API) {
  runTask();
} else {
  console.log("Missing Telegram API keys!");
}
