const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = require('./app');
const admin = require("firebase-admin");


process.on('uncaughtException', err =>{
  console.log(err.name, err.message);
  console.log('UNHANDLER EXCEPTION, SHUTTING DOWN...');
  process.exit(1);
});

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: './config.env' });
}

module.exports.admin = admin.initializeApp({
  credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);
mongoose.connect(DB, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false
}).then(con =>{
  //console.log(con.connections);
  console.log('connection succesful');
});

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log('App is running');
});


process.on('unhandledRejection', err => {
  console.log(err.name, err.message);
  console.log('UNHANDLER REJECTION, SHUTTING DOWN...');
  server.close(()=>{
    process.exit(1);
  });
});

process.on('SIGTERM', ()=>{
  console.log('SIGTERM received: shutting down gracefully');
  server.close(()=>{
    console.log('Process terminated');
  });
});

