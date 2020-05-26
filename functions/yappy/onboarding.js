const admin = require("firebase-admin");
const { yappyOnboardingMessageText } = require("../strings");
const { YappyOnboardingMessage } = require("../view/yappy_onboarding_message");
const rp = require("request-promise");

async function sendGroupMessage(result) {
  const token = result.access_token;
  const channel = result.incoming_webhook.channel_id;
  const teamId = result.team.id;
  await admin
    .database()
    .ref(`installations/${teamId}`)
    .once("value", async (data) => {
      const workspace = data.val();
      if (!workspace) {
        //Only send channel-wide onboarding message if the workspace just registered
        const postMessageRequestOptions = {
          uri: "https://slack.com/api/chat.postMessage",
          method: "GET",
          json: true,
          qs: {
            token: token,
            channel: channel,
            text: yappyOnboardingMessageText({ notify: true }),
            blocks: JSON.stringify(YappyOnboardingMessage),
          },
        };

        const getChannelUsersRequest = {
          uri: "https://slack.com/api/conversations.members",
          method: "GET",
          json: true,
          qs: {
            token: token,
            channel: channel,
          },
        };

        await rp(getChannelUsersRequest)
          .then(async (result) => {
            let actualUsers = [];
            for (const member of await result.members) {
              const userRequest = {
                uri: "https://slack.com/api/users.info",
                method: "GET",
                json: true,
                qs: {
                  token: token,
                  user: member,
                },
              };
              actualUsers.push(await rp(userRequest));
            }
            actualUsers = await Promise.all(actualUsers).then((result) => {
              return result
                .filter((user) => user.user.is_bot == false)
                .map((user) => {
                  return {
                    id: user.user.id,
                    avatar: user.user.profile.image_48,
                    name: user.user.profile.real_name,
                  };
                });
            });

            for (const user of actualUsers) {
              admin.database().ref(`users/${teamId}/${user.id}`).set(user);
            }
          })
          .then(async (result) => {
            const status = await rp(postMessageRequestOptions);
            if (!status.ok)
              console.log(
                "Error at postMessage request (onboarding) " +
                  JSON.stringify(status)
              );
          });
      }
    });
}

async function sendPrivateMessage(resp) {
  const userId = resp.event.user.id;
  const teamId = resp.body.team_id;
  const token = resp.context.botToken;

  const userRequest = {
    uri: "https://slack.com/api/users.info",
    method: "GET",
    json: true,
    qs: {
      token: token,
      user: userId,
    },
  };

  const postMessageRequestOptions = {
    uri: "https://slack.com/api/chat.postMessage",
    method: "GET",
    json: true,
    qs: {
      token: token,
      channel: userId,
      text: yappyOnboardingMessageText(),
      blocks: JSON.stringify(YappyOnboardingMessage),
    },
  };

  await rp(userRequest).then(async (result) => {
    if (result.ok) {
      const user = {
        id: result.user.id,
        avatar: result.user.profile.image_48,
        name: result.user.profile.real_name,
      };
      await admin
        .database()
        .ref(`users/${teamId}/${userId}`)
        .set(user)
        .then(async (result) => await rp(postMessageRequestOptions));
    } else console.log("Error processing request : " + JSON.stringify(result));
  });
}

module.exports.onboarding = { sendGroupMessage, sendPrivateMessage };
