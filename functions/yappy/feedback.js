const admin = require("firebase-admin");
const moment = require("moment");
const { v4 } = require("uuid");

async function sendFeedback(app, { body, context, view, ack }) {
  await ack();
  const message = view.state.values.feedback_message.feedback_input.value;
  await admin
    .database()
    .ref(`feedback/${body.team.id}/${v4()}`)
    .set({ ts: moment.utc().unix(), message: message });

  await app.client.chat.postMessage({
    token: context.botToken,
    channel: body.user.id,
    text: "Thank you for your feedback !",
  });
}

module.exports = { sendFeedback };
