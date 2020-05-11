const moment = require('moment')
const admin = require("firebase-admin");
const { parseTime } = require('../utils')
const { HomeView } = require('../view/app_home')

module.exports.optIn = async (app, {ack, say, context, body}) => {
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
}

module.exports.optOut = async (app, {ack, say, context, body}) => {
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
}