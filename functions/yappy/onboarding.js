const admin = require("firebase-admin");
const {
  yappyOnboardingMessageText,
  adminOnboardingMessage,
} = require("../strings");
const { YappyOnboardingMessage } = require("../view/yappy_onboarding_message");
const moment = require("moment");
const rp = require("request-promise");
const { MixpanelInstance } = require("../yappy/analytics");

async function sendGroupMessage(result) {
  const adminId = result.authed_user.id; //The admin who installed the app
  // const teamId = result.team.id;

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
              const users = result.filter(
                (user) =>
                  user.user.is_bot == false && user.user.deleted == false
              );
              const adminUser = users.find((user) => user.user.id == adminId);
              const tzOffset = adminUser.user.tz_offset;

              const tzOffsetHours = tzOffset / 3600;

              const firstSession = (type = "utc") =>
                moment
                  .utc()
                  .startOf("D")
                  .add(12 - (type == "local" ? 0 : tzOffsetHours), "hour")
                  .format("HH:mm");

              admin
                .database()
                .ref(`scheduled_sessions/${teamId}/${firstSession()}`)
                .set({
                  scheduler_name: "Yappy",
                  created_at: moment.utc().unix(),
                  utc_time: firstSession(),
                });

              for (const user of users) {
                const isAdmin = user.user.isAdmin;
                const tzOffset = user.user.tz_offset;
                const id = user.user.id;
                const avatar = user.user.profile.image_48;
                const name = user.user.profile.real_name;

                admin.database().ref(`users/${teamId}/${id}`).set({
                  id: id,
                  avatar: avatar,
                  tz_offset: tzOffset,
                  name: name,
                });
                const ts = moment.utc().unix();
                MixpanelInstance.track("Joined Yappy", {
                  distinct_id: `${teamId}/${id}`,
                  workspace: teamId,
                  local_user_id: id,
                  timestamp: ts,
                });

                MixpanelInstance.people.set(`${teamId}/${id}`, {
                  opted_out: false,
                  timestamp: ts,
                  workspace: teamId,
                  local_user_id: id,
                  global_id: `${teamId}/${id}`,
                  $name: user.user.name,
                  join_source: "Onboarding - Channel integration",
                });

                if (user.user.is_admin) {
                  rp({
                    uri: "https://slack.com/api/chat.postMessage",
                    method: "GET",
                    json: true,
                    qs: {
                      token: token,
                      channel: id,
                      text: adminOnboardingMessage({
                        accountId: id,
                        time: firstSession("local"),
                      }),
                    },
                  });
                }
              }
            });
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

async function sendPrivateMessage(resp, { joinSource }) {
  const userId = resp.event.user.id || resp.event.user;
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
        .then((result) => {
          rp(postMessageRequestOptions);
        });

      const ts = moment.utc().unix();
      MixpanelInstance.track("Joined Yappy", {
        distinct_id: `${teamId}/${userId}`,
        timestamp: ts,
      });
      MixpanelInstance.people.set(`${teamId}/${userId}`, {
        opted_out: false,
        timestamp: ts,
        local_user_id: userId,
        global_id: `${teamId}/${userId}`,
        workspace: teamId,
        $name: user.name,
        join_source: joinSource,
      });
    } else console.log("Error processing request : " + JSON.stringify(result));
  });
}

module.exports.onboarding = { sendGroupMessage, sendPrivateMessage };
