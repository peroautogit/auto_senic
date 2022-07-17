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
  "https://www.njuskalo.hr/prodaja-kuca",
  "https://www.njuskalo.hr/prodaja-stanova",
];

const runTask = async () => {
  // for (let url of urls) {
  //   await runPuppeteer(url);
  // }
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
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

  console.log("going to njuskalo on link" + url);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const htmlString = await page.content();
  console.log("ovo je html string" + htmlString);
  const dom = new jsdom.JSDOM(htmlString);
  console.log("ovo je dom" + dom.inneerHtml);
  console.log("parsing njuskalo.hr data");
  const result = dom.window.document.querySelectorAll(
    ".EntityList-item--Regular"
  );
  // for (let i = 0, element; (element = result[i]); i++) {
  //   console.log("ovo je element" + element.innerHTML);
  // }

  for (const element of result) {
    const urlPath = element?.querySelectorAll("a")?.[0]?.href;
    console.log("Ovo je urlpath " + "/n" + urlPath);
    let path = urlPath;
    if (!path.includes("https://www.njuskalo.hr")) {
      path = `https://www.njuskalo.hr${urlPath}`;
    }
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
