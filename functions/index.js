'use strict'
const functions = require('firebase-functions');
const admin = require("firebase-admin");
const rp = require("request-promise");
const config = functions.config();
const { v4 } = require('uuid');

const { App, ExpressReceiver } = require('@slack/bolt');
const { HomeView } = require('./view/app_home');
const { getRandomMessage } = require('./strings')

const { JoinMessage } = require('./view/join_message')
const { performGrouping } = require('./utils')
const { MessageHeadsup } = require('./view/message_heads_up')
const { GroupManager } = require('./group_manager')

// let g = new GroupManager({bla: "blabla"});

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
  console.log('app_home_opened')
  const result = await app.client.views.publish({
    token: context.botToken,
    user_id: event.user,
    view: HomeView
  });
});

app.action('accept_yappy_session', async ({ ack, say, context, body, respond }) => {
  // Acknowledge action request
  console.log("Yapp accepted!")
  // console.log(body.user)
  console.log(body)
  await ack();
  // await say(`${body.user.username} accepted the challenge.`);
  await respond("Great, your session will start soon. I'll give you a ping.");
});

async function sendMessagesToWorkspaces(){
  console.log("Test");

  admin.database().ref("installations")

  var db = admin.database();
  var ref = db.ref("installations");
  let snapshot = await ref.once("value", async function(data){
    let workspaces = data.val();
    for (let [key, workspace] of Object.entries(workspaces)) {
      console.log("Getting users for ", workspace.team.name)
      let users = await getSubscribedUsers(workspace);
      // console.log(users)

      for(let user of users){
        const result = app.client.chat.postEphemeral({
          token: workspace.token,
          channel: workspace.webhook.channel_id,
          user: user.user.id,
          text: "Care to join a yappy meeting?",
          blocks: MessageHeadsup("This is the Blocks View")
        });
      }
    }
  })

  // snapshot.forEach(async function(data) {
  //   let workspace = data.val();

    // let users = getSubscribedUsers(workspace);
    // let users = await app.client.conversations.members({
    //   token: workspace.token,
    //   channel: workspace.webhook.channel_id
    // })
    // .then(users => {
    //   console.log(usersList)
    // })

    // console.log(users);

    // console.log(`Sending message to ${workspace.team.name} -> ${workspace.webhook.channel}`);
    // const result = app.client.chat.postEphemeral({
    //   token: workspace.token,
    //   channel: workspace.webhook.channel_id,
    //   user: workspace.bot_user_id,
    //   text: "Care to join a yappy meeting?",
    //   blocks: MessageHeadsup("This is the Blocks View")
    // });
  //   console.log(`Sent message to ${workspace.team.name} -> ${workspace.webhook.channel}`);
  // });
}

async function getSubscribedUsers(workspace) {
  let usersList = await app.client.conversations.members({
    token: workspace.token,
    channel: workspace.webhook.channel_id
  })
  console.log("Retrieved users list for:", workspace)
  console.log(usersList)

  let promises = usersList.members.map(async member => await app.client.users.info({
    token: workspace.token,
    user: member
  }))

  let users = await Promise.all(promises)
  return users
}

/*
  ========== Exported Functions ==========
*/

exports.slack = functions.https.onRequest(async (req, res) => {
  expressReceiver.app(req, res);
});

exports.scheduledFunction = functions.pubsub.schedule('every 1 minutes').onRun((context) => {
  console.log('every 1 minutes!');
  sendMessagesToWorkspaces();
  return null;
});

exports.test = functions.https.onRequest(async (request, response) => {

  await sendMessagesToWorkspaces();
  response.send("Test ok.")
});

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
      redirect_uri: "https://01cd4179.ngrok.io/yappy-cd44b/us-central1/oauth"
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
