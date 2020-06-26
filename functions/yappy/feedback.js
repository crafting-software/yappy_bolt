const admin = require("firebase-admin");
const moment = require("moment");
const { MixpanelInstance } = require("./analytics");
const { v4 } = require("uuid");

async function sendFeedback(app, { body, context, view, ack, payload }) {
  await ack();
  const message = view.state.values.feedback_message.feedback_input.value;
  const ts = moment.utc().unix();
  const mixpanel = MixpanelInstance({ workspace: body.team.id });
  if (mixpanel) {
    mixpanel.track("Feedback sent", {
      message: message,
      timestamp: ts,
      workspace: body.team.id,
      source: payload.private_metadata,
    });
  }
  await admin
    .database()
    .ref(`feedback/${body.team.id}/${v4()}`)
    .set({ ts: ts, message: message });

  await app.client.chat.postMessage({
    token: context.botToken,
    channel: body.user.id,
    text: "Thank you for your feedback !",
  });
}

module.exports = { sendFeedback };
