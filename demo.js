var crypto = require('crypto');
var express = require('express');
const path = require('path');
const { body, check, validationResult } = require('express-validator');
const axios = require('axios');

var app = express();

app.use(express.urlencoded({ extended: false }))
app.use(express.static('public'))
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/demo', (req, res, next) => {
  res.render('demo');
})
app.post('/search', [
  // require field
  check('search').exists(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('demo', {errors: "Please input all fields"});
  }

  let search = req.body.search;
  axios.get('https://api.datar.online/v1/data/NjhjMWQ2ZTMtMDA3Ny00MDcxLWJiOTUtMWFkOTM5YTc3ZGUz?search=' + search)
  .then((response) => {
    console.log(response);
    return res.render('demo', {results: response.data.data});
  })
  .catch((error) => {
    console.log(error);
    return res.render('demo', {errors: "Something wrong try again later."})
  })

})

app.post('/postData', [
  // require field
  check('data').exists(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('demo', {errors: "Please input all fields"});
  }

  let data = req.body.data;
  axios.post('https://api.datar.online/v1/data/NjhjMWQ2ZTMtMDA3Ny00MDcxLWJiOTUtMWFkOTM5YTc3ZGUz', {
	   "data": data
  })
  .then((response) => {
    return res.render('demo', {success: "Successfully posted"});
  })
  .catch((error) => {
    return res.render('demo', {errors: "Something wrong try again later."});
  })

})

app.use(function(req, res) {
  return res.redirect('/demo');
});

var port = process.env.PORT || 3002
app.listen(port, function () {
  console.log('Example app listening on port 3000!');
});
