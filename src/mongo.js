exports = async function () {
  const telegramToken = "6294229070:AAF6aHSIeQK3K2fG0CU6UaJcLSV6ESOP7rY";
  //   const telegramChatId = "-928118874";
  const telegramChatId = "-659894347"; // debug
  const dbCollection = context.services
    .get("Cluster0")
    .db("ma")
    .collection("products");
    

  async function getSavedIds() {
    try {
      const result = (await dbCollection.find({}).toArray()).map(
        (item) => item.car_id
      );
      return result;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async function updateSavedIds(newItems) {
    try {
      await dbCollection.insertMany(
        newItems.map((item) => ({ car_id: item.car_id }))
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function getNewItems() {
    try {
      const urls = [];
      for (let page = 1; page <= 2; page++) {
        urls.push(
          `https://api2.myauto.ge/ka/products?Page=${page}&Limit=10&SortOrder=1&TypeID=2&ForRent=0&Mans=&Cats=17&ProdYearFrom=2017&EngineVolumeFrom=400&EngineVolumeTo=800&CurrencyID=1&MileageType=1&Locs=23.2.3.4.7.15.30.113.52.37.36.38.39.40.31.5.41.44.47.48.53.54.8.16.6.14.13.12.11.10.9.55.56.57.59.58.61.62.63.64.66.71.72.74.75.76.77.78.80.81.82.83.84.85.86.87.88.91.96.97.101.109.1`
        );
      }
      const promises = urls.map((url) => context.http.get({ url: url }));
      const responses = await Promise.all(promises);
      const items = responses.reduce((acc, response) => {
        const ejson_body = EJSON.parse(response.body.text());
        const data1 = ejson_body.data;
        const data2 = JSON.stringify(data1);
        const data3 = EJSON.parse(data2);
        return [...acc, ...data3.items];
      }, []);
      return items;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  function createMessage(item) {
    let message = `https://www.myauto.ge/ka/pr/${item.car_id}`;
    const props = {
      price_usd: "ფასი $",
      prod_year: "წელი",
      mileage: "გარბენი",
      engine_volume: "ძრავი",
      car_run_km: "გარბენი km",
      vin: "VIN",
    };

    for (let key in props) {
      if (item[key]) {
        if (item[key]) {
          message += `\n${props[key]}: ${item[key]}`;
        }
      }
    }

    message += `\n${item.car_desc}`;
    if (message.length > 1020) return message.slice(0, 1020) + "...";
    return message;
  }

  function createImageUrls(item) {
    const images = [];
    for (let i = 1; i <= item.pic_number; i++) {
      images.push(
        `https://static.my.ge/myauto/photos/${item.photo}/large/${item.car_id}_${i}.jpg?v=${item.photo_ver}`
      );
    }
    if (images.length > 4) return images.splice(0, 4);
    return images;
  }

  async function sendPhotosToTelegram(newItems) {
    const invalidItems = [];
    const validItems = [];
    for (const item of newItems) {
      console.log(`Senging photos of ${item.car_id}`);
      let captionAdded = false;
      try {
        await context.http.post({
          url: `https://api.telegram.org/bot${telegramToken}/sendMediaGroup`,
          encodeBodyAsJSON: true,
          body: {
            chat_id: telegramChatId,
            media: createImageUrls(item).map((photo) => {
              const body = {
                type: "photo",
                media: photo,
              };
              if (!captionAdded) {
                body.caption = createMessage(item);
              }
              captionAdded = true;
              return body;
            }),
          },
        });
        validItems.push(item);
      } catch (e) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const messageSend = await sendMessageToTelegram(createMessage(item));
        if (!messageSend) return invalidItems.push(item);
        console.log(e);
      }
      if (newItems.indexOf(item) !== newItems.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 8000));
      }
    }

    return {
      invalidItems: invalidItems,
      validItems: validItems,
    };
  }

  async function sendMessageToTelegram(text) {
    try {
      context.http.post({
        url: `https://api.telegram.org/bot${telegramToken}/sendMessage`,
        encodeBodyAsJSON: true,
        body: {
          chat_id: telegramChatId,
          text: text,
        },
      });
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  try {
    sendMessageToTelegram("Running Myauto trigger");
    const items = await getNewItems();
    if (items.length === 0) return console.log("Can't get items");

    const savedIds = await getSavedIds();
    const newItems = items.filter(
      (item) => savedIds.indexOf(item.car_id) === -1
    );

    // if it's a first run and we don't have any saved ids
    if (newItems.length > 0 && savedIds.length === 0) {
      await updateSavedIds(newItems);
    }

    // if we have saved ids and we have new items
    // send them to telegram
    if (savedIds.length > 0 && newItems.length > 0) {
      const telegramRes = await sendPhotosToTelegram(newItems);
      await updateSavedIds(telegramRes.validItems);
    }

    if (savedIds.length > 0) {
      console.log(`${newItems.length} new items found`);
    } else {
      console.log("No saved ids found");
    }
  } catch (error) {
    console.error(error);
  }
};
