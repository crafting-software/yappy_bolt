const moment = require("moment");
const admin = require("firebase-admin");
const { parseTime } = require("../utils");
const { HomeView } = require("../view/app_home");
const { FeedbackRequestMessage } = require("../view/feedback_request_message");

module.exports.optIn = async (app, { ack, say, context, body }) => {
  await ack();
  const workspaceId = body.team.id;
  const userId = body.user.id;

  const token = context.botToken;

  const user = await app.client.users.info({
    token: token,
    user: userId,
  });

  await admin.database().ref(`users/${workspaceId}/${userId}`).set({
    name: user.user.name,
    id: user.user.id,
    avatar: user.user.profile.image_48,
    tz_offset: user.user.tz_offset,
  });

  const result = await app.client.views.publish({
    token: token,
    user_id: userId,
    view: await HomeView(user.user),
  });
};

module.exports.optOut = async (app, { ack, payload, context, body }) => {
  await ack();
  const workspaceId = body.team.id;
  const userId = body.user.id;
  console.log("workspace " + workspaceId);

  const token = context.botToken;
  await admin.database().ref(`users/${workspaceId}/${userId}`).remove();

  await app.client.views.publish({
    token: token,
    user_id: userId,
    view: await HomeView(body.user),
  });

  await app.client.chat.postMessage({
    token: token,
    channel: userId,
    text:
      "Please provide some feedback to improve Yappy.\nYou can do this via direct message.",
  });
};
