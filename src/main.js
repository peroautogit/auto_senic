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
const cars = [];
const { CHAT_ID, BOT_API } = process.env;
const urls = [
  "https://www.avto.net/Ads/results.asp?znamka=Renault&model=Scenic&modelID=&tip=&znamka2=&model2=&tip2=&znamka3=&model3=&tip3=&cenaMin=0&cenaMax=999999&letnikMin=2004&letnikMax=2011&bencin=0&starost2=999&oblika=&ccmMin=0&ccmMax=99999&mocMin=&mocMax=&kmMin=0&kmMax=9999999&kwMin=0&kwMax=999&motortakt=&motorvalji=&lokacija=0&sirina=&dolzina=&dolzinaMIN=&dolzinaMAX=&nosilnostMIN=&nosilnostMAX=&lezisc=&presek=&premer=&col=&vijakov=&EToznaka=&vozilo=&airbag=&barva=&barvaint=&EQ1=1000000000&EQ2=1000000000&EQ3=1000000000&EQ4=100000000&EQ5=1000000000&EQ6=1000000000&EQ7=1110100120&EQ8=101000000&EQ9=1000000000&KAT=1012000000&PIA=&PIAzero=&PIAOut=&PSLO=&akcija=&paketgarancije=0&broker=&prikazkategorije=&kategorija=&ONLvid=&ONLnak=&zaloga=10&arhiv=&presort=&tipsort=&stran=",
];

const runTask = async () => {
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
    cars.forEach(({ path }) => {
      let glava = `Novi auto na avto.net: [click here](${path})`;
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
    IgnoreHTTPSErrors: true,
    args: [`--window-size=${WIDTH},${HEIGHT}`, "--no-sandbox"],
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

  page.setDefaultNavigationTimeout(0);
  console.log("otvaranje" + url);
  await page.goto(url, { waitUntil: ["domcontentloaded", "networkidle0"] });
  await page.screenshot({
    path: "screenshot.jpg",
  });
  const htmlString = await page.content();
  console.log(htmlString);
  const dom = new jsdom.JSDOM(htmlString);
  console.log("ovo je dom" + JSON.stringify(dom, ""));
  console.log("parsing avto.net data");

  const result = dom.window.document.querySelectorAll("div.col-12.col-lg-9");
  console.log({ result });
  for (const element of await result) {
    const urlPath = element?.querySelectorAll("a.stretched-link")?.[0]?.href;
    console.log(urlPath);
    console.log("Ovo je urlpath " + "/n" + urlPath);
    let path = urlPath;
    if (!path.includes("https://www.avto.net")) {
      path = `https://www.avto.net${urlPath}`;
    }
    if (path && !pastResults.has(path) && !newResults.has(path)) {
      newResults.add(path);
      cars.push({
        path,
      });
    }
  }

  console.log("closing page");
  await browser.close();
};

if (CHAT_ID && BOT_API) {
  runTask();
} else {
  console.log("Missing Telegram API keys!");
}
