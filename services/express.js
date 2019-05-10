const express = require('express')
const http = require('http')
const mongoose = require('mongoose')
const path = require('path')

// session
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const cookieParser = require('cookie-parser')
// body parse
const bodyParser = require('body-parser')

// local require
var config = require('./config.js')
var { debug, info, warn, error } = require('./logger.js')
var user = require('../collections/user.js')
const conf = require('../collections/config')
var auth = require('../middlewares/isAuth.js') //  认证判断
const repository = require('../collections/repository')
const dockerImage = require('../collections/image')
const vulnerability = require('../collections/vulnerability')
const dockerRepository = require('./dockerRepository')
const timedScan = require('./timedScan')
const { dbException } = require('../class/exceptions')
const common = require('./common')
const { databaseInit } = require('./databaseInit')

var sessionOption = {
  resave: true, //  save the session to the session store
  saveUninitialized: true, //
  secret: 'uwotm8',
  cookie: {
    path: '/', //  cookie
    httpOnly: true, //  use http or https
    secure: false,
    maxAge: null //  expires time in millionsecond
    // expires: ,
  }
  // name:
  // proxy:
  // rolling:
  // store:
  // unset:
}

// main logical
function startApp () {
  console.log('welcome to use, server is going to start')
  var app = express()
  common.connectToMongodb()
  databaseInit()
  initApp(app)
  /**refresh all repositories image list */
  setInterval(dockerRepository.freshRepository(), 1000 * 10)
  /**analyze image which cannot analyze first again */
  setInterval(dockerRepository.freshImage(), 1000 * 60 * 60)
  var server = http.Server(app)
  server.listen(app.get('port'), function () {
    info('listen at port:' + app.get('port'))
  })
}

function initApp (app) {
  app.set('port', config.port.http)
  // load body parse middleware
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(cookieParser())

  // load seesion middleware
  app.use(session(sessionOption)) //  session处理

  // config and load passport
  // cookie验证
  passport.use(new LocalStrategy(user.authenticate())) // 设置passport验证策略
  passport.serializeUser(user.serializeUser()) // passport将user对象序列化为cookie值
  passport.deserializeUser(user.deserializeUser()) //  passport将cookie值反序列化为user对象
  app.use(passport.initialize()) //  passport初始化
  app.use(passport.session()) //  引入passport的session, passport会检查cookie并填充req.user

  // load static source
  // app.use(express.static(path.join(__dirname, 'public')))
  debug('middware load done')

  // 添加response header, 解决跨域问题
  app.use(require('../middlewares/resHeader'))

  app.use('/api/auth', require('../routers/index.js')) // 认证
  //   app.use(express.static(path.join(__dirname, '/../public')))
  //   app.use('/static', express.static(path.join(__dirname, '/../public')))
  app.use('/api/repository', auth, require('../routers/repositoryRouter'))
  app.use('/api/scanner', auth, require('../routers/scannerRouter'))
  app.use('/api/score', auth, require('../routers/scoreRouter'))
}



module.exports = {
  startApp,
}
