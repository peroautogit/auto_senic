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
  "https://www.avto.net/Ads/results.asp?znamka=Renault&model=Scenic&modelID=&tip=katerikoli%20tip&znamka2=&model2=&tip2=katerikoli%20tip&znamka3=&model3=&tip3=katerikoli%20tip&cenaMin=0&cenaMax=999999&letnikMin=2004&letnikMax=2009&bencin=0&starost2=999&oblika=0&ccmMin=0&ccmMax=99999&mocMin=0&mocMax=999999&kmMin=0&kmMax=9999999&kwMin=0&kwMax=999&motortakt=0&motorvalji=0&lokacija=0&sirina=0&dolzina=&dolzinaMIN=0&dolzinaMAX=100&nosilnostMIN=0&nosilnostMAX=999999&lezisc=&presek=0&premer=0&col=0&vijakov=0&EToznaka=0&vozilo=&airbag=&barva=&barvaint=&EQ1=1000000000&EQ2=1000000000&EQ3=1000000000&EQ4=100000000&EQ5=1000000000&EQ6=1000000000&EQ7=1110100120&EQ8=101000000&EQ9=1000000000&KAT=1012000000&PIA=&PIAzero=&PIAOut=&PSLO=&akcija=0&paketgarancije=&broker=0&prikazkategorije=0&kategorija=0&ONLvid=0&ONLnak=0&zaloga=10&arhiv=0&presort=3&tipsort=DESC&stran=2",
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

  page.setDefaultNavigationTimeout(0);
  console.log("going to njuskalo on link" + url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  const htmlString = await page.content();

  const dom = new jsdom.JSDOM(htmlString);
  // console.log("ovo je dom" + JSON.stringify(dom,""));
  console.log("parsing njuskalo.hr data");

  const result = dom.window.document.querySelectorAll("div.col-12.col-lg-9");
  var resultarr = Array.from(result);
  console.log(resultarr);
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
