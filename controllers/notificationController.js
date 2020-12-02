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

  console.log('Hoy es el dia de:', cameraDay)
  let dataFiltered = dataSysacad.find( el => {
    return el.horario.find(horario => {
      let cameraHour = parseInt(hour.split(':')[0] * 60  + hour.split(':')[1]);
      let hourStart = parseInt(horario.hora_desde.split(':')[0] * 60  + horario.hora_desde.split(':')[1]);
      let hourEnd = parseInt(horario.hora_hasta.split(':')[0] * 60  + horario.hora_hasta.split(':')[1]);
      /*console.log('HORA cam ', cameraHour);
      console.log('desde',hourStart);
      console.log('hour end',hourEnd);
      console.log(horario.dia)*/
      horario.horaCatedra = 2;
      return (horario.dia  === cameraDay) && (hourStart <= cameraHour && hourEnd >= cameraHour)? true : false;
    })
  })
  //console.log(dataFiltered)
  if(dataFiltered){
    console.log('ENCONTRE UN MATCH')
    let hoursRemaining = 0;
    let percentage = 0;
    let horario = dataFiltered.horario.find(el =>{
      return el.dia == cameraDay? true : false;
    })
    console.log(horario);
    //console.log(dataFiltered)
    if(userApp.attendances.length){
      //let mongoToJs = userApp.attendances.toObject();
      let attendacesGrouped = groupByArray(userApp.attendances, 'subjectCode').find(el => el.key == dataFiltered.codigo);

      if(attendacesGrouped){
        let attendancesSorted = attendacesGrouped.values.sort((d1, d2) => new Date(d1.registeredAt).getTime() - new Date(d2.registeredAt).getTime());
        let lastAttendance = attendancesSorted[attendancesSorted.length - 1]
        hoursRemaining = lastAttendance.hoursRemaining - horario.horaCatedra;
      }else{
        hoursRemaining = dataFiltered.cargahoraria - horario.horaCatedra;
      }
      percentage = Math.round(100 - ((hoursRemaining * 100) / dataFiltered.cargahoraria));
    }else{
      hoursRemaining = dataFiltered.cargahoraria - horario.horaCatedra;
      percentage = Math.round(100 - ((hoursRemaining * 100) / dataFiltered.cargahoraria));
    }
    
    //checkFeriado else
    //if(!holidayDay){
      //1 a partir del dia actual 
    //}
    userApp.attendances.push({ 
      registeredAt: cameraDate,
      subjectCode: dataFiltered.codigo,
      subjectName: dataFiltered.materia,
      hoursRemaining: hoursRemaining,
      percentageCompleted: percentage
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
  //console.log(dataFiltered);
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

groupByArray = (xs, key)=> {
  return xs.reduce(function (rv, x) {
      let v = key instanceof Function ? key(x) : x[key];
      let el = rv.find((r) => r && r.key === v);
      if (el) {
          el.values.push(x);
      }
      else {
          rv.push({
              key: v,
              values: [x]
          });
      }
      return rv;
  }, []);
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

exports.getLastAttendance = catchAsync(async (req, res, next)=>{
  //const user = await User.findById(req.user.id);
  const {subjectCode, legajo } = req.body;
  const user = await User.findOne({ legajo });
  console.log(user.attendances);
  let lastAttendance = {};
  if(user.attendances.length){
    let attendacesSorted = groupByArray(user.attendances, 'subjectCode').find(el => el.key == subjectCode).values.sort((d1, d2) => new Date(d1.registeredAt).getTime() - new Date(d2.registeredAt).getTime());
    lastAttendance = attendacesSorted[attendacesSorted.length - 1]
    console.log(lastAttendance);
  }

  res.status(200).json({
    status: 'success',
    data: {
      lastAttendance
    }
  });    
});