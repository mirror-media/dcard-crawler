// Fisher-Yates (aka Knuth) Shuffle
function shuffle(array) {
  var currentIndex = array.length, randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Import the unirand to decide the time to wait
const unirand = require('unirand')

// Imports the Google Cloud client library
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

// Import Node.js stream
const stream = require('stream');

// The ID of your GCS bucket
const bucketName = 'mirrormedia-files-dev';

// Get a reference to the bucket
const myBucket = storage.bucket(bucketName);

const fetch = require('node-fetch')
async function streamFileUpload(text, destFileName) {
  // Create a reference to a file object
  const file = myBucket.file(destFileName)

  // Create a pass through stream from a string
  const passthroughStream = new stream.PassThrough();
  passthroughStream.write(text);
  passthroughStream.end();

  passthroughStream.pipe(file.createWriteStream()).on('finish', () => {
    console.log(`uploaded ${destFileName}`)
  });

  console.log(`${destFileName} uploaded to ${bucketName}`);
}

// path base
const pathBase = 'baron-dcard'

// post id regex to match
const regexPostId = /.*posts\/(\d+).*/

exports.fetch = async (pubsubMessage) => {
  let userAgents = ['Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36', 'Mozilla/5.0 (X11; Ubuntu; Linux i686; rv:24.0) Gecko/20100101 Firefox/24.0', 'Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9a1) Gecko/20070308 Minefield/3.0a1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.59.10 (KHTML, like Gecko) Version/5.1.9 Safari/534.59.10']

  let jsonArray = JSON.parse(Buffer.from(pubsubMessage.data, 'base64').toString())
  console.log('receive message', jsonArray)
  if (jsonArray.length != 2) {
    console.log(`Received wrong messages: ${jsonArray}`)
    return
  } else if (!jsonArray[0].startsWith('http')) {
    console.log(`Received wrong messages: ${jsonArray}`)
    return
  } else {
    let count = Math.ceil(parseInt(jsonArray[1], 10) / 100)
    let url = jsonArray[0]
    let max = 420 / count
    let pages = [...Array(count).keys()]
    shuffle(pages)
    shuffle(userAgents)
    for (let i = 0; i < pages.length; i++) {
      let after = 0 + 100 * pages[i]
      let postId = url.match(regexPostId)[1]
      let filename = postId + '.after.' + after.toString() + '.json'
      // Create a reference to a file object
      let destFileName = pathBase + '/' + 'json' + '/' + filename
      const file = myBucket.file(destFileName);

      let exists = false
      await file.exists().then(data => {
        console.log(`${destFileName} data: ${data}`)
        exists = data[0]
      })

      if (exists) {
        console.log(`${destFileName} exists`)
        continue
      }

      let wait = Math.floor(unirand.uniform(10, max).random())
      await timeout(wait)

      let errorFileName = pathBase + '/' + 'error' + '/' + filename

      await fetch(url + '&after=' + after.toString(), {
        method: 'GET',
        headers: new fetch.Headers({
          'Accept': 'application/json',
          'User-Agent': userAgents[0],
          'Referer': `https://www.dcard.tw/f/mood/p/${postId}`,
        }),
        redirect: 'follow',
        compress: true,
      }).then(response => {
        if (!response.ok) {
          throw `HTTP error! status: ${response.status}`
        } else {
          return response.text()
        }
      })
        .then(text => streamFileUpload(text, destFileName).then(() => myBucket.file(errorFileName).delete()))
        .catch(async (err) => {
          console.error(err)
          return streamFileUpload(err, errorFileName).catch(console.error)
        })
    }
  }
};

// Imports the Google Cloud client library
const { PubSub } = require('@google-cloud/pubsub');

// Creates a client; cache this for further use
const pubSubClient = new PubSub();

async function publishMessage(data, topic) {
  // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
  const dataBuffer = Buffer.from(data);

  try {
    const messageId = await pubSubClient.topic(topic).publish(dataBuffer);
    console.log(`${topic}:Message ${messageId}:${data} published.`);
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
  }
}

exports.publish = async (pubsubMessage) => {
  // Print out the data from Pub/Sub, to prove that it worked
  let message = Buffer.from(pubsubMessage.data, 'base64').toString()

  let messages = message.split('\n')
  shuffle(messages)
  let promises = []

  for (let i = 0; i < messages.length; i++) {
    let data = messages[i].split(", ")
    if (data.length != 2) {
      console.log('invalid data' + JSON.stringify(data))
      continue
    }
    let topic = 'dcardfetch-' + (i % 10).toString(10)
    promises.push(publishMessage(JSON.stringify(data), topic))
  }
  await Promise.all(promises).then(() => console.log('all published'))
};
