const AppError = require('./../utils/appError');

const handleCastErrorDB = err => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
}

const handleDuplicateFieldsDB = err =>{
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  console.log(value);
  const message = `Duplicated field value ${value}`;
  return new AppError(message, 400);
}

const handleValidationErrorDB = err =>{
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
}

const handleJWTError = () => new AppError('Token invalido', 401);

const handleJWTExpiredError = () => new AppError('Su token ha expirado', 401);

const sendErrorDev = (err, res)=>{
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
}

const sendErrorProd = (err, res)=>{
  //Operational error, debemos mandarle info al cliente
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  }else{
    //Programming errors: no es necesario mandar detalles al cliente

    //1) log error
    console.error(err);
    //2) send generic message
    res.status(500).json({
      status: 'error',
      message: 'Ocurrió algun error!'
    });
  }
  
}


module.exports = (err, req, res, next)=>{
  console.log(err.stack);
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  }else if (process.env.NODE_ENV === 'production'){
    let error = {...err};
    error.name = err.name;
    error.code = err.code;
    error.errmsg = err.errmsg;
    if(error.name === 'CastError') error = handleCastErrorDB(error);
    if(error.code === 11000 ) error = handleDuplicateFieldsDB(error);
    if(error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if(error.name === 'JsonWebTokenError') error = handleJWTError();
    if(error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    sendErrorProd(error, res);
  }
  
};