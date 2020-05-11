'use strict'
const functions = require('firebase-functions');
const admin = require("firebase-admin");
const rp = require("request-promise");
const config = functions.config();
const { v4 } = require('uuid');
const moment = require('moment')

const { App, ExpressReceiver } = require('@slack/bolt');
const { HomeView } = require('./view/app_home');
const { getRandomMessage } = require('./strings')

const { JoinMessage } = require('./view/join_message')
const { splitToChunks, parseTime } = require('./utils')
const { MessageHeadsup } = require('./view/message_heads_up')
const { SessionListMessage } = require('./view/session_list')
const { ScheduleMeetingModal } = require('./view/schedule_meeting_modal')
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

app.view('yappy_submit_meeting', async ({ ack, body, view, context }) => {
  await ack()

  const userId = body.user.id
  const workspaceId = body.team.id

  const user = await app.client.users.info({
    token: context.botToken,
    user: userId
  })

  const time = view.state.values.yappy_time_input_block.yappy_time_input.value
  const tz = user.user.tz
  const tz_offset = user.user.tz_offset

  const [hour, min] = parseTime(time)
  if (typeof hour == 'number' && typeof min == 'number'){

    const utcTime = moment.utc().hours(hour).minutes(min).subtract({seconds: tz_offset}).format('HH:mm')
    const [initialHour, initialMin] = parseTime(view.blocks[0].element.initial_value) || []
    let initialTime
    if(typeof initialHour == 'number' && typeof initialMin == 'number') {
      initialTime = moment.utc().hours(initialHour).minutes(initialMin).subtract({seconds: tz_offset}).format('HH:mm')
    }

    console.log(view.blocks[0].element.initial_value)

    await admin.database()
      .ref(`scheduled_sessions/${body.team.id}/${initialTime}`)
      .remove()

    await admin.database()
    .ref(`scheduled_sessions/${body.team.id}/${utcTime}`)
    .set({
        tz: tz,
        utc_time: utcTime,
        tz_offset: tz_offset
      })
  }
  
  const result = await app.client.views.publish({
    token: context.botToken,
    user_id: userId,
    view: await HomeView(user.user)
  });
  
})

app.event("app_home_opened", async ({ context, event, say, body }) => {
  const workspaceId = body.team_id

  const user = await app.client.users.info({
    token: context.botToken,
    user: event.user
  })

  const result = await app.client.views.publish({
    token: context.botToken,
    user_id: event.user,
    view: await HomeView(user.user)
  });
});

app.action('yappy_opt_in', async ({ack, say, context, body}) => {
  await ack()
  const workspaceId = body.team.id
  const userId = body.user.id

  const user = await app.client.users.info({
    token: context.botToken,
    user: userId
  })

  await admin.database()
    .ref(`users/${workspaceId}/${userId}`)
    .set(user.user.name)

  const result = await app.client.views.publish({
    token: context.botToken,
    user_id: userId,
    view: await HomeView(user.user)
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
    view: await HomeView(null)
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

app.action('yappy_admin_schedule_meeting', async ({ack, context, body}) => {
  await ack()
  await app.client.views.open({
    token: context.botToken,
    trigger_id: body.trigger_id,
    view: ScheduleMeetingModal()
  })
})

app.action('yappy_admin_menu', async ({ack,context, body}) => {
  await ack()
  const params = body.actions[0].selected_option.value.split('/')
  const workspaceId = body.team.id
  const userId = body.user.id

  const [selectedOption, optionArg] = [params[0], params[1]]
  switch (selectedOption) {
    case "delete_meeting": {
      await admin.database()
        .ref(`scheduled_sessions/${workspaceId}/${optionArg}`)
        .remove()
      console.log(`Deleted session at ${optionArg}`)


      const user = await app.client.users.info({
        token: context.botToken,
        user: userId
      })

      const result = await app.client.views.publish({
        token: context.botToken,
        user_id: userId,
        view: await HomeView(user.user)
      })
      break
    }

    case "edit_meeting": {

      const user = await app.client.users.info({
          token: context.botToken,
          user: userId
      })

      const [h, m] = optionArg.split(':')
      const localTime = moment()
        .clone()
        .hours(parseInt(h))
        .minutes(parseInt(m))
        .add(user.user.tz_offset, 'seconds').format('HH:mm')

      await app.client.views.open({
        token: context.botToken,
        trigger_id: body.trigger_id,
        view: ScheduleMeetingModal({ value : localTime })
      })

      const result = await app.client.views.publish({
        token: context.botToken,
        user_id: userId,
        view: await HomeView(user.user)
      })
      break
    }
  }
})

app.action('yappy_new_instant_meeting', async ({ack, context, body}) => {
  await ack()
  sendMessagesToWorkspaces(body.team.id)
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

async function sendMessagesToWorkspaces(workspaceId = null){
  var db = admin.database();
  var ref = db.ref(`installations${workspaceId? `/${workspaceId}` : ""}`);
  let snapshot = await ref.once("value", async function(data){
    let workspaces = workspaceId ? {workspace : data.val() } : data.val();
    for (let [key, workspace] of Object.entries(workspaces)) {
      console.log("Getting users for ", workspace.team.name)
      let meeting_request_id = v4();
      let users = await getSubscribedUsers(workspace);
      console.log(workspaces)
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
  timeoutSeconds: 60
}).pubsub.schedule('* * * * *').onRun(async context => {

  
  const utcTime = moment().clone().utc().format('HH:mm')
  const ref = admin.database().ref('scheduled_sessions')
  ref.once('value', async (data) => {
    const workspaces = data.val()

    for (const ws in workspaces){
      for (const session in workspaces[ws]) {
        if (session == utcTime){
          sendMessagesToWorkspaces(ws)
        }
      }
    }
  })
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
