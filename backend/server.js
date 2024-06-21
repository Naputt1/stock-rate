const express = require("express");
const socket = require("socket.io");
const cors = require("cors");
const http = require("http");
const puppeteer = require("puppeteer");

const PORT = 3001;
const AXIOS_URL = "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
// max 50
const TOTOAL_STOCK_COUNT = 10;
const FRINTEND_URL = 'http://localhost:3000';

const state = {
  gettingData1: false,
  gettingData2: false,
  updated :false,
  data1 : [],
  data2: {},
  fullData : [],
};

let browser;
let page1;
let page2;

async function gotoPage(page, url) {
  return new Promise(async (resolve, reject) => {
    await page.goto(
      url,
      {
        waitUntil: "load",
      }
    );
    await await page.evaluate(async (AXIOS_URL) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = AXIOS_URL;

        script.onload = () => {
          resolve();
        };

        script.onerror = () => {
          throw new Error("error loading axios in page 1");
        };

        document.head.appendChild(script);
      });
    }, AXIOS_URL);

    resolve();
  })
}

let getFullData;

const app = express();
app.use(cors({ origin: FRINTEND_URL }));
const server = http.createServer(app);
const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});
server.listen(PORT);

app.get("/", async (req, res) => {
  if (state.updated) {
    await getFullData();
  }

  res.send(state.fullData);
});

async function emitUpdate() {
  await getFullData();

  io.emit('update', state.fullData);
}


async function main() {
  browser = await puppeteer.launch();
  page1 = await browser.newPage();
  page2 = await browser.newPage();

  await Promise.all([
    gotoPage(
      page1,
      "https://www.settrade.com/th/equities/market-summary/top-ranking/top-gainer"
    ),
    gotoPage(
      page2,
      "https://www.set.or.th/en/market/product/stock/quote/NATION-F/price"
    ),
  ]);

  async function getData1() {
    state.gettingData1 = true;
    const data = await page1.evaluate(async (TOTOAL_STOCK_COUNT) => {
      return await axios
        .get(
          `https://www.settrade.com/api/set/ranking/topGainer/set/S?count=${TOTOAL_STOCK_COUNT}`
        )
        .then((response) => {
          console.log("get", response.data.length);
          return response.data;
        })
        .catch((err) => {
          console.error(err.response);
        });
    }, TOTOAL_STOCK_COUNT);

    state.data1 = data.stocks;
    state.updated = true;
    state.gettingData1 = false;

    emitUpdate();
  }

  async function getData2(toReturn) {
    state.gettingData2 = true;

    let toFetch;
    if (toReturn == null) {
      toFetch = [];
      for (const stock of state.data1) {
        toFetch.push(stock.symbol);
      }
    } else {
      toFetch = toReturn;
    }

    const data = await page2.evaluate(async (toFetch) => {
      const data = [];
      for (const symbol of toFetch) {
        data.push(
          await axios
            .get(
              `https://www.set.or.th/api/set/stock/${symbol}/highlight-data?lang=en`
            )
            .then((response) => {
              console.log("get", response);
              return response.data;
            })
            .catch((err) => {
              console.error(err.response);
            })
        );
      }
      return data;
    }, toFetch);

    if (toReturn == null) {
      for (const d of data) {
        state.data2[d.symbol.toUpperCase()] = d.marketCapd;
      }
      state.data2 = data;
      state.updated = true;
      state.gettingData2 = false;
    } else {
      state.updated = true;
      state.gettingData2 = false;
      return data;
    }

    emitUpdate();
  }

  getFullData = async ()=> {
    const fullData = [];
    const toFetch = [];
    for (const stock of state.data1) {
      const temp = {
        symbol: stock.symbol,
        last: stock.last,
        change: stock.change,
        percentChange: stock.percentChange,
      };
      if (state.data2.hasOwnProperty(stock.symbol)) {
        temp.marketCap = state.data2[stock.symbol].marketCap;
      } else {
        toFetch.push(stock.symbol);
      }

      fullData.push(temp);
    }

    if (toFetch.length > 0) {
      const marketCap = await getData2(toFetch);
      for (const marketCapStock of marketCap) {
        for (const stock of fullData) {
          if (stock.symbol === marketCapStock.symbol) {
            stock.marketCap = marketCapStock.marketCap;
            break;
          }
        }
      }
    }

    state.fullData = fullData;
    state.updated = false;
  }


  setInterval(() => {
    getData1();
  }, 10000);

  setInterval(() => {
    getData2();
  }, 60000);

  await getData1();
  await getData2();
}

main();