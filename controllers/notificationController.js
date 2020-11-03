const catchAsync = require('./../utils/catchAsync');
const User = require('./../models/userModel');
const AppError = require('../utils/appError');
const server = require("../server");
const xml2js = require('xml2js');
const fs = require('fs');
const util = require('util');

const readFile = (fileName) => util.promisify(fs.readFile)(fileName, 'utf8');

exports.manageAttendance = catchAsync(async(req, res, next)=>{
  const days = ["Lunes", "Martes", "Miércoles", "Jueves","Viernes"]
  const {datetime, legajo } = req.body;
  const userApp = await User.findOne({ legajo }).select('+token');
  const dataSysacad =  this.getDataSysacad(legajo)._parametro2.data;

  let cameraDate = new Date(datetime);
  let dayNumber = cameraDate.getDay()
  let hour  = cameraDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
  let cameraDay = days[dayNumber - 1];

  //console.log(dataSysacad)
  let dataFiltered = dataSysacad.find( el => {
    return el.horario.find(horario => {
      let cameraHour = parseInt(hour.split(':')[0] * 60  + hour.split(':')[1]);
      let hourStart = parseInt(horario.hora_desde.split(':')[0] * 60  + horario.hora_desde.split(':')[1]);
      let hourEnd = parseInt(horario.hora_hasta.split(':')[0] * 60  + horario.hora_hasta.split(':')[1]);
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

exports.getDataSysacad =  (legajo)=>{
  var xml;
  let legajos = [36034, 30666, 30344, 24400, 26476, 37853];
  if(legajos.includes(parseInt(legajo))){
    let url = `/horario${legajo}.xml`;
    xml =  fs.readFileSync(process.cwd() + url);
  }else{
    xml =  fs.readFileSync(process.cwd() + '/test.xml');
  }

  var data = null;
  xml2js.parseString(xml, {explicitArray: false, mergeAttrs : true},(err, result) => {
    data = result;
  });
  return data;
};



const sendPushToOneUser = notification => {
  const message = {
    
    notification: {
      title: notification.titulo,
      body: notification.message
    },
    token: notification.token
  }
  console.log(message)
  sendPushNotification(message);
}

const sendPushNotification = catchAsync(async (message) => {
  const response = await server.admin.messaging().send(message)
  .then((response) => {
    // Response is a message ID string.
    console.log('Successfully sent message:', response);
  })
  .catch((error) => {
    console.log('Error sending message:', error);
  });
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

exports.getDailyNotifications = catchAsync(async(req, res, next)=>{
  const user = await User.findById(req.user.id);
  let dailyAttendances = user.attendances.filter(el => isToday(el.registeredAt, new Date()));

  res.status(200).json({
    status: 'success',
    results: dailyAttendances.length,
    data: {
      dailyAttendances
    }
  });    
});

const isToday = (d1, d2)=>{
  return d1.getFullYear() == d2.getFullYear()
  && d1.getMonth() == d2.getMonth()
  && d1.getDate() == d2.getDate();
};