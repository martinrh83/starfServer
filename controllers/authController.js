const {promisify} = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');


const signToken = id =>{
  return jwt.sign({ id }, process.env.JWT_SECRET, {expiresIn: process.env.JWT_EXPIRES_IN});
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  //Evitar mandar la contraseña en la respuesta del user
  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    last_name: req.body.last_name,
    legajo: req.body.legajo,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  });
  //la linea anterior se puede escribir tmb: const newUser = await User.create(req.body);
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req,res, next) =>{
  const {legajo, password } = req.body;

  //check if legajo and pass exist5
  if(!legajo  || !password){
    return next(new AppError('Ingrese legajo y contraseña', 400));
  }
  //check if the user exist && password is correct
  const user = await User.findOne({ legajo }).select('+password');

  if(!user || !(await user.correctPassword(password, user.password))){
    return next(new AppError('El legajo o la contraseña son incorrectas', 401));
  }
  // if everthing is ok, send token to client
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync( async(req, res, next) =>{
  //1 get user from collection
  const user = await User.findById(req.user.id).select('+password');
  //2 check if posted current password is correct
  console.log(user, req.body.passwordCurrent);
  if(!(await user.correctPassword(req.body.passwordCurrent, user.password))){
    return next(new AppError('La contraseña ingresada no es correcta', 401));
  }
  //3 if so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  //user.findBYIdANdUpdate will not work as intended!!!
  //4 log user in, send jwt
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async(req, res, next) => {
  //1) getting token and check it's there
  let token;
  if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
    token = req.headers.authorization.split(' ')[1];
  }
  if(!token){
    return next(new AppError('Debe loguearse par acceder a esta url', 401));
  }
  //2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  //console.log(decoded);
  //3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if(!currentUser){
    return next(new AppError('El usuario con este token ya no existe más', 401));
  }
  //4) check if user change password after the jwt was issued
  if(currentUser.changedPasswordAfter(decoded.iat)){
    return next(new AppError('El usuario cambió su contraseña recientemente', 401))
  };

  //Garantiza el acceso al siguiente middleware(route middleware)
  req.user = currentUser;
  next();
});