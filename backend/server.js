const express = require("express");
const axios = require("axios");
const socket = require("socket.io");
const fs = require("fs");
const puppeteer = require("puppeteer");
const { rejects } = require("assert");
const Mutex = require("async-mutex").Mutex;



const PORT = 3000;
const t = 'https://www.settrade.com/api/set/stock/list'
const ti = 'https://www.settrade.com/api/set-fund/fund/active-fund/list'
const t3 = 'https://www.settrade.com/api/set/tfex/series/list'
const t4 = 'https://www.settrade.com/api/set-fund/fund/virtualport/list'
const a = 'https://www.settrade.com/api/set/ranking/topGainer/set/S?count=20'
const AXIOS_URL = "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";

const state = {
  gettingData1: false,
  gettingData2: false,
  updated :false,
  data1 : [],
  data2: {},
  fullData : [],
  mutex: new Mutex(),
};

let browser;
let page1;
let page2;

async function wait(func) {
  if (func()) {
    return;
  }

  return new Promise((resolve) => {
        setTimeout(() => {
          console.log("timeout", func())
          if (func()) {
            console.log("resolve")
            resolve();
          }
        }, 10);
      })
}

let getFullData;

let bAxios1 = false;
let bAxios2 = false;
async function main() {
  browser = await puppeteer.launch({ headless: false });
  page1 = await browser.newPage();
  page2 = await browser.newPage();

  await page1.goto(
    "https://www.settrade.com/th/equities/market-summary/top-ranking/top-gainer",
    {
      waitUntil: "load",
    }
  );

  await page2.goto(
    "https://www.set.or.th/en/market/product/stock/quote/NATION-F/price",
    {
      waitUntil: "load",
    }
  );

  if (!bAxios1) {
    await await page1.evaluate(async (AXIOS_URL) => {
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
    bAxios1 = true;
  }

  if (!bAxios2) {
    await await page2.evaluate(async (AXIOS_URL) => {
      return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = AXIOS_URL;

        script.onload = () => {
          resolve();
        };

        script.onerror = () => {
          throw new Error("error loading axios in page 2");
        };

        document.head.appendChild(script);
      });
    }, AXIOS_URL);
    bAxios2 = true;
  }

  async function getData1() {

    state.gettingData1 = true;
    const data = await page1.evaluate(async () => {
      return await axios
        .get(
          "https://www.settrade.com/api/set/ranking/topGainer/set/S?count=20"
        )
        .then((response) => {
          console.log("get", response.data.length);
          return response.data;
        })
        .catch((err) => {
          console.error(err.response);
        });
    });

    state.data1 = data.stocks;
    state.updated = true;
    state.gettingData1 = false;
    console.log("data1", state.data1.length);
  }

  async function getData2(toReturn) {

    state.gettingData2 = true;
    // if (state.gettingData1) {
    //   console.log("data2 :wait fetch data 1")
    //   try {
    //     await wait(() => !state.gettingData1);
    //   } catch (err) {
    //     console.log("dead lock");
    //     state.gettingData2 = false;
    //     return;
    //   }
    //   console.log("data1 :finish wait fetch data 1");

    // }

    let toFetch;
    if (toReturn == null) {
      await wait(() => state.data1.length !== 0)

      toFetch = [];
      // console.log(state);

      for (const stock of state.data1) {
        toFetch.push(stock.symbol);
      }
    } else {
      toFetch = toReturn;
    }

    console.log('toFetch', toFetch)
    const data = await page2.evaluate(async (toFetch) => {
      const data = [];
      for (const symbol of toFetch) {
        console.log(toFetch);
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
        // console.log(data);
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
  }

  getFullData = async ()=> {
    const fullData = [];
    const toFetch = [];
    for (const stock of state.data1) {
      const temp = {
        symbol: stock.symbol,
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

    console.log('get full data', toFetch)
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

    console.log("full data");
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

const app = express();

app.get("/", async (req, res) => {
  if (state.updated) {
    await getFullData();
  }
  
  res.send(state.fullData);
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});