'use strict'
const functions = require('firebase-functions');
const config = functions.config();

const { App, ExpressReceiver } = require('@slack/bolt');
const { HomeView } = require('./view/app_home');
const { getRandomMessage } = require('./strings')
const { performGrouping } = require('./utils')

const expressReceiver = new ExpressReceiver({
    signingSecret: config.slack.signing_secret,
    endpoints: '/events'
});

const app = new App({
    receiver: expressReceiver,
    token: config.slack.bot_token
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

    const userPool = await getSubscribedUsers()
    const groups = performGrouping(userPool)
    for (let i = 0; i < groups.length; i++){
      broadcastMessage(groups[i], getRandomMessage())
    }
  }
  catch (error) {
    console.error(error);
  }
});


async function getSubscribedUsers() {
  
  let usersList = await app.client.conversations.members({
    token: config.slack.bot_token,
    channel: "C011W20B0ET"
  })

  let users = await usersList.members.map(async member => await app.client.users.info({
    token: config.slack.bot_token,
    user: member
  }))

  let list = []

  for (let userId of usersList.members){
    let user = await app.client.users.info({
      token: config.slack.bot_token,
      user: userId
    })
    list.push(user)
    // console.log(user) 
  }

  return list
}

function broadcastMessage(usersList, message){
  usersList.map(mb => {
    try {
      const result = app.client.chat.postEphemeral({
        token: config.slack.bot_token,
        channel: "C011W20B0ET",
        user: mb.user.id || mb.id || mb,
        text: message,
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
