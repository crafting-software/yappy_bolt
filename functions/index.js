"use strict";
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const config = functions.config();
const { CloudFunctions } = require("./cloud_functions");

const { ExpressReceiver } = require("@slack/bolt");
const { sendMessagesToWorkspaces } = require("./yappy/messaging");
const { Yappy } = require("./app");
const { webserver } = require("./web/express_server");

const expressReceiver = new ExpressReceiver({
  signingSecret: config.slack.signing_secret,
  endpoints: "/events",
});

var serviceAccount = require("./yappy_service_account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://yappy-79985.firebaseio.com",
});

const app = Yappy(expressReceiver);

/*
  ========== Exported Functions ==========
*/

exports.slack = functions
  .runWith({ memory: "2GB" })
  .https.onRequest(async (req, res) => {
    console.log("started server");
    app.receiver.app(req, res);
  });

exports.scheduledFunction = functions
  .runWith({
    timeoutSeconds: 60,
  })
  .pubsub.schedule("* * * * *")
  .onRun(async (context) => {
    CloudFunctions.sessionManager(app);
  });

exports.userPresenceTracker = functions
  .runWith({
    timeoutSeconds: 60,
  })
  .pubsub.schedule("* * * * *")
  .onRun(async (context) => {
    CloudFunctions.userPresenceTracker(app);
  });

exports.test = functions.https.onRequest(async (request, response) => {
  await sendMessagesToWorkspaces();
  return null;
});

exports.oauth = functions.https.onRequest(async (request, response) => {
  CloudFunctions.oauth(request, response);
});

exports.web = functions.https.onRequest(webserver);
