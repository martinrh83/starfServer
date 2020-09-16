const express = require('express');
const notifController = require('./../controllers/notificationController');
const authController = require('./../controllers/authController');
const router = express.Router();


router.post('/notification_user', notifController.sendPushToOneUser);


module.exports = router;
