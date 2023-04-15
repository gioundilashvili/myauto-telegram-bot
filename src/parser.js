const TelegramBot = require("node-telegram-bot-api");

const telegramToken = "6091051731:AAGhFQs_ZcJ0u67UEWdFKKAMGhlvTBOAJKA";
const telegramChatId = "-956262554";
// const telegramChatId = "-659894347"; // debug

module.exports = {
  runApp: async function (dbCollection, httpClient, testItems) {
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
            // `https://api2.myauto.ge/ka/products?Page=${page}&Limit=10&SortOrder=1&TypeID=2&ForRent=0&Mans=&Cats=17&ProdYearFrom=2017&EngineVolumeFrom=400&EngineVolumeTo=800&CurrencyID=1&MileageType=1&Locs=23.2.3.4.7.15.30.113.52.37.36.38.39.40.31.5.41.44.47.48.53.54.8.16.6.14.13.12.11.10.9.55.56.57.59.58.61.62.63.64.66.71.72.74.75.76.77.78.80.81.82.83.84.85.86.87.88.91.96.97.101.109.1`
            `https://api2.myauto.ge/ka/products?Page=${page}&Limit=10&TypeID=0&ForRent=0&Mans=&Cats=1&ProdYearFrom=2005&PriceTo=3000&EngineVolumeFrom=1600&EngineVolumeTo=6000&CurrencyID=1&MileageType=1&2.3.4.7.15.30.113.52.37.36.38.39.40.31.5.41.44.47.48.53.54.8.16.6.14.13.12.11.10.9.55.56.57.59.58.61.62.63.64.66.71.72.74.75.76.77.78.80.81.82.83.84.85.86.87.88.91.96.97.101.109.1`

          );
        }
        const promises = urls.map((url) => httpClient.get(url));
        const responses = await Promise.all(promises);
        const items = responses.reduce((acc, response) => {
          return [...acc, ...response.data.data.items];
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

    async function sendToTelegram(newItems) {
      const invalidItems = [];
      const validItems = [];
      for (const item of newItems) {
        const images = createImageUrls(item);
        const text = createMessage(item);
        if (images.length === 0) {
          const messageSend = await sendMessageToTelegram(text);
          if (messageSend) {
            validItems.push(item);
          } else {
            invalidItems.push(item);
          }
        } else {
          const messageSend = await sendPhotosToTelegram(images, text);
          if (messageSend) {
            validItems.push(item);
          } else {
            invalidItems.push(item);
          }
        }

        if (newItems.indexOf(item) !== newItems.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      return {
        invalidItems: invalidItems,
        validItems: validItems,
      };
    }

    async function sendPhotosToTelegram(images, text) {
      console.log("Sending photos");
      try {
        let captionAdded = false;
        await httpClient.post(
          `https://api.telegram.org/bot${telegramToken}/sendMediaGroup`,
          {
            chat_id: telegramChatId,
            media: images.map((photo) => {
              const body = {
                type: "photo",
                media: photo,
              };
              if (!captionAdded) body.caption = text;
              captionAdded = true;
              return body;
            }),
          }
        );
        return true;
      } catch (e) {
        console.log(e);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return await sendMessageToTelegram(text);
      }
    }

    async function sendMessageToTelegram(text) {
      console.log("Sending message");
      try {
        await httpClient.post(
          `https://api.telegram.org/bot${telegramToken}/sendMessage`,
          {
            chat_id: telegramChatId,
            text: text,
          }
        );
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    }

    const items = testItems ?? (await getNewItems());
    if (items.length === 0) return res.send("Can't get items");

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
      const telegramRes = await sendToTelegram(newItems);
      if (!testItems) {
        await updateSavedIds(telegramRes.validItems);
      }
    }

    return {
      savedIds: savedIds,
      newItems: newItems,
    };
  },
};