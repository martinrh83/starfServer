const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const userRouter = require('./routes/userRoutes');
const notifRouter = require('./routes/notificationRoutes');

//const serviceAccount = require('./secret.json');
const app = express();

//GLOBAL MIDDLEWARES
//Set cors
app.use(cors());

app.options('*', cors());
//SET SECURITY HTTP headers
app.use(helmet());
//DEVELOPMENT LOGGING
if(process.env.NODE_ENV === 'development'){
  app.use(morgan('dev'));
}

//BODY PARSER, READING DATA FROM BODY INTO REQ.BODY
app.use(express.json({limit: '10kb'}));

//Data sanitization against NoSql query injection
app.use(mongoSanitize());
//Data sanitization against XSS
app.use(xss());
//prevent parameter polution
app.use(hpp());
//serving static files
app.use(express.static(`${__dirname}/public`));

app.use((req,res,next) =>{
  console.log('Hello from the middleware');
  next();
});

//solo para testear middlewares
app.use((req,res,next) =>{
  req.requestTime = new Date().toISOString();
  next();
});
//FIREBASE SERVICE ACCOUNT SETTINGS
/* admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://starfapp-a3e4e.firebaseio.com"
}); */


//ROUTES
app.use('/api/v1/users', userRouter);
app.use('/api/v1/notifications', notifRouter);

app.all('*', (req, res, next)=>{
  /* res.status(404).json({
    status: 'fail',
    message: `No se encontró ${req.originalUrl} en el servidor`
  }); */
  /* const err = new Error(`No se encontró ${req.originalUrl} en el servidor`);
  err.status = 'fail';
  err.statusCode = 404; */

  next(new AppError(`No se encontró ${req.originalUrl} en el servidor`, 404));
});

app.use(globalErrorHandler);


module.exports = app;
