'use strict'
const functions = require('firebase-functions');
const admin = require("firebase-admin");
const rp = require("request-promise");
const config = functions.config();

const { App, ExpressReceiver } = require('@slack/bolt');
const { HomeView } = require('./view/app_home');
const { getRandomMessage } = require('./strings')

const expressReceiver = new ExpressReceiver({
    signingSecret: config.slack.signing_secret,
    endpoints: '/events'
});

const app = new App({
    receiver: expressReceiver,
    token: config.slack.bot_token
});

var serviceAccount = require("./yappy_service_account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://yappy-cd44b.firebaseio.com"
});

// Global error handler
app.error(console.log);
// Handle `/echo` command invocations
app.command('/echo-from-firebase', async ({ command, ack, say }) => {
  // Acknowledge command request
  console.log(functions.config().firebase)
  console.log('Requesting Echo Test');
  await ack();

  await say(`${command.text}`);
});

app.event("app_home_opened", async ({ context, event, say }) => {
  try {
    console.log('app_home_opened')
    /* view.publish is the method that your app uses to push a view to the Home tab */
    const result = await app.client.views.publish({

      /* retrieves your xoxb token from context */
      token: context.botToken,

      /* the user that opened your app's app home */
      user_id: event.user,

      /* the view payload that appears in the app home*/
      view: HomeView
    });

    broadcastMessage(await app.client.conversations.members({
      token: config.slack.bot_token,
      channel: "C011W20B0ET"
    }))
  }
  catch (error) {
    console.error(error);
  }
});

function broadcastMessage(usersList, message) {
  usersList.members.map(mb => {
    try {
      console.log(mb)
      const result = app.client.chat.postEphemeral({
        token: config.slack.bot_token,
        channel: "yappy",
        user: mb.id || mb,
        text: getRandomMessage(),
      });
    }
    catch (error) {
      console.error(error);
    }
  })
}

exports.slack = functions.https.onRequest(async (req, res) => {
  expressReceiver.app(req, res);
});

exports.scheduledFunction = functions.pubsub.schedule('every 1 minutes').onRun((context) => {
  console.log('every 1 minutes!');
  sendMessagesToWorkspaces();
  return null;
});

exports.test = functions.https.onRequest(async (request, response) => {

  sendMessagesToWorkspaces();
  response.send("Test ok.")
});

async function sendMessagesToWorkspaces(){
  console.log("Test");

  admin.database().ref("installations")

  var db = admin.database();
  var ref = db.ref("installations");
  await ref.once("value", function(snapshot) {

    snapshot.forEach(function(data) {
      let workspace = data.val();
      console.log(`Sending message to ${workspace.team.name} -> ${workspace.webhook.channel}`);
      const result = app.client.chat.postMessage({
        token: workspace.token,
        channel: workspace.webhook.channel_id,
        user: workspace.bot_user_id,
        text: "This is using the database"
      });
      console.log(`Sent message to ${workspace.team.name} -> ${workspace.webhook.channel}`);
    });

  });
}

exports.oauth = functions.https.onRequest(async (request, response) => {
  console.log("Requested OAuth Flow...")

  if (request.method !== "GET") {
    console.error(`Got unsupported ${request.method} request. Expected GET.`);
    return response.send(405, "Only GET requests are accepted");
  }

  console.log("Checking params...")

  if (!request.query && !request.query.code) {
      return response.status(401).send("Missing query attribute 'code'");
  }

  console.log("Request is ok, initiating handshake...")

  const options = {
    uri: "https://slack.com/api/oauth.v2.access",
    method: "GET",
    json: true,
    qs: {
      code: request.query.code,
      client_id: functions.config().slack.client_id,
      client_secret: functions.config().slack.client_secret,
      redirect_uri: "https://5af759f7.ngrok.io/yappy-cd44b/us-central1/oauth"
    }
  };

  const result = await rp(options);
  if (!result.ok) {
    console.error("The request was not ok: " + JSON.stringify(result));
    return response.header("Location", 'https://yappy-cd44b.web.app').send(302);
  }

  console.log("OAuth Success!")
  console.log(result)

  await admin.database().ref("installations").child(result.team.id).set({
    token: result.access_token,
    team: {
      id: result.team.id,
      name: result.team.name
    },
    bot_user_id: result.bot_user_id,
    webhook: {
        url: result.incoming_webhook.url,
        channel: result.incoming_webhook.channel,
        channel_id: result.incoming_webhook.channel_id
    }
  });

  console.log("A new workspace installed Yappy!")
  response.header("Location", 'https://yappy-cd44b.web.app/success.html').send(302);
});
