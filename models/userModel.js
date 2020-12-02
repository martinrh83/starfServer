const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const Attendances = new mongoose.Schema({
  registeredAt: {type: Date, default: Date.now},
  hoursRemaining: {type: Number},
  percentageCompleted: {type: Number},
  subjectCode: {type: String},
  subjectName: {type: String}
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ingrese el nombre']
  },
  last_name: {
    type: String,
    required: [true, 'Ingrese el apellido']
  },
  legajo: {
    type: Number,
    required: [true, 'Ingrese el legajo'],
    unique: true
  },
  email: {
    type: String,
    required: [true, 'Ingrese el email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'INgrese un mail valido']
  },
  password: {
    type: String,
    required: [true, 'Debe ingresar una contraseña'],
    minlength: 8,
    select: false
  },
  passwordConfirm: {
    type: String,
    //required: [true, 'debe confirmar la contraseña']
    validate: {
      //this  only work on .CREATE and .SAVE
      validator: function(el) {
        return el === this.password;
      },
      message: 'Las contraseñan deben ser iguales'
    }
  },
  token: {
    type: String,
    select: false
  },
  attendances: [Attendances],
  passwordChangedAt: Date
});

userSchema.pre('save', async function(next){
  if(!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function(){
  if(!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.correctPassword = async function(candidatePassword, userPassword){
  return await bcrypt.compare(candidatePassword, userPassword);
}

userSchema.methods.changedPasswordAfter = function(JWTTimestamp){
  if(this.passwordChangedAt){
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    console.log(this.changedTimestamp);
    return JWTTimestamp < changedTimestamp;
  }

  // false means not changed
  return false;
}

const User = mongoose.model('User', userSchema);
module.exports = User;