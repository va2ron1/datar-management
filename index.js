let crypto = require('crypto');
let express = require('express');
let session = require('express-session');
let SequelizeStore = require('connect-session-sequelize')(session.Store);
const Sequelize = require('sequelize');
const path = require('path');
const { body, check, validationResult } = require('express-validator');
const { Pool } = require('pg');
const axios = require('axios');

// Load environment variables
require('dotenv').config();

// Initialized express
let app = express();

// External and custom hash/encrypt methods
const uuidv4 = require('uuid/v4');
let base64 = exports = {
  encode: function (unencoded) {
    return Buffer.from(unencoded).toString('base64');
  },
  decode: function (encoded) {
    return Buffer.from(encoded, 'base64').toString('utf8');
  }
};

// Database credentials
const connectionData = {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
};
// Initialized postgres database pooling
let db = new Pool(connectionData);

// API Key generator method
key_generator = () => {
  return base64.encode(uuidv4());
}

// Express configuration
app.use(express.urlencoded({ extended: false }))
app.use(express.static('public'))
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Setup and Initialize Sequelize database
let sequelize = new Sequelize(
  process.env.POSTGRES_DB,
  process.env.POSTGRES_USER,
  process.env.POSTGRES_PASSWORD,
  {
    "host": process.env.POSTGRES_HOST,
    "dialect": "postgres",
    "logging": false
  }
);

// Setup and Initialize Sequelize Store
let sequelizeStore = new SequelizeStore({
    db: sequelize
})

// Express Session initializer with sequelize store
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sequelizeStore,
  cookie: { maxAge: 60 * 60 * 1000 },
  resave: false,
  saveUninitialized: true,
}))

// Sync session database
sequelizeStore.sync()

// Responses base
let responses = function (req, res, next) {
  res.out = (statusCode, json, msg) => {
    res.writeHead(statusCode, {'Content-Type': 'application/json', 'X-Powered-By': 'Datar API Service'});
    res.end(JSON.stringify({status: res.statusMessage, data: json, message: msg}));
  };

  next();
};
app.use(responses);

// Time convertion for frontend visualizer
function timeSince(createdAt) {
  let now = new Date();
  let timeStamp = new Date(Number(createdAt));
  let secondsPast = (now.getTime() - timeStamp.getTime()) / 1000;
  if(secondsPast < 60){
    return parseInt(secondsPast) + 's ago';
  }
  if(secondsPast < 3600){
    return parseInt(secondsPast/60) + 'm ago';
  }
  if(secondsPast <= 86400){
    return parseInt(secondsPast/3600) + 'h ago';
  }
  if(secondsPast > 86400){
      day = timeStamp.getDate();
      month = timeStamp.toDateString().match(/ [a-zA-Z]*/)[0].replace(" ","");
      year = timeStamp.getFullYear();
      return day + " " + month + " " + year;
  }
}

// Key status
// 0 = created
// 1 = disable
// 2 = enable
// 3 = delete
// 4 = name changed

// Render signup page
app.get('/signup', (req, res, next) => {
  res.render('signup');
});

// Signup post endpoint
app.post('/signup', [
  // email attribute must be an email
  check('email').isEmail(),
  // password must be at least 5 chars long
  check('password').isLength({min: 5}),
  // confirmation field must be the same as password
  body('confirmation').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  })
], (req, res) => {
  // Validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('signup', {errors: errors.errors[0].msg});
  }

  // Some easy variables and password hash
  let email = req.body.email;
  let password = crypto.createHash('sha256').update(req.body.password).digest('base64');

  // Create account
  db.query('insert into users (email, password) values(\'' + email + '\', \'' + password + '\');')
  .then(response => {
    return res.render('login', {success: "The account successfully created."});
  })
  .catch(err => {
    if (err.code === "23505") {
      return res.render('signup', {errors: "Another account is registered with this email"});
    } else {
      return res.render('signup', {errors: "Something wrong with the server"});
    }
  });
});

// Render login page
app.get('/login', (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/keys');
  }
  return res.render('login');
});

// Render keys page
app.post('/login', [
  // email attribute must be an email
  check('email').isEmail(),
  // password must be at least 5 chars long
  check('password').exists()
], (req, res, next) => {
  // Validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('login', {errors: "Your email or password are incorrect."});
  }

  // Some easy variables and password hash
  let email = req.body.email;
  let password = crypto.createHash('sha256').update(req.body.password).digest('base64');

  // Look up account
  db.query('select id, password from users where email = \'' + email + '\'')
  .then(response => {
    // if user exists check password and create session.
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
});

// Logout endpoint
app.get('/logout', function(req, res){
  // Destroy the user session to log them out
  req.session.destroy(function(){
    res.redirect('/');
  });
});

// Render keys page
app.get('/keys', (req, res, next) => {
  // if user is loggedin, then
  if (req.session.user) {
    // get system status and remove it from session
    let error = req.session.error;
    let success = req.session.success;
    let middle = req.session.middle;
    delete req.session.error;
    delete req.session.success;
    delete req.session.middle;

    // initialized and get pagination page if exists
    let page = 1;
    let queryPage = parseInt(req.query.page);
    if (queryPage && queryPage > 0)
      page = queryPage

    // Look up for keys from "user"
    db.query('select count(*) OVER() AS "count", "createdAt", key, title, origins, enabled from auth_keys where "user" = \'' + req.session.user + '\' order by "createdAt" desc  LIMIT 5 OFFSET ' + ((page - 1) * 5))
    .then(response => {
      // workaround fix when no data exists
      let count = 0;
      if (response.rows.length > 0)
        count = response.rows[0].count

      // create and initialized pagination widget with requested data
      const paginate = require('paginate')();
      let pagination = paginate.page(count, 5, page);
      const html = pagination.render({ baseUrl: '/keys' });

      return res.render('keys', {title: 'API Keys Management', errors: error, success: success, middle: middle, timeSince: timeSince, keys: response.rows, pagination_html: html });
    })
    .catch(err => {
      return res.render('login', {errors: "Something wrong with the server"});
    });
  } else {
    return res.redirect('/login');
  }
});

// History endpoint callback for single and all histories
let history_method = (req, res, next) => {
  // if user is loggedin, then
  if (req.session.user) {
    // if is the histories from a single, we added the filter
    let auth_key = '';
    if (req.params.auth_key)
      auth_key = 'and key = \'' + req.params.auth_key + '\'';

    // initialized and get pagination page if exists
    let page = 1;
    let queryPage = parseInt(req.query.page);
    if (queryPage && queryPage > 0)
        page = queryPage

    // Look up for keys from "user" with or without key filtering
    db.query('select count(*) OVER() AS "count", "createdAt", key, status, "user", "from" from history where "user" = \'' + req.session.user + '\' ' + auth_key + ' order by "createdAt" desc LIMIT 8 OFFSET ' + ((page - 1) * 8))
    .then(response => {
      // workaround fix when no data exists
      let count = 0;
      if (response.rows.length > 0)
        count = response.rows[0].count

      // create and initialized pagination widget with requested data
      const paginate = require('paginate')();
      let pagination = paginate.page(count, 8, page);
      const html = pagination.render({ baseUrl: '/history' });

      return res.render('history', {title: 'Histories', histories: response.rows, pagination_html: html});
    })
    .catch(err => {
      // set system status in session
      req.session.error = "Something wrong with the server";
      return res.redirect('/keys');
    });
  } else {
    return res.redirect('/login');
  }
}

// History post endpoints
app.get('/history/:auth_key', history_method);
app.get('/history', history_method)

// Key create request endpoint
app.post('/key/create', (req, res, next) => {
  // if user is loggedin, then
  if (req.session.user) {
    // generate key with the generator
    let key = key_generator();
    // insert generated key for current user into database
    db.query('insert into auth_keys ("user", key, title) values(\'' + req.session.user + '\', \'' + key + '\', \'New App\')')
    .then(async response => {
      // insert success status for current user into database
      await db.query('insert into history ("user", key, status) values(\'' + req.session.user + '\', \'' + key + '\', 0)');
      // set system status in session
      req.session.success = "Successfully key created";
      return res.redirect('/keys');
    })
    .catch(err => {
      // set system status in session
      req.session.error = "Something wrong with the server";
      return res.redirect('/keys');
    });
  } else {
    return res.redirect('/login');
  }
})

// Key delete request endpoint
app.post('/key/delete', [
  // key must exist
  check('key').exists(),
], (req, res, next) => {
  // if user is loggedin, then
  if (req.session.user) {
    // Validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // set system status in session
      req.session.error = "Something wrong with the server";
      return res.redirect('/keys');
    }

    // Some easy variables
    let key = req.body.key;
    // Delete requested key
    db.query('DELETE FROM "auth_keys" WHERE ctid = (SELECT ctid FROM "auth_keys" WHERE "key" = \'' + key + '\' and "user" = ' + req.session.user + ' and enabled = false LIMIT 1)')
    .then(async response => {
      if (response.rowCount > 0) {
        // insert success status for current user into database
        await db.query('insert into history ("user", key, status) values(\'' + req.session.user + '\', \'' + key + '\', 3)');
        // set system status in session
        req.session.success = "Successfully key deleted";
        return res.redirect('/keys');
      } else {
        // set system status in session
        req.session.error = "Key doesn't exist, belong to your account or is disabled";
        return res.redirect('/keys');
      }
    })
    .catch(err => {
      // set system status in session
      req.session.error = "Something wrong with the server";
      return res.redirect('/keys');
    });
  } else {
    return res.redirect('/login');
  }
})

// Key update request endpoint
app.post('/key/:auth_key/update', [
  // key must exist
  check('title').isLength({min: 1, max: 25})
], async (req, res, next) => {
  // if user is loggedin and key exist in parameters, then
  if (req.session.user && req.params.auth_key) {
    // Validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // set system status in session
      req.session.error = "Please input a title (min: 1, max: 25)";
      return res.redirect('/keys');
    }

    // Url checker with or without http:// or https://
    // https://www.regextester.com/93652
    let origins = req.body.origins.match(/(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}(:[0-9]{1,5})?(\/.*)?/g);
    if (!origins)
      origins = ['*'];

    // Some easy variables
    let key = req.params.auth_key,
        title = req.body.title,
        enabled = req.body.enabled;

    // Get old key data to update history
    let auth_key_old_data = await db.query('select title, enabled from auth_keys where key = \'' + req.params.auth_key + '\'');

    // Upate key
    db.query('UPDATE auth_keys SET enabled = ' + (enabled == 'on' ? 'true' : 'false') + ', title = \'' + title + '\', origins = \'' + JSON.stringify(origins) + '\' WHERE "key" = \'' + key + '\' and "user" = ' + req.session.user)
    .then(async response => {
      if (response.rowCount > 0) {
        if (auth_key_old_data.rows[0].title !== title)
          // insert title changed status for current user into database
          await db.query('insert into history ("user", key, status, "from") values(\'' + req.session.user + '\', \'' + key + '\', 4, \'\"' + auth_key_old_data.rows[0].title + '\"\')');
        if ((enabled == 'on' ? true : false) !== auth_key_old_data.rows[0].enabled)
          // insert enabled key status for current user into database
          await db.query('insert into history ("user", key, status, "from") values(\'' + req.session.user + '\', \'' + key + '\', ' + (enabled == 'on' ? '2' : '1') + ', \'\"' + auth_key_old_data.rows[0].enabled + '\"\')');
        // set system status in session
        req.session.success = "Successfully updated the key";
        return res.redirect('/keys');
      } else {
        // set system status in session
        req.session.error = "Key doesn't exist or belong to your account";
        return res.redirect('/keys');
      }
    })
    .catch(err => {
      // set system status in session
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

let port = process.env.PORT || 3000
app.listen(port, function () {
  console.log('DATAR API Management running at port', port, '!');
});
