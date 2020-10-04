const catchAsync = require('./../utils/catchAsync');
const User = require('./../models/userModel');
const AppError = require('../utils/appError');
const admin = require("firebase-admin");
const xml2js = require('xml2js');
const fs = require('fs');
const util = require('util');
const readFile = (fileName) => util.promisify(fs.readFile)(fileName, 'utf8');

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

exports.manageAttendance = catchAsync(async(req, res, next)=>{
  const days = ["Lunes", "Martes", "Miércoles", "Jueves","Viernes"]
  const {datetime, legajo } = req.body;
  const userApp = await User.findOne({ legajo }).select('+token');
  console.log(userApp)
  const dataSysacad =  this.getDataSysacad()._parametro2.data;
  let cameraDate = new Date(datetime);
  let dayNumber = cameraDate.getDay()
  let hour  = cameraDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
  let cameraDay = days[dayNumber - 1];
  console.log(cameraDay)
  //console.log(dataSysacad)
  let dataFiltered = dataSysacad.find( el => {
    return el.horario.find(horario => {
      let cameraHour = hour.split(':')[0] * 60  + hour.split(':')[1];
      let hourStart = horario.hora_desde.split(':')[0] * 60  + horario.hora_desde.split(':')[1];
      let hourEnd = horario.hora_hasta.split(':')[0] * 60  + horario.hora_hasta.split(':')[1];
      return (horario.dia  === cameraDay) && (hourStart <= cameraHour && hourEnd >= cameraHour)? true : false;
    })
  })

  if(dataFiltered){
    console.log('encontre un match')
    userApp.attendances.push({ 
      registeredAt: cameraDate,
      subjectCode: dataFiltered.codigo,
      subjectName: dataFiltered.materia
    });

    userApp.save(function (err) {
      console.log(err)
      if (!err) {
        console.log('Attendance saved!');
        sendPushToOneUser({
          token: userApp.token,
          titulo: 'Asistencia registrada',
          message: `Se ha registrado su asistencia a ${dataFiltered.materia} a las ${hour} hs`
        });
      }
    });
  }else{
    console.log('no encontre un match')
    
  }
  console.log(dataFiltered);
  res.status(200).json({
    status: 'success',
    data: {
      userApp
    }
  });    
});

exports.getDataSysacad =  ()=>{
  const xml =  fs.readFileSync(process.cwd() + '/test.xml');
  /*const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <_parametro2>
    <anoacademico>2020</anoacademico>
    <especialidad>sistemas</especialidad>
    <plan>2008</plan>
    <aula>120</aula>
    <comision>1k8</comision>
    <materia>AED</materia>
    <nombre>Algoritmos</nombre>
    <horario>
      <dia>Lunes</dia>
      <hora_desde>08:00</hora_desde>
      <hora_hasta>08:45</hora_hasta>
    </horario>
    <horario>
      <dia>Miercoles</dia>
      <hora_desde>08:00</hora_desde>
      <hora_hasta>08:45</hora_hasta>
    </horario>
  </_parametro2>`;*/
  var data = null;
  xml2js.parseString(xml, {explicitArray: false, mergeAttrs : true},(err, result) => {

    //const json = JSON.stringify(result, null, 4);
    data = result;
    //return result
    /*res.status(200).json({
      status: 'sucess',
      data: {
        result
      }
    })*/
  });
  return data;
};



const sendPushToOneUser = notification => {
  initialize();
  const message = {
    token: notification.token,
    data: {
      titulo: notification.titulo,
      message: notification.message
    }
  }
  console.log(message)
  sendPushNotification(message);
}

const sendPushNotification = catchAsync(async (message) => {
  //initialize();
  const response = await admin.messaging().send(message);
  console.log(response);
});

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