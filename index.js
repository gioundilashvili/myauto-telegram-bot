const express = require("express");
const parser = require("./src/parser");
const axios = require("axios");
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
  "mongodb+srv://gundilashvili:<Dartedfa1@#>@cluster0.fptjjlu.mongodb.net/test";

const dbClient = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const dbCollection = dbClient.db("ma").collection("products");
const app = express();
const PORT = 4000;

app.listen(PORT, () => {
  console.log(`API listening on PORT ${PORT} `);
});

app.get("/", (req, res) => {
  res.send("Hey this is my API running 🥳");
});

app.get("/hehehaha", async (req, res) => {
  try {
    const { savedIds, newItems } = await parser.runApp(
      dbCollection,
      axios,
      null
    );

    if (savedIds.length > 0) {
      res.send(`${newItems.length} new items found`);
    } else {
      res.send("No saved ids found");
    }
  } catch (error) {
    res.status(500);
    res.send(error);
    console.error(error);
  }
});

module.exports = app;
