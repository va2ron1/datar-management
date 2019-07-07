var crypto = require('crypto');
var express = require('express');
var session = require('express-session');
const path = require('path');
const { body, check, validationResult } = require('express-validator');
const { Pool } = require('pg');
const axios = require('axios');
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1.js');
const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
  version: '2018-11-16',
  iam_apikey: '',
  url: 'https://gateway.watsonplatform.net/natural-language-understanding/api'
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
  user: 'postgres',
  host: 'localhost',
  database: 'datar',
  password: '',
  port: 5432,
};
let db = new Pool(connectionData);
db.sendQuery = (query) => {
  return new Promise((next, error) => {
    pool.query(query, [], (err, result) => {
      if (err)
        error(err);
      else
        next(result);
    });
  });
};

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

// Session initializer
app.use(session({
  secret: 'keyboard cat',
  cookie: { maxAge: 60000 },
  resave: false,
  saveUninitialized: true,
}))


// responses base
var responses = function (req, res, next) {
  res.out = (statusCode, json, msg) => {
    // res.status(statusCode);
    // console.log(res.statusMessage);
    // res.json({status: res.statusMessage, data: json, message: msg});
    res.writeHead(statusCode, {'Content-Type': 'application/json', 'X-Powered-By': 'Data API Service'});
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
    return res.render('signup', {errors: "Please input all fields"});
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

    db.query('select "createdAt", key from auth_keys where "user" = \'' + req.session.user + '\'')
    .then(response => {
      return res.render('keys', {errors: error, success: success, middle: middle, timeSince: timeSince, keys: response.rows});
    })
    .catch(err => {
      console.log(err);
      return res.render('login', {errors: "Something wrong with the server"});
    });
  } else {
    return res.redirect('/login');
  }
})

app.post('/key/create', (req, res, next) => {
  if (req.session.user) {
    db.query('insert into auth_keys ("user", key) values(\'' + req.session.user + '\', \'' + key_generator() + '\')')
    .then(response => {
      req.session.success = "Successfully key created";
      return res.redirect('/keys');
    })
    .catch(err => {
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

    let sql = 'DELETE FROM "auth_keys" WHERE ctid = (SELECT ctid FROM "auth_keys" WHERE "key" = \'' + key + '\' and "user" = ' + req.session.user + ' LIMIT 1)';

    db.query(sql)
    .then(response => {
      if (response.rowCount > 0) {
        req.session.success = "Successfully key deleted";
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
