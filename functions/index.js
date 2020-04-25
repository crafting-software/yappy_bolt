'use strict'
const functions = require('firebase-functions');
const config = functions.config();

const { App, ExpressReceiver } = require('@slack/bolt');
const { HomeView } = require('./view/app_home');
const { getRandomMessage } = require('./strings')

const bot_token = "xoxb-1072067935878-1072261206806-YfbxRhub0P3yLvPlX9CdvNJV"
const expressReceiver = new ExpressReceiver({
    signingSecret: "fac4486e1ea0f0539ed46746296d17e8",
    endpoints: '/events'
});

const app = new App({
    receiver: expressReceiver,
    token: "xoxb-1072067935878-1072261206806-YfbxRhub0P3yLvPlX9CdvNJV"
});

// Global error handler
app.error(console.log);
// Handle `/echo` command invocations
app.command('/echo', async ({ command, ack, say }) => {
  // Acknowledge command request
  console.log('Requesting Echo Test');
  await ack();

  await say(`${command.text}`);
});

app.event("app_home_opened", async ({ context, event, say }) => {
  console.log(`Home Opened: token: ${bot_token}`);
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
      token: bot_token,
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
        token: bot_token,
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

// https://{your domain}.cloudfunctions.net/slack/events
// exports.slack = functions.https.onRequest(app);
exports.slack = functions.https.onRequest(async (req, res) => {
    expressReceiver.app(req, res);
});
