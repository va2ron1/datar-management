var crypto = require('crypto');
var express = require('express');
var session = require('express-session');
var SequelizeStore = require('connect-session-sequelize')(session.Store);
const Sequelize = require('sequelize');
const path = require('path');
const { body, check, validationResult } = require('express-validator');
const { Pool } = require('pg');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1.js');
const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
  version: process.env.IBM_WATSON_VERSION,
  iam_apikey: process.env.IBM_WATSON_API_KEY,
  url: process.env.IBM_WATSON_URL
});

var app = express();

// External Non-core dependencies
const uuidv4 = require('uuid/v4');
let base64 = exports = {
  encode: function (unencoded) {
    return Buffer.from(unencoded).toString('base64');
  },
  decode: function (encoded) {
    return Buffer.from(encoded, 'base64').toString('utf8');
  }
};

// Database
const connectionData = {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
};
let db = new Pool(connectionData);

// Api Key generator
key_generator = () => {
  return base64.encode(uuidv4());
}

// Express json initializer
// app.use(express.json());
app.use(express.urlencoded({ extended: false }))
app.use(express.static('public'))
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// create database, ensure 'sqlite3' in your package.json
var sequelize = new Sequelize(
  process.env.POSTGRES_DB,
  process.env.POSTGRES_USER,
  process.env.POSTGRES_PASSWORD,
  {
    "host": process.env.POSTGRES_HOST,
    "dialect": "postgres",
    "logging": false
  }
);

var sequelizeStore = new SequelizeStore({
    db: sequelize
})

// Session initializer
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sequelizeStore,
  cookie: { maxAge: 60 * 60 * 1000 },
  resave: false,
  saveUninitialized: true,
}))

sequelizeStore.sync()

// responses base
var responses = function (req, res, next) {
  res.out = (statusCode, json, msg) => {
    res.writeHead(statusCode, {'Content-Type': 'application/json', 'X-Powered-By': 'Datar API Service'});
    res.end(JSON.stringify({status: res.statusMessage, data: json, message: msg}));
  };

  next();
};
app.use(responses);
//
// time convertion
function timeSince(createdAt) {
  var now = new Date();
  var timeStamp = new Date(Number(createdAt));
  var secondsPast = (now.getTime() - timeStamp.getTime()) / 1000;
  if(secondsPast < 60){
    return parseInt(secondsPast) + 's';
  }
  if(secondsPast < 3600){
    return parseInt(secondsPast/60) + 'm';
  }
  if(secondsPast <= 86400){
    return parseInt(secondsPast/3600) + 'h';
  }
  if(secondsPast > 86400){
      day = timeStamp.getDate();
      month = timeStamp.toDateString().match(/ [a-zA-Z]*/)[0].replace(" ","");
      year = timeStamp.getFullYear() == now.getFullYear() ? "" :  " "+timeStamp.getFullYear();
      return day + " " + month + year;
  }
}


// Key status
// 0 = created
// 1 = disable
// 2 = enable
// 3 = delete
// 4 = name changed

app.get('/signup', (req, res, next) => {
  res.render('signup');
})
app.post('/signup', [
  // username must be an email
  check('email').isEmail(),
  // password must be at least 5 chars long
  check('password').isLength({min: 5}),
  // check('confirmation', 'confirmation password field must have the same value as the password field')
  // .custom((value, { req }) => value === req.param('password'))
  body('confirmation').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }

    // Indicates the success of this synchronous custom validator
    return true;
  })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('signup', {errors: errors.errors[0].msg});
  }

  let email = req.body.email;
  let password = crypto.createHash('sha256').update(req.body.password).digest('base64');

  db.query('insert into users (email, password) values(\'' + email + '\', \'' + password + '\');')
  .then(response => {
    return res.render('login', {success: "The account successfully created."});
  })
  .catch(err => {
    if (err.code === "23505") {
      // return res.out(400, {
      //   "errors": [
      //     {
      //         "msg": "another account is registered with this email",
      //         "param": "email",
      //         "location": "body"
      //     }
      //   ]
      // }, undefined);
      return res.render('signup', {errors: "Another account is registered with this email"});
    } else {
      return res.render('signup', {errors: "Something wrong with the server"});
    }
  });
});

app.get('/login', (req, res, next) => {
  res.render('login');
})
app.post('/login', [
  // username must be an email
  check('email').isEmail(),
  // password must be at least 5 chars long
  check('password').exists()
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('login', {errors: "Your email or password are incorrect."});
  }

  let email = req.body.email;
  let password = crypto.createHash('sha256').update(req.body.password).digest('base64');

  db.query('select id, password from users where email = \'' + email + '\'')
  .then(response => {
    if (response.rowCount > 0) {
      if (password === response.rows[0].password) {
        req.session.regenerate(function(){
          req.session.user = response.rows[0].id;
          return res.redirect('/keys');
        });

      } else {
        return res.render('login', {errors: "Your email or password are incorrect."});
      }
    } else {
      return res.render('login', {errors: "Your email or password are incorrect."});
    }

  })
  .catch(err => {
    return res.render('login', {errors: "Your email or password are incorrect."});
  });
  // if (req.session.views) {
  //   req.session.views++
  //   res.setHeader('Content-Type', 'text/html')
  //   res.write('<p>views: ' + req.session.views + '</p>')
  //   res.write('<p>expires in: ' + (req.session.cookie.maxAge / 1000) + 's</p>')
  //   res.end()
  // } else {
  //   req.session.views = 1
  //   res.end('welcome to the session demo. refresh!')
  // }
})

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

app.get('/keys', (req, res, next) => {
  if (req.session.user) {
    var error = req.session.error;
    var success = req.session.success;
    var middle = req.session.middle;
    delete req.session.error;
    delete req.session.success;
    delete req.session.middle;

    db.query('select "createdAt", key, title, enabled from auth_keys where "user" = \'' + req.session.user + '\' order by "createdAt" desc')
    .then(response => {
      return res.render('keys', {errors: error, success: success, middle: middle, timeSince: timeSince, keys: response.rows});
    })
    .catch(err => {
      return res.render('login', {errors: "Something wrong with the server"});
    });
  } else {
    return res.redirect('/login');
  }
})

let history_method = (req, res, next) => {
  if (req.session.user) {
    let auth_key = '';
    if (req.params.auth_key)
      auth_key = 'and key = \'' + req.params.auth_key + '\'';
    db.query('select "createdAt", key, status, "user", "from" from history where "user" = \'' + req.session.user + '\' ' + auth_key + ' order by "createdAt" desc')
    .then(response => {
      return res.render('history', {histories: response.rows});
    })
    .catch(err => {
      return res.render('login', {errors: "Something wrong with the server"});
    });
  } else {
    return res.redirect('/login');
  }
}

app.get('/history/:auth_key', history_method);
app.get('/history', history_method)

app.post('/key/create', (req, res, next) => {
  if (req.session.user) {
    let key = key_generator();
    db.query('insert into auth_keys ("user", key, title) values(\'' + req.session.user + '\', \'' + key + '\', \'New App\')')
    .then(async response => {
      await db.query('insert into history ("user", key, status) values(\'' + req.session.user + '\', \'' + key + '\', 0)');
      req.session.success = "Successfully key created";
      return res.redirect('/keys');
    })
    .catch(err => {
      console.log(err);
      req.session.error = "Something wrong with the server";
      return res.redirect('/keys');
    });
  } else {
    return res.redirect('/login');
  }
})

app.post('/key/delete', [
  // key must be exist
  check('key').exists(),
], (req, res, next) => {
  if (req.session.user) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.session.error = "Something wrong with the server";
      return res.redirect('/keys');
    }

    let key = req.body.key;

    let sql = 'DELETE FROM "auth_keys" WHERE ctid = (SELECT ctid FROM "auth_keys" WHERE "key" = \'' + key + '\' and "user" = ' + req.session.user + ' and enabled = false LIMIT 1)';

    db.query(sql)
    .then(async response => {
      if (response.rowCount > 0) {
        await db.query('insert into history ("user", key, status) values(\'' + req.session.user + '\', \'' + key + '\', 3)');
        req.session.success = "Successfully key deleted";
        return res.redirect('/keys');
      } else {
        req.session.error = "Key doesn't exist, belong to your account or is disabled";
        return res.redirect('/keys');
      }
    })
    .catch(err => {
      req.session.error = "Something wrong with the server";
      return res.redirect('/keys');
    });
  } else {
    return res.redirect('/login');
  }
})

app.post('/key/:auth_key/update', [
  // key must be exist
  check('title').isLength({min: 1, max: 25})
], async (req, res, next) => {
  if (req.session.user && req.params.auth_key) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.session.error = "Please input a title (min: 1, max: 25)";
      return res.redirect('/keys');
    }

    let key = req.params.auth_key,
        title = req.body.title,
        enabled = req.body.enabled;

    let auth_key_old_data = await db.query('select title, enabled from auth_keys where key = \'' + req.params.auth_key + '\'');

    let sql = 'UPDATE auth_keys SET enabled = ' + (enabled == 'on' ? 'true' : 'false') + ', title = \'' + title + '\' WHERE "key" = \'' + key + '\' and "user" = ' + req.session.user;

    db.query(sql)
    .then(async response => {
      if (response.rowCount > 0) {
        if (auth_key_old_data.rows[0].title !== title)
          await db.query('insert into history ("user", key, status, "from") values(\'' + req.session.user + '\', \'' + key + '\', 4, \'\"' + auth_key_old_data.rows[0].title + '\"\')');
        if ((enabled == 'on' ? true : false) !== auth_key_old_data.rows[0].enabled)
          await db.query('insert into history ("user", key, status, "from") values(\'' + req.session.user + '\', \'' + key + '\', ' + (enabled == 'on' ? '2' : '1') + ', \'\"' + auth_key_old_data.rows[0].enabled + '\"\')');

        req.session.success = "Successfully updated the key";
        return res.redirect('/keys');
      } else {
        req.session.error = "Key doesn't exist or belong to your account";
        return res.redirect('/keys');
      }
    })
    .catch(err => {
      req.session.error = "Something wrong with the server";
      return res.redirect('/keys');
    });
  } else {
    return res.redirect('/login');
  }
})


app.use(function(req, res) {
  return res.redirect('/login');
});

var port = process.env.PORT || 3000
app.listen(port, function () {
  console.log('Example app listening on port 3000!');
});
