require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const HTMLParser = require("node-html-parser");

const axios = require("axios");
const { TOKEN, SERVER_URL, PORT } = process.env;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;
const WEBHOOK_URL = SERVER_URL + URI;

const app = express();

app.use(bodyParser.json());

const initWebhook = async () => {
  const res = await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
  console.log(res.data);
};

let lowPrice = 0.1;
let highPrice = 0.3;

const API_KEYS = [
  "36e8926c-7d7c-4b85-8bbe-bbe091442f4c",
  "67b04b15-7f7f-4e1c-976c-724a004db9cb",
  "d325d22f-b7ef-4fa3-8e08-9ab13f073dc1",
  "28393754-4cb9-415e-8647-9c810cbd6cad",
  "464be171-d946-49cf-8516-df540a96547c",
  "68282cff-53a3-4d9c-8df7-de2fe09b5c04",
  "43d48803-b571-4bff-bfdd-00a8843e9955",
  "6ba05887-926f-44cc-8ea9-e575f7e66a29",
  "2eea606e-48e6-48f6-a31e-b0bae35a4316",
  "d7fb4126-b5fb-4346-b487-8ea4caf6aca0",
  "941b93b7-bd1f-476a-82e9-ba6ba493649b",
  "0fa2052d-2e6b-4462-b626-8364d3dedde5",
  "96635db6-db82-4c3a-8efd-0deadbc9f7b1",
  "0648b37f-ec95-421b-8ab3-ed64d3cec768",
  "2e8fd590-2429-4337-8e02-5e9a23820d5c",
  "efd5c369-0716-475e-83a5-ded4c422ac8a",
  "662e4510-a4ba-45ca-9285-3bc785b263d2",
  "444c45fa-9e4a-41a4-84fd-4fc72f5bf448",
];

const reloadAndSendNewPrice = async (chatId, forceSend = false) => {
  try {
    const randomIndex = Math.floor(Math.random() * API_KEYS.length);
    const [coinmarketcap, response] = await Promise.all([
      axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=9906", {
        headers: {
          "X-CMC_PRO_API_KEY": API_KEYS[randomIndex],
        },
      }),
      axios.get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bunicorn"),
    ]);

    const data = coinmarketcap.data.data;
    const bunicoin = data["9906"];
    const buniPrice = bunicoin.quote["USD"].price;
    const currentPrice = response.data[0].current_price;

    if (parseFloat(buniPrice) < lowPrice) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Buni THẤP: <b><i>${parseFloat(buniPrice).toFixed(4)}</i></b>\nCoinGeck: <i>${parseFloat(currentPrice).toFixed(
          4
        )}</i>\nThấp/Cao: <i>${lowPrice}</i>/<i>${highPrice}</i>`,
        parse_mode: "html",
      });
      return;
    }
    if (parseFloat(buniPrice) > highPrice) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Buni CAO: <b><i>${parseFloat(buniPrice).toFixed(4)}</i></b>\nCoinGeck: <i>${parseFloat(currentPrice).toFixed(
          4
        )}</i>\nThấp/Cao: <i>${lowPrice}</i>/<i>${highPrice}</i>`,
        parse_mode: "html",
      });
      return;
    }
    if (forceSend) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Buni hiện tại: <b><i>${parseFloat(buniPrice).toFixed(4)}</i></b>\nCoinGeck: <i>${parseFloat(currentPrice).toFixed(
          4
        )}</i>\nThấp/Cao: <i>${lowPrice}</i>/<i>${highPrice}</i>`,
        parse_mode: "html",
      });
    }
  } catch (error) {
    console.log("================================================");
    console.log("reloadAndSendNewPrice._error: ", error);
    console.log("================================================");
  }
};

let interval;
app.post(URI, async (req, res) => {
  const chatId = req.body.message.chat.id;
  const text = req.body.message.text;
  try {
    const textArr = text.split(" ");
    if (textArr && textArr.length && textArr[0].toLowerCase() == "low" && textArr[1]) {
      lowPrice = parseFloat(textArr[1] || 0.1);
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Đã set giá thấp nhất: ${lowPrice}`,
      });
    }
    if (textArr && textArr.length && textArr[0].toLowerCase() == "high" && textArr[1]) {
      highPrice = parseFloat(textArr[1] || 0.2);
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Đã set giá cao nhất: ${highPrice}`,
      });
    }

    reloadAndSendNewPrice(chatId, textArr[0].toLowerCase() !== "low" && textArr[0].toLowerCase() !== "high");
    clearInterval(interval);

    interval = setInterval(() => {
      reloadAndSendNewPrice(chatId);
    }, 1000 * 60);

    res.send();
  } catch (error) {
    console.log("================================================");
    console.log("error", error);
    console.log("================================================");
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `Đã xảy ra lỗi: ${error.message}`,
    });
    res.send();
  }
});

const crawData = async (url) => {
  // const browserFetcher = puppeteer.createBrowserFetcher();
  // const revisionInfo = await browserFetcher.download("901912");
  console.log("================================================");
  console.log("start lauch");
  console.log("================================================");
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--proxy-server='direct://'", "--proxy-bypass-list=*"] });
  console.log("================================================");
  console.log("Lauch done");
  console.log("================================================");
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36"
  );
  console.log("================================================");
  console.log("New page");
  console.log("================================================");
  await page.goto(url, {
    waitUntil: "load",
    timeout: 0,
  });
  console.log("================================================");
  console.log("Goto Page");
  console.log("================================================");
  const currentPrice = await page.evaluate((el) => el.innerHTML, await page.$(".price"));
  console.log("================================================");
  console.log("currentPrice", currentPrice);
  console.log("================================================");
  await browser.close();
  console.log("================================================");
  console.log("Close done");
  console.log("================================================");
  return currentPrice.split("$")[1];
};

app.get("/html", async (req, res) => {
  const currentPrice = await crawData("https://dextools.bunicorn.exchange");
  console.log("================================================");
  console.log("currentPrice", currentPrice);
  console.log("================================================");
  res.send({ data: currentPrice });
});

// API for verifying server is running, show latest git commit info
app.get("/", function (req, res) {
  const cmd = "git log -n 1";
  const exec = require("child_process").exec;
  exec(cmd, function (error, stdout, stderr) {
    if (error !== null) {
      const msg = "Error during the execution of git command: " + stderr;
      return res.send(msg);
    }
    res.status(200).send("Current git commit: " + stdout);
  });
});

app.post("/github", function (req, res) {
  console.log("Received a github hook event (POST)");
  const exec = require("child_process").exec;
  exec("./deploy " + "bunibot", function (error, stdout, stderr) {
    console.log(stdout);
    if (error !== null) {
      console.log("Error during the execution of redeploy: " + stderr);
    }
  });

  res.status(200).send();
});

app.listen(PORT || 6464, async () => {
  console.log("================================================");
  console.log("App is running on port: ", PORT || 6464);
  console.log("================================================");
  await initWebhook();
});
