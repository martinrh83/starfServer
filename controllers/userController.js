const catchAsync = require('./../utils/catchAsync');
const User = require('./../models/userModel');
const AppError = require('../utils/appError');

exports.getAllUsers = catchAsync(async(req, res, next)=>{
  const users = await User.find();
  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users
    }
  });    
});

exports.getUser = catchAsync(async (req, res, next)=>{
  const user = await User.findById(req.params.id);
  console.log(user);
  console.log('sss');
  if(!user){
    return next(new AppError('No se encontró un usuario con esa ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });    
});

exports.storeToken = catchAsync(async(req, res, next)=>{

  await User.updateOne({ _id: req.user.id }, {
    token: req.body.token
  });
  res.status(200).json({
    status: 'success',
    message: 'Se ha actualizado el token correctamente'
  });    
});

exports.createUser = (req,res)=>{
  res.status(500).json({
    status: 'error',
    message: 'Still not defined'
  });    
};
exports.updateUser = (req,res)=>{
  res.status(500).json({
    status: 'error',
    message: 'Still not defined'
  });    
};
exports.deleteUser = (req,res)=>{
  res.status(500).json({
    status: 'error',
    message: 'Still not defined'
  });    
};