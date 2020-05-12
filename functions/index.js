'use strict'
const functions = require('firebase-functions');
const admin = require("firebase-admin");
const rp = require("request-promise");
const config = functions.config();
const moment = require('moment')

const { App, ExpressReceiver } = require('@slack/bolt');
const { HomeView } = require('./view/app_home');

const { submitMeeting, editMeeting, deleteMeeting, scheduleMeeting, RSVP } = require('./yappy/meetings')
const { optIn, optOut } = require('./yappy/register')
const { sendMessagesToWorkspaces } = require('./yappy/messaging')

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

app.view('yappy_submit_meeting', async (resp) => {
  await submitMeeting(app, resp)
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

app.action('yappy_opt_in', async (resp) => {
  await optIn(app, resp)
});

app.action('yappy_opt_out', async (resp) => {
  await optOut(app, resp)
});

app.action('accept_yappy_session', async (resp) => {
  await RSVP.accept(app,resp)
});

app.action('decline_yappy_session', async (resp) => {
  await RSVP.decline(app, resp)
});

app.action('join_yappy_meeting', async ({ack}) => {
  await ack()
})

app.action('yappy_admin_schedule_meeting', async (resp) => {
  await scheduleMeeting(app, resp)
})

app.action('yappy_admin_menu', async ({ack,context, body}) => {
  await ack()
  const params = body.actions[0].selected_option.value.split('/')

  const [selectedOption, optionArg] = [params[0], params[1]]
  switch (selectedOption) {
    case "delete_meeting": {
        deleteMeeting(app, optionArg, {body, context})
      break
    }

    case "edit_meeting": {
        editMeeting(app, optionArg, {body,context})
      break
    }
  }
})

app.action('yappy_new_instant_meeting', async ({ack, context, body}) => {
  await ack()
  sendMessagesToWorkspaces(app, body.team.id)
})

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
          sendMessagesToWorkspaces(app, ws)
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