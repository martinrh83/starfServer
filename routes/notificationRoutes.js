const express = require('express');
const notifController = require('./../controllers/notificationController');
const authController = require('./../controllers/authController');
const router = express.Router();


//router.post('/notification_user', notifController.sendPushToOneUser);
router.post('/manage_attendance', notifController.manageAttendance);
router.get('/daily_notifications', authController.protect, notifController.getDailyNotifications);
router.post('/last_attendance', notifController.getLastAttendance);
router.post('/students_list', notifController.getStudentsList);
router.get('/courses_list', notifController.getComisiones);
router.post('/subjects_list', notifController.getMaterias);
router.post('/manual_attendance', notifController.setManualAttendance);
router.post('/create_exception', notifController.setException);
module.exports = router;
