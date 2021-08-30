require("dotenv").config();

const _ = require("lodash");
const express = require("express");
const bodyParser = require("body-parser");
const { jsonToGraphQLQuery } = require("json-to-graphql-query");
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

const subgraphUrl = "https://graph.bunicorn.exchange/subgraphs/name/bunicorndefi/buni-token";
const queryBuni = {
  tokenPrice: {
    __args: {
      id: "0x0E7BeEc376099429b85639Eb3abE7cF22694ed49".toLowerCase(),
    },
  },
};

const queryBur = {
  tokenPrice: {
    __args: {
      id: "0xc1619D98847CF93d857DFEd4e4d70CF4f984Bd56".toLowerCase(),
    },
  },
};

const getBuniPrice = {
  tokenPrice: {
    id: true,
    symbol: true,
    name: true,
    decimals: true,
    price: true,
  },
};
const subgraphRequest = async (url, query) => {
  const res = await axios.post(
    url,
    {
      query: jsonToGraphQLQuery({ query }),
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );

  const data = res.data;
  return data || {};
};

const reloadAndSendNewPrice = async (chatId, forceSend = false) => {
  try {
    // const randomIndex = Math.floor(Math.random() * API_KEYS.length);
    // const [coinmarketcap, response] = await Promise.all([
    //   axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=9906", {
    //     headers: {
    //       "X-CMC_PRO_API_KEY": API_KEYS[randomIndex],
    //     },
    //   }),
    //   axios.get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bunicorn"),
    // ]);

    const [responseBuni, responseBur] = await Promise.all([
      subgraphRequest(subgraphUrl, _.merge(getBuniPrice, queryBuni)),
      subgraphRequest(subgraphUrl, _.merge(getBuniPrice, queryBur)),
    ]);

    // const responseBuni = await subgraphRequest(subgraphUrl, _.merge(getBuniPrice, queryBuni));
    // const responseBur = await subgraphRequest(subgraphUrl, _.merge(getBuniPrice, queryBur));
    const buniPrice = responseBuni.data.tokenPrice.price;
    const burPrice = responseBur.data.tokenPrice.price;
    console.log("================================================");
    console.log("buniPrice", buniPrice);
    console.log("burPrice", burPrice);
    console.log("================================================");
    if (parseFloat(buniPrice) < lowPrice) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Buni THẤP: <b><i>${parseFloat(buniPrice).toFixed(4)}</i></b>\nBur: <i>${parseFloat(burPrice).toFixed(
          4
        )}</i>\nThấp/Cao: <i>${lowPrice}</i>/<i>${highPrice}</i>`,
        parse_mode: "html",
      });
      return;
    }
    if (parseFloat(buniPrice) > highPrice) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Buni CAO: <b><i>${parseFloat(buniPrice).toFixed(4)}</i></b>\nBur: <i>${parseFloat(burPrice).toFixed(
          4
        )}</i>\nThấp/Cao: <i>${lowPrice}</i>/<i>${highPrice}</i>`,
        parse_mode: "html",
      });
      return;
    }
    if (forceSend) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Buni hiện tại: <b><i>${parseFloat(buniPrice).toFixed(4)}</i></b>\nBur: <i>${parseFloat(burPrice).toFixed(
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
      console.log("================================================");
      console.log("Đã set giá thấp nhất", lowPrice);
      console.log("================================================");
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Đã set giá thấp nhất: ${lowPrice}`,
      });
    }
    if (textArr && textArr.length && textArr[0].toLowerCase() == "high" && textArr[1]) {
      highPrice = parseFloat(textArr[1] || 0.2);
      console.log("================================================");
      console.log("Đã set giá cao nhất", highPrice);
      console.log("================================================");
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
