const catchAsync = require('./../utils/catchAsync');
const User = require('./../models/userModel');
const AppError = require('../utils/appError');
const server = require("../server");
const xml2js = require('xml2js');
const fs = require('fs');
const util = require('util');
//const { Console } = require('console');

const readFile = (fileName) => util.promisify(fs.readFile)(fileName, 'utf8');

exports.manageAttendance = catchAsync(async(req, res, next)=>{
  const days = ["Lunes", "Martes", "Miércoles", "Jueves","Viernes"]
  const {datetime, legajo } = req.body;
  const userApp = await User.findOne({ legajo }).select('+token');
  const dataSysacad =  this.getDataSysacad(legajo)._parametro2.data;
  //console.log(dataSysacad);
  let cameraDate = new Date(datetime);
  let dayNumber = cameraDate.getDay()
  let hour  = cameraDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  console.log(hour)
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
        let attendancesSorted = attendacesGrouped.values.sort((d1, d2) => new Date(d1.createdAt).getTime() - new Date(d2.createdAt).getTime());
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
    console.log('NO ENCONTRE UN MATCH')
    
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


exports.getStudentsList = catchAsync(async(req, res, next)=>{
  const {comision, materia} = req.body;
  console.log(comision)
  console.log(materia)
  let arraySysacad = this.getStudentsSysacad();
  let arrayFiltered = arraySysacad.filter((el)=>{
    return el.comision == comision && el.materia == materia;
  })[0];
  console.log(arrayFiltered)
  if(arrayFiltered == undefined){
    console.log('sin alumnos')
    return next(new AppError('Comisión y/o materia ingresados no existen.', 400)); 
  }
  if(!arrayFiltered.alumno) return next(new AppError('No hay alumnos inscriptos.', 400));

  for(const alumno of arrayFiltered.alumno) {
    let legajo = parseInt(alumno.legajo);
    const user  = await User.findOne({legajo: legajo});
    if(user){
      if(user.attendances.length){
        let attendances = groupByArray(user.attendances, 'subjectName').find(el => el.key == materia);
        let attendancesSorted;
        if(attendances){
          attendancesSorted = attendances.values.sort((d1, d2) => new Date(d1.createdAt).getTime() - new Date(d2.createdAt).getTime());
          lastAttendance = attendancesSorted[attendancesSorted.length - 1]
          //console.log(lastAttendance);
          alumno.lastAttendance = lastAttendance;
        }else{
          alumno.lastAttendance = {
            percentageCompleted: 0
          }
        }
      }
    }
  }
  const students = arrayFiltered.alumno;

  res.status(200).json({
    status: 'success',
    data: {
      students
    }
  });    
});

exports.findUser =  async function  findUser(legajo, callback){
  const user = await User.findOne({legajo: legajo}, function(err, userObj){
      if(err){
          return callback(err);
      } else if (userObj){
          return callback(null,userObj);
      } else {
          return callback();
      }
  });
  return user;
}

exports.getComisiones = catchAsync(async(req, res, next)=>{
  let arraySysacad = this.getComisionesSysacad();
  console.log(arraySysacad)

  res.status(200).json({
    status: 'success',
    data: {
      arraySysacad
    }
  });    
});

exports.getMaterias = catchAsync(async(req, res, next)=>{
  const {comision} = req.body;
  console.log(comision)
  let nivel  = comision.charAt(0);
  let arraySysacad = this.getMateriasSysacad();
  let arrayFiltered = arraySysacad.filter((el)=>{
    return el.nivel == nivel;
  })[0];
  console.log(arrayFiltered)

  res.status(200).json({
    status: 'success',
    data: {
      arrayFiltered
    }
  });    
});

exports.getStudentsSysacad =  ()=>{
  var xml =  fs.readFileSync(process.cwd() + '/listadoAlumnos.xml');

  var data = null;
  xml2js.parseString(xml, {explicitArray: false, mergeAttrs : true},(err, result) => {
    data = result;
  });
  //console.log(data)
  return data._parametro2.data;
};

exports.getComisionesSysacad =  ()=>{
  var xml =  fs.readFileSync(process.cwd() + '/listadoComisiones.xml');

  var data = null;
  xml2js.parseString(xml, {explicitArray: false, mergeAttrs : true},(err, result) => {
    data = result;
  });
  //console.log(data)
  return data._parametro2.data;
};

exports.getMateriasSysacad =  ()=>{
  var xml =  fs.readFileSync(process.cwd() + '/listadoMaterias.xml');

  var data = null;
  xml2js.parseString(xml, {explicitArray: false, mergeAttrs : true},(err, result) => {
    data = result;
  });
  //console.log(data)
  return data._parametro2.data;
};

exports.getLastAttendance = catchAsync(async (req, res, next)=>{
  //const user = await User.findById(req.user.id);
  const {subjectName, legajo } = req.body;
  const user = await User.findOne({ legajo });
  console.log(user.attendances);
  let lastAttendance = {};
  if(user.attendances.length){
    let attendacesSorted = groupByArray(user.attendances, 'subjectName').find(el => el.key == subjectName).values.sort((d1, d2) => new Date(d1.createdAt).getTime() - new Date(d2.createdAt).getTime());
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

exports.setManualAttendance = catchAsync(async(req, res, next)=>{
  const days = ["Lunes", "Martes", "Miércoles", "Jueves","Viernes"]
  const {comision, materia, legajo, fecha} = req.body;
  console.log(comision)
  console.log(materia)
  console.log(legajo)
  console.log(fecha)
  let arraySysacad = this.getStudentsSysacad();
  let arrayFiltered = arraySysacad.filter((el)=>{
    return el.comision == comision && el.materia == materia;
  })[0];
  console.log(arrayFiltered)
  if(arrayFiltered == undefined){
    console.log('sin alumnos')
    return next(new AppError('No hay alumnos inscriptos.', 400)); 
  }
  const alumnoFounded = arrayFiltered.alumno.find((el)=> el.legajo == legajo);
  if(!alumnoFounded) return next(new AppError('El alumno no está inscripto a la materia y comisión seleccionadas.', 400));

  let cameraDate = new Date(fecha);
  let dayNumber = cameraDate.getDay()
  let cameraDay = days[dayNumber - 1];
  console.log(cameraDay);
  let horarioFounded = arrayFiltered.horario.find((el)=> el.dia == cameraDay);
  if(!horarioFounded) return next(new AppError('El día seleccionado es incorrecto.', 400));

  horarioFounded.horaCatedra = 2;
  let hoursRemaining = 0;
  let percentage = 0;
  console.log(horarioFounded)
  

  const user  = await User.findOne({legajo: parseInt(legajo)});
  let lastAttendance;
  if(user){
    if(user.attendances.length){
      let attendacesGrouped = groupByArray(user.attendances, 'subjectName').find(el => el.key == materia);

      if(attendacesGrouped){
        let attendancesSorted = attendacesGrouped.values.sort((d1, d2) => new Date(d1.createdAt).getTime() - new Date(d2.createdAt).getTime());
        lastAttendance = attendancesSorted[attendancesSorted.length - 1]
        hoursRemaining = lastAttendance.hoursRemaining - horarioFounded.horaCatedra;
      }else{
        hoursRemaining = arrayFiltered.cargahoraria - horarioFounded.horaCatedra;
      }
      percentage = Math.round(100 - ((hoursRemaining * 100) / arrayFiltered.cargahoraria));
    }else{
      hoursRemaining = arrayFiltered.cargahoraria - horarioFounded.horaCatedra;
      percentage = Math.round(100 - ((hoursRemaining * 100) / arrayFiltered.cargahoraria));
    }
  }else{
    return next(new AppError('El alumno no está registrado en la aplicación.', 400)); 
  }
  
  console.log(lastAttendance)
  console.log(hoursRemaining)
  console.log(percentage)
  user.attendances.push({
    registeredAt: cameraDate, 
    subjectCode: arrayFiltered.codigo,
    subjectName: arrayFiltered.materia,
    hoursRemaining: hoursRemaining,
    percentageCompleted: percentage
  });

  user.save(function (err) {
    console.log(err)
    if (!err) {
      console.log('Attendance saved!');
    }
  });

  res.status(200).json({
    status: 'success',
    message: 'Se ha registrado la asistencia correctamente.'
  });    
});

exports.setException = catchAsync(async(req, res, next)=>{
  const days = ["Lunes", "Martes", "Miércoles", "Jueves","Viernes"]
  const {comision, materia, fecha} = req.body;
  console.log(comision)
  console.log(materia)
  console.log(fecha)
  let arraySysacad = this.getStudentsSysacad();
  let arrayFiltered = arraySysacad.filter((el)=>{
    return el.comision == comision && el.materia == materia;
  })[0];
  console.log(arrayFiltered)
  if(arrayFiltered == undefined){
    return next(new AppError('No hay alumnos inscriptos.', 400)); 
  }

  let cameraDate = new Date(fecha);
  let dayNumber = cameraDate.getDay()
  let cameraDay = days[dayNumber - 1];
  console.log(cameraDay);
  let horarioFounded = arrayFiltered.horario.find((el)=> el.dia == cameraDay);
  if(!horarioFounded) return next(new AppError('El día seleccionado es incorrecto.', 400));
  horarioFounded.horaCatedra = 2;
  console.log(horarioFounded)
  
  if(!arrayFiltered.alumno) return next(new AppError('No hay alumnos inscriptos.', 400));
  for(const alumno of arrayFiltered.alumno) {
    let legajo = alumno.legajo;
    let hoursRemaining = 0;
    let percentage = 0;
    const user  = await User.findOne({legajo: parseInt(legajo)});
    let lastAttendance;
    if(user){
      if(user.attendances.length){
        let attendacesGrouped = groupByArray(user.attendances, 'subjectName').find(el => el.key == materia);

        if(attendacesGrouped){
          let attendancesSorted = attendacesGrouped.values.sort((d1, d2) => new Date(d1.createdAt).getTime() - new Date(d2.createdAt).getTime());
          lastAttendance = attendancesSorted[attendancesSorted.length - 1]
          hoursRemaining = lastAttendance.hoursRemaining - horarioFounded.horaCatedra;
        }else{
          hoursRemaining = arrayFiltered.cargahoraria - horarioFounded.horaCatedra;
        }
        percentage = Math.round(100 - ((hoursRemaining * 100) / arrayFiltered.cargahoraria));
      }else{
        hoursRemaining = arrayFiltered.cargahoraria - horarioFounded.horaCatedra;
        percentage = Math.round(100 - ((hoursRemaining * 100) / arrayFiltered.cargahoraria));
      }
      console.log(lastAttendance)
      console.log(hoursRemaining)
      console.log(percentage)
      user.attendances.push({
        registeredAt: cameraDate, 
        subjectCode: arrayFiltered.codigo,
        subjectName: arrayFiltered.materia,
        hoursRemaining: hoursRemaining,
        percentageCompleted: percentage
      });

      user.save(function (err) {
        console.log(err)
        if (!err) {
          console.log('Attendance saved!');
        }
      });
    }else{
      return next(new AppError('El alumno no está registrado en la aplicación.', 400)); 
    }
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Se ha registrado la asistencia correctamente a todos los estudiantes.'
  });    
});