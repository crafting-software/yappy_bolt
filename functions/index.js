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
const { SessionListMessage } = require('./view/session_list')
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
  databaseURL: "https://yappy-79985.firebaseio.com"
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

app.event("app_home_opened", async ({ context, event, say, body }) => {
  const workspaceId = body.team_id
  const ref = await admin.database()
    .ref(`users/${workspaceId}/${event.user}`)
    await ref.once("value", async function(data){
      const user = data.val()

      const result = await app.client.views.publish({
        token: context.botToken,
        user_id: event.user,
        view: HomeView(user)
      });
    })
});

app.action('yappy_opt_in', async ({ack, say, context, body}) => {
  await ack()
  const workspaceId = body.team.id
  const userId = body.user.id

  await admin.database()
    .ref(`users/${workspaceId}/${userId}`)
    .set(body.user.username)

  const result = await app.client.views.publish({
    token: context.botToken,
    user_id: userId,
    view: HomeView(userId)
  })
});

app.action('yappy_opt_out', async ({ack, say, context, body}) => {
  await ack()
  const workspaceId = body.team.id
  const userId = body.user.id

  await admin.database()
    .ref(`users/${workspaceId}/${userId}`)
    .remove()

  const result = await app.client.views.publish({
    token: context.botToken,
    user_id: userId,
    view: HomeView(null)
  })
});

app.action('accept_yappy_session', async ({ ack, say, context, body, respond }) => {
  await ack();
  await respond("Great, your session will start soon. I'll give you a ping.");
  console.log(`Yapp accepted by ${body.user.name}`);
  let user_id = body.user.id;
  let meeting_request_id = body.actions[0].value;
  var usersRef = await admin.database()
    .ref(`sessions/${body.user.team_id}/${meeting_request_id}/${body.user.id}`)
    .set('accepted');
});

app.action('decline_yappy_session', async ({ ack, say, context, body, respond }) => {
  await ack();
  await respond('If you change your mind, I\'ll show you the sessions you can join.');
  console.log(`Yapp declined by ${body.user.name}`);
  let meeting_request_id = body.actions[0].value;
  var usersRef = await admin.database()
    .ref(`sessions/${body.user.team_id}/${meeting_request_id}/${body.user.id}`)
    .set('declined');
});

app.action('join_yappy_meeting', async ({ack}) => {
  await ack()
})

async function sendMeetingLinksToWorkspace(workspace, meeting_request_id) {
  console.log("Users who accepted the call from team ", workspace.team.name)

  var db = admin.database();
  var ref = db.ref(`sessions/${workspace.team.id}/${meeting_request_id}`);
  let snapshot = await ref.once("value", async function(data){
    const users = data.val()

    if (users){
      const accepted = Object.entries(users).filter(user => user[1] == 'accepted')
      const maybe = Object.entries(users).filter(user => user[1] == 'declined')

      let groups = splitToChunks(accepted, 2);

      console.log("Sending meeting links to groups...")
      const ongoingMeetings = []

      for (let group of groups) {
        let meeting_group_id = v4().replace(/-/g,"");
        let meeting_url = `https://8x8.vc/440607796/${meeting_group_id}`
        ongoingMeetings.push(meeting_url)

        for(let user of group) {
          const result = app.client.chat.postMessage({
            token: workspace.token,
            channel: user[0],
            text: "Time to join your yapping meeting.",
            blocks: JoinMessage(meeting_url, "Don't hold back. Join others to start yapping.")
          });
        }

        for (const user of maybe) {
          const result = app.client.chat.postMessage({
            token: workspace.token,
            text: `In case you changed your mind, there are some sessions in progress you can join`,
            channel: user[0],
            blocks: SessionListMessage(ongoingMeetings) 
          })
        }
      }
    }
    else console.log("Nobody")
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
        const result = app.client.chat.postMessage({
          token: workspace.token,
          channel: user,
          text: inviteMessage,
          blocks: MessageHeadsup(inviteMessage, meeting_request_id)
        });
      }

      setTimeout(function(){
        sendMeetingLinksToWorkspace(workspace, meeting_request_id);
      }, 60000 * 5)
    }
  })
}

async function getSubscribedUsers(workspace) {
  let usersList = await app.client.conversations.members({
    token: workspace.token,
    channel: workspace.webhook.channel_id
  })
  let usersRef = await admin.database()
    .ref(`users/${workspace.team.id}`)

  const onlineUsers = await usersRef.once("value", async function(data){
    const snapshot = data.val()

    let promises = Object.entries(snapshot).map(async member => await app.client.users.info({
      token: workspace.token,
      user: member[0]
    }))

    let users = await Promise.all(promises)
      .then(users => users.map(async user => {
        user.status = await app.client.users.getPresence({
          token: workspace.token,
          user: user.user.id
        })
        return user
      }))
      .then(users => Promise.all(users))

      return users.filter(user => user.status.presence == "active")
  })

  console.log("Retrieved users list for:", workspace)
  console.log(onlineUsers.val())

  const usersArray = Object.entries(onlineUsers.val()).map(user => user[0])

  console.log(`Active users in ${workspace.team.name} : ${usersArray.length}`)

  return usersArray
}

/*
  ========== Exported Functions ==========
*/

exports.slack = functions.https.onRequest(async (req, res) => {
  console.log('started server')
  expressReceiver.app(req, res);
});

exports.scheduledFunction = functions.runWith({
  timeoutSeconds: 540
}).pubsub.schedule('5 12 * * *').timeZone('Europe/Bucharest').onRun((context) => {
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
      redirect_uri: "https://us-central1-yappy-79985.cloudfunctions.net/oauth"
    }
  };

  const result = await rp(options);
  if (!result.ok) {
    console.error("The request was not ok: " + JSON.stringify(result));
    return response.header("Location", 'https://yappy-79985.web.app').send(302);
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
  response.header("Location", 'https://yappy-79985.web.app/success.html').send(302);
});
