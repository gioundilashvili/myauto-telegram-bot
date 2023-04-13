const parser = require("./parser");
const mongoTrigger = require("./mongo");
const axios = require("axios");
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
  "mongodb+srv://hehuser:0wgYendSkhmXfrii@cluster0.3quzth5.mongodb.net/?retryWrites=true&w=majority";

const dbClient = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const dbCollection = dbClient.db("ma").collection("products");

const testProducts = [
  {
    car_id: 89839030,
    car_desc: "BMW X5 3.0d",
    price_usd: 4550,
    prod_year: 2020,
    mileage: 5354,
    engine_volume: 600,
    car_run_km: 2322,
    photo: "3/0/9/3/8",
    pic_number: 6,
    photo_ver: 0,
    vin: "",
  },
  // https://static.my.ge/myauto/photos/3/0/9/3/8/large/89839030_1.jpg?v=0
  // {
  //   car_id: 89550538,
  //   car_desc: "BMW X5 3.0d",
  //   price_usd: 4550,
  //   prod_year: 2020,
  //   mileage: 5354,
  //   engine_volume: 600,
  //   car_run_km: 2322,
  //   photo: "3/5/0/5/5",
  //   pic_number: 6,
  //   photo_ver: 0,
  //   vin: null,
  // },
  // https://static.my.ge/myauto/photos/3/5/0/5/5/large/89550538_3.jpg?v=0
];

async function testApi() {
  await dbClient.connect();
  const { savedIds, newItems } = await parser.runApp(
    dbCollection,
    axios,
    testProducts
  );
  if (savedIds.length > 0) {
    console.log(`${newItems.length} new items found`);
  } else {
    console.log("No saved ids found");
  }
  process.exit(0);
}

async function testMongoTrigger() {
  const { savedIds, newItems } = await parser.runApp(
    dbCollection,
    {
      get: async (url) => {
        await axios.get(url);
      },
      post: async (url, data) => {
        await axios.post(url, data);
      },
    },
    testProducts
  );
  if (savedIds.length > 0) {
    console.log(`${newItems.length} new items found`);
  } else {
    console.log("No saved ids found");
  }
  process.exit(0);
}

// testApi();
testMongoTrigger();
