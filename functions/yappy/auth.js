const admin = require("firebase-admin");

const authorizeFn = async ({ teamId, enterpriseId }) => {
  let installations;
  await admin
    .database()
    .ref("installations")
    .once("value", async (data) => {
      installations = data.val();
    });
  for (const team in installations) {
    // Check for matching teamId and enterpriseId in the installations array
    if (installations[team].team.id === teamId) {
      // This is a match. Use these installation credentials.
      return {
        // You could also set userToken instead
        botToken: installations[team].token,
        botId: installations[team].webhook.bot_id,
        botUserId: installations[team].bot_user_id,
      };
    }
  }

  throw new Error("No matching authorizations");
};

module.exports = { authorizeFn };
