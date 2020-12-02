const express = require('express');
const userController = require('./../controllers/userController');
const authController = require('./../controllers/authController');
const router = express.Router();

//router.get('/data_sysacad', userController.getDataSysacad);
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/register_token', authController.protect, userController.storeToken);
router.patch('/update_password', authController.protect, authController.updatePassword);
router.get('/get_attendances', authController.protect, userController.getAllAttendances);
router.delete('/delete_attendances', userController.deleteAttendances);
router
  .route('/')
  .get(authController.protect ,userController.getAllUsers)
  .post(userController.createUser);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
