require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
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

const reloadAndSendNewPrice = async (chatId, forceSend = false) => {
  console.log("================================================");
  console.log("lowPrice", lowPrice);
  console.log("highPrice", highPrice);
  console.log("================================================");
  const response = await axios.get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bunicorn");
  const currentPrice = response.data[0].current_price;
  if (parseFloat(currentPrice) < lowPrice) {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `Giá Buni THẤP hơn giá set: ${response.data[0].current_price} ${lowPrice}/${highPrice}`,
    });
    return;
  }
  if (parseFloat(currentPrice) > highPrice) {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `Giá Buni CAO hơn giá set: ${response.data[0].current_price} ${lowPrice}/${highPrice}`,
    });
    return;
  }
  if (forceSend) {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `Giá Buni hiện tại: ${response.data[0].current_price} ${lowPrice}/${highPrice}`,
    });
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

    // const coinmarketcap = await axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=9906", {
    //   headers: {
    //     "X-CMC_PRO_API_KEY": "36e8926c-7d7c-4b85-8bbe-bbe091442f4c",
    //   },
    // });
    // console.log("================================================");
    // console.log("coinmarketcap", coinmarketcap.data.data);
    // console.log("================================================");
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
