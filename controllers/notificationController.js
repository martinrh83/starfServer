const catchAsync = require('./../utils/catchAsync');
const User = require('./../models/userModel');
const AppError = require('../utils/appError');
const admin = require("firebase-admin");

const initialize = () =>{
  admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const sendPushNotification = catchAsync(async (message) => {
  initialize();
  const response = await admin.messaging().send(message);
  console.log(response);
});

exports.sendPushToOneUser = notification => {
  const message = {
    token: notification.tokenId,
    data: {
      titulo: notification.titulo,
      message: notification.message
    }
  }
  sendPushNotification(message);
}

exports.sendPushToTopic = notification => {
  const message = {
    topic: notification.topic,
    data: {
      titulo: notification.titulo,
      message: notification.message
    }
  }
  sendPushNotification(message);
}