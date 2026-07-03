const line = require('@line/bot-sdk');

// เพิ่มส่วนนี้เข้าไปครับ
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};

// หลังจากประกาศ config แล้ว บรรทัดนี้ถึงจะทำงานได้ครับ
const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken });
const blobClient = new line.messagingApi.MessagingApiBlobClient({ channelAccessToken: config.channelAccessToken });

module.exports = { client, blobClient, config };
