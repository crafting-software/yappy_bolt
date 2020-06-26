const moment = require("moment");
const admin = require("firebase-admin");
const { parseTime } = require("../utils");
const { HomeView } = require("../view/app_home");
const { FeedbackRequestMessage } = require("../view/feedback_request_message");
const { FeedbackModal } = require("../view/feedback_modal");
const { OptOutMessage } = require("../view/opt_out_message");
const { MixpanelInstance } = require("./analytics");

module.exports.optIn = async (app, { ack, say, context, body }) => {
  await ack();
  const workspaceId = body.team.id;
  const userId = body.user.id;

  const token = context.botToken;

  const user = await app.client.users.info({
    token: token,
    user: userId,
  });

  const ts = moment.utc().unix();

  MixpanelInstance.people.set(`${workspaceId}/${userId}`, {
    opted_out: false,
    timestamp: ts,
    join_source: "Opt-in",
    local_user_id: userId,
    workspace: workspaceId,
    global_id: `${workspaceId}/${userId}`,
    $name: user.user.name,
  });

  MixpanelInstance.track("Joined Yappy", {
    distinct_id: `${workspaceId}/${userId}`,
    timestamp: ts,
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

  const ts = moment.utc().unix();
  MixpanelInstance.track("Opted out of Yappy", {
    distinct_id: `${workspaceId}/${userId}`,
    timestamp: ts,
  });

  MixpanelInstance.people.set(`${workspaceId}/${userId}`, {
    opted_out: true,
    timestamp: ts,
  });

  await app.client.views.open({
    token: token,
    trigger_id: body.trigger_id,
    view: FeedbackModal({ source: "opt out" }),
  });

  await app.client.chat.postMessage({
    token: token,
    channel: userId,
    text: "Sorry to see you go!",
    blocks: OptOutMessage(),
  });
};
