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
const { splitToChunks } = require('./utils')
const { MessageHeadsup } = require('./view/message_heads_up')
const { GroupManager } = require('./group_manager')

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
  console.log(`Yapp accepted by ${body.user.name}`);
  let user_id = body.user.id;
  let meeting_request_id = body.actions[0].value;
  var usersRef = admin.database()
    .ref(`sessions/${body.user.team_id}/${meeting_request_id}`)
    .push(body.user);

  await ack();
  await respond("Great, your session will start soon. I'll give you a ping.");
});

async function sendMeetingLinksToWorkspace(workspace, meeting_request_id) {
  console.log("Users who accepted the call from team ", workspace.team.name)

  var db = admin.database();
  var ref = db.ref(`sessions/${workspace.team.id}/${meeting_request_id}`);
  let snapshot = await ref.once("value", async function(data){
    let users = data.val();

    let cleanUsers = Object.entries(users).map(entry => {
      return entry[1];
    });

    let groups = splitToChunks(cleanUsers, 2);

    console.log("Sending meeting links to groups...")

    for (let group of groups) {
      let meeting_group_id = v4().replace(/-/g,"");
      let meeting_url = `https://8x8.vc/440607796/${meeting_group_id}`
      for(let user of group) {
        const result = app.client.chat.postEphemeral({
          token: workspace.token,
          channel: workspace.webhook.channel_id,
          user: user.id,
          text: "Time to join your yapping meeting.",
          blocks: JoinMessage(meeting_url)
        });
      }
    }
  })
}

async function sendMessagesToWorkspaces(){
  var db = admin.database();
  var ref = db.ref("installations");
  let snapshot = await ref.once("value", async function(data){
    let workspaces = data.val();
    for (let [key, workspace] of Object.entries(workspaces)) {
      console.log("Getting users for ", workspace.team.name)
      let meeting_request_id = v4();
      let users = await getSubscribedUsers(workspace);

      for(let user of users){
        let inviteMessage = getRandomMessage();
        const result = app.client.chat.postEphemeral({
          token: workspace.token,
          channel: workspace.webhook.channel_id,
          user: user.user.id,
          text: inviteMessage,
          blocks: MessageHeadsup(inviteMessage, meeting_request_id)
        });
      }

      setTimeout(function(){
        sendMeetingLinksToWorkspace(workspace, meeting_request_id);
      }, 60000 * 10)
    }
  })
}

async function getSubscribedUsers(workspace) {
  let usersList = await app.client.conversations.members({
    token: workspace.token,
    channel: workspace.webhook.channel_id
  })

  let promises = usersList.members.map(async member => await app.client.users.info({
    token: workspace.token,
    user: member
  }))

  let users = await Promise.all(promises)
  console.log("Retrieved users list for:", workspace)
  return users
}

/*
  ========== Exported Functions ==========
*/

exports.slack = functions.https.onRequest(async (req, res) => {
  expressReceiver.app(req, res);
});

exports.scheduledFunction = functions.pubsub.schedule('5 12 * * *').timeZone('Europe/Bucharest').onRun((context) => {
  sendMessagesToWorkspaces();
  return null;
});

exports.test = functions.https.onRequest(async (request, response) => {
  await sendMessagesToWorkspaces();
  return null;
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
      redirect_uri: "https://us-central1-yappy-cd44b.cloudfunctions.net/oauth"
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
