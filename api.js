var express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1.js');
const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
  version: '2018-11-16',
  iam_apikey: '{apikey}',
  url: 'https://gateway.watsonplatform.net/natural-language-understanding/api'
});

var app = express();

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

// Express json initializer
app.use(express.json());

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

app.post('/api/data/:auth_key', (req, res, next) => {
  if (req.params.auth_key) {
    if (!req.body.data) {
      return res.out(400, {
        "errors": [
          {
              "msg": "data required",
              "param": "data"
          }
        ]
      }, undefined);
    }
    db.query('select key from auth_keys where key = \'' + req.params.auth_key + '\'')
    .then(response => {
      if (response.rowCount > 0) {
        new Promise((resolve, reject) => {
          const origData = req.body.data;
          let index = 0;
          // let urls = text.match(/(http|https|ftp|ftps)\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}(\/\S*)?/g);
          text = origData.replace(/(http|https|ftp|ftps)\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}(\/\S*)?/g, () => {
            index++;
            return "{url" + index + "}";
          })

          const analyzeParams = {
            'features': {
              "keywords": {},
              "entities": {}
            },
            'text': text
          };

          naturalLanguageUnderstanding.analyze(analyzeParams)
            .then(analysisResults => {
              axios.put('http://localhost:9200/watson/_doc/1?pretty', {
                data: origData,
                result: analysisResults
              })
              .then((res) => {
                console.log(`statusCode: ${res.statusCode}`)
                console.log(res)
              })
              .catch((error) => {
                console.error(error)
              })
            })
            .catch(err => {});
        })
        return res.out(200, undefined, response.rows);
      } else {
        return res.out(400, undefined, "API Key doesn't exist");
      }
    })
    .catch(err => {
      return res.out(400, undefined, "Something wrong with the server");
    });
  } else {
    return res.out(400, {
      "errors": [
        {
            "msg": "api key required",
            "param": "auth_key"
        }
      ]
    }, undefined);
  }
})

var port = process.env.PORT || 3001
app.listen(port, function () {
  console.log('Example app listening on port 3000!');
});
