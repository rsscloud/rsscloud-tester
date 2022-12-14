const config = require('./config');
const express = require('express');
const ws = require('ws');
const { engine } = require('express-handlebars');
const bodyParser = require('body-parser');
const EventEmitter = require('events').EventEmitter;
const logEmitter = new EventEmitter();
const request = require('request-promise-native');

const app = express();
const expressWs = require('express-ws')(app);

const urlencodedParser = bodyParser.urlencoded({ extended: false });

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

app.get('/', (req, res) => {
  const wshost = res.app.locals.host + ':' + res.app.locals.port;
  const session = 's' + getRndInteger(1000, 9999);
  res.render('home', { wshost, session });
}),

app.get('/feedupdated-:session', (req, res) => {
  const session = req.params.session;
  logEvent(session, `GET /feedupdated-${session} ${req.query.url}`);
  if (req.query.challenge) {
    res.send(req.query.challenge);
  } else {
    res.send('');
  }
});

app.post('/feedupdated-:session', urlencodedParser, (req, res) => {
  const session = req.params.session;
  logEvent(session, `POST /feedupdated-${session} ${req.body.url}`);
  res.send('');
});

app.post('/pleaseNotify', urlencodedParser, async (req, res) => {
  console.dir(req.body);
  let apiurl, session = req.body.session, feed = req.body.feed, omitdomain = req.body.omitdomain == '1';
  if ('80' === req.body.port) {
    apiurl = `https://${req.body.domain}${req.body.path}`;
  } else {
    apiurl = `https://${req.body.domain}:${req.body.port}${req.body.path}`;
  }
  // logEvent(session, `${apiurl} ${session} ${feed}`);
  await pleaseNotify(apiurl, session, feed, omitdomain)
  res.json(req.body);
})

app.ws('/viewLog', (ws, req) => {
    function sendLogEvent(logEvent) {
      console.log(`send: ${logEvent}`);
      ws.send(logEvent);
    }

    logEmitter.on('logged-event', sendLogEvent);

    ws.on('close', function () {
        logEmitter.removeListener('logged-event', sendLogEvent);
    });
});

const server = app.listen(config.port, () => {
  app.locals.host = config.domain;
  app.locals.port = server.address().port;

  console.log('Listening at http://%s:%s', app.locals.host, app.locals.port);
})

function getRndInteger(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum)) + minimum;
}

function logEvent(session, message) {
  console.log(`${session}: ${message}`)
  logEmitter.emit('logged-event', JSON.stringify({ session, message }));
}

async function pleaseNotify(apiurl, session, url1, omitdomain) {
    logEvent(session, `POST ${apiurl} ${url1}`);

    const opts = {
      method: 'POST',
      uri: apiurl,
      timeout: config.requestTimeout,
      form: {
        domain: config.domain,
        port: config.extport,
        path: `/feedupdated-${session}`,
        registerProcedure: '',
        protocol: 'http-post',
        url1: url1
      },
      resolveWithFullResponse: true
    };

    if (omitdomain) {
      delete opts.form.domain;
      opts.form.port = config.port;
    }

    console.dir(opts);

    const res = await request(opts);

    if (res.statusCode < 200 || res.statusCode > 299) {
        throw new Error('Notification Failed');
    }

    const body = htmlEntities(res.body);

    logEvent(session, `${res.statusCode} ${body}`);

    return true;
}

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
