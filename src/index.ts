import type {EventFunction} from '@google-cloud/functions-framework/build/src/functions';

// Imports the Google Cloud client library
import {PubSub} from '@google-cloud/pubsub';
import {PubsubMessage} from '@google-cloud/pubsub/build/src/publisher';

// Imports the Google Cloud client library
import {Storage} from '@google-cloud/storage';
const storage = new Storage();

const unirand = require('unirand');

// Import Node.js stream
import * as stream from 'stream';

// Import fetch for node
import fetch from 'node-fetch';

// FIXME
// Configurations

// The ID of your GCS bucket
const bucketName = 'mirrormedia-files-dev';
// Path base
const pathBase = 'baron-dcard';
// Post id regex to match in url
const regexPostId = /.*posts\/(\d+).*/;
// User Agents to impersonate when fetching
const userAgents: Array<string> = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux i686; rv:24.0) Gecko/20100101 Firefox/24.0',
  'Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9a1) Gecko/20070308 Minefield/3.0a1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.59.10 (KHTML, like Gecko) Version/5.1.9 Safari/534.59.10',
];

// Get a reference to the bucket
const myBucket = storage.bucket(bucketName);

// Fisher-Yates (aka Knuth) Shuffle the array regardless of the types
/* eslint-disable @typescript-eslint/no-explicit-any*/
function shuffle(array: Array<any>) {
  let currentIndex = array.length,
    randomIndex;
  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

// Await the timeout's return Promise will practically sleep for ms milliseconds
function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// streamFileUpload writes text into a file in the GCS bucket
function streamFileUpload(text: string, destFilePath: string) {
  // Create a reference to a file object
  const file = myBucket.file(destFilePath);

  // Create a pass through stream from a string
  const passthroughStream = new stream.PassThrough();
  passthroughStream.write(text);
  passthroughStream.end();

  passthroughStream
    .pipe(file.createWriteStream())
    .on('finish', () => {
      console.log(`${destFilePath} uploaded to ${bucketName}`);
    })
    .on('error', console.error);
}

function publishMessageToFetch(data: string, topic: string) {
  // Creates a client; cache this for further use
  const pubSubClient = new PubSub();
  const dataBuffer = Buffer.from(data);

  return pubSubClient
    .topic(topic)
    .publish(dataBuffer)
    .then((messageId: string) =>
      console.log(`${topic}:Message ${messageId}:${data} published.`)
    )
    .catch((error: Error) =>
      console.error(`Received error while publishing: ${error.message}`)
    );
}

// Cloud Functions

// publishThreadTargets publishes messages to topics, dcardfecth-0 ~ detchfetch-9, randomly
export const publishThreadTargets: EventFunction = (
  pubsubMessage: PubsubMessage
) => {
  const message = Buffer.from(
    pubsubMessage.data as string,
    'base64'
  ).toString();

  const messages = message.split('\n');
  const promises = <Promise<void>[]>[];
  // shuffle the messages before fetching
  shuffle(messages);
  for (let i = 0; i < messages.length; i++) {
    const data = messages[i].split(', ');
    if (data.length !== 2) {
      console.log('invalid data' + JSON.stringify(data));
      continue;
    }
    // FIXME topic shouldn't be hardcoded
    const topic = 'dcardfetch-' + (i % 10).toString(10);
    promises.push(publishMessageToFetch(JSON.stringify(data), topic));
  }
  return Promise.all(promises);
};

export const fetchThread: EventFunction = async (
  pubsubMessage: PubsubMessage
) => {
  const jsonArray = JSON.parse(
    Buffer.from(pubsubMessage.data as string, 'base64').toString()
  );
  console.log('receive message', jsonArray);
  if (jsonArray.length !== 2) {
    console.log(`Received wrong messages: ${jsonArray}`);
    return;
  } else if (!jsonArray[0].startsWith('http')) {
    console.log(`Received wrong messages: ${jsonArray}`);
    return;
  } else {
    const count = Math.ceil(parseInt(jsonArray[1], 10) / 100);
    const url = jsonArray[0];
    // 420 is chosen because the cloud function timeout is set to 540 seconds
    const maxWaitSecond = 420 / count;
    const pages = [...Array(count).keys()];
    // FIXME it's a lazy practice to pick a random user agent
    shuffle(userAgents);
    // shuffle the order before fetching them
    shuffle(pages);
    for (let i = 0; i < pages.length; i++) {
      const after = 0 + 100 * pages[i];
      const postId = url.match(regexPostId)[1];
      const filename = postId + '.after.' + after.toString() + '.json';
      // Create a reference to a file object
      const destFileName = pathBase + '/' + 'json' + '/' + filename;
      const file = myBucket.file(destFileName);
      const errorFileName = pathBase + '/' + 'error' + '/' + filename;

      await file
        .exists()
        .then(data => {
          console.log(`${destFileName} data: ${data}`);
          const exists = data[0];
          return exists;
        })
        .then(async (exists: boolean) => {
          if (exists) {
            console.log(`${destFileName} exists`);
            throw 'break';
          }

          const wait = Math.floor(unirand.uniform(1, maxWaitSecond).random());
          return timeout(wait);
        })
        .then(() => {
          return fetch(url + '&after=' + after.toString(), {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': userAgents[0],
              // FIXME mood shouldn't be fixed
              Referer: `https://www.dcard.tw/f/mood/p/${postId}`,
            },
            redirect: 'follow',
            compress: true,
          });
        })
        .then(response => {
          if (!response.ok) {
            throw `HTTP error! status: ${response.status}`;
          } else {
            return response.text();
          }
        })
        .then(text => streamFileUpload(text, destFileName))
        .then(() => {
          const errorFile = myBucket.file(errorFileName);
          errorFile.exists((err: Error, exists: boolean) => {
            if (err !== null) {
              throw err;
            } else if (exists) {
              return errorFile.delete();
            }
            return Promise.resolve();
          });
        })
        .catch(err => {
          if (err === 'break') {
            return Promise.resolve();
          }
          console.error(err);
          return streamFileUpload(err, errorFileName);
        });
    }
    return;
  }
};
