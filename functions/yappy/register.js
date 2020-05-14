const moment = require('moment')
const admin = require("firebase-admin");
const { parseTime } = require('../utils')
const { HomeView } = require('../view/app_home')
const { FeedbackRequestMessage } = require('../view/feedback_request_message')

module.exports.optIn = async (app, {ack, say, context, body}) => {
    await ack()
    const workspaceId = body.team.id
    const userId = body.user.id

    const user = await app.client.users.info({
      token: context.botToken,
      user: userId
    })

    await admin.database()
      .ref(`users/${workspaceId}/${userId}/username`)
      .set(user.user.name)
  
    const result = await app.client.views.publish({
      token: context.botToken,
      user_id: userId,
      view: await HomeView(user.user)
    })
}

module.exports.optOut = async (app, {ack, payload, context, body}) => {
  await ack()
  const workspaceId = body.team.id
  const userId = body.user.id

  await admin.database()
    .ref(`users/${workspaceId}/${userId}`)
    .remove()
    
  await app.client.views.publish({
    token: context.botToken,
    user_id: userId,
    view: await HomeView(body.user)
  })

  await app.client.chat.postMessage({
    token: context.botToken,
    channel: userId,
    text: "Please provide some feedback to improve Yappy.\nYou can do this via direct message."
  })
}