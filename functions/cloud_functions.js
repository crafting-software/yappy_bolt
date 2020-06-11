const admin = require("firebase-admin");
const rp = require("request-promise");
const functions = require("firebase-functions");
const moment = require("moment");
const { parseTime } = require("./utils");
const { Report } = require("./view/report");
const { Meeting } = require("./yappy/meetings");
const { sendMessagesToWorkspaces } = require("./yappy/messaging");
const { onboarding } = require("./yappy/onboarding");
const { Timers } = require("./yappy/constants");
const DURATION_MIN = Timers.SESSION_DURATION / Timers.MINUTE;
const TIMEOUT_MIN = Timers.TIMEOUT / Timers.MINUTE;

const sessionManager = (app) => {
  const utcTime = moment().clone().utc().format("HH:mm");
  let workspaces = [];

  admin
    .database()
    .ref("installations")
    .once("value", async (data) => {
      workspaces = data.val();
    });
  const ref = admin.database().ref("scheduled_sessions");
  ref.once("value", async (data) => {
    const scheduledSessionsLists = data.val();
    for (const ws in scheduledSessionsLists) {
      const workspaceSessions = Object.entries(scheduledSessionsLists[ws]);
      for (const session of workspaceSessions) {
        if (session[0] == utcTime) {
          sendMessagesToWorkspaces(app, ws);
        } else if (
          workspaceSessions.indexOf(session) ==
          workspaceSessions.length - 1
        ) {
          const parsedSessionStartTime = parseTime(session[0]);
          const publishTime = moment()
            .utc()
            .startOf("D")
            .add(parsedSessionStartTime[0], "hours")
            .add(
              parsedSessionStartTime[1] + TIMEOUT_MIN + DURATION_MIN,
              "minutes"
            )
            .format("HH:mm");
          if (utcTime == publishTime) {
            await app.client.chat.postMessage({
              token: workspaces[ws].token,
              channel: workspaces[ws].webhook.channel_id,
              text: "Here's the daily report.",
              blocks: await Report(workspaces[ws].team.id),
            });
          }
        }
      }
    }

    const sessionsRef = await admin
      .database()
      .ref("sessions")
      .once("value", async (data) => {
        const sessionsSnapshot = Object.entries(data.val());

        for (const list of sessionsSnapshot) {
          const sessions = Object.entries(list[1]);

          for (const session of sessions) {
            const now = moment.utc().unix();
            const start = session[1].timestamps.ts_start;
            const end = session[1].timestamps.ts_end;
            if (end <= now && session[1].status != "ended") {
              Meeting.end(app, {
                workspace: workspaces[list[0]],
                session: session,
              });
            } else if (
              session[1].status == "pending" &&
              now >= start + Timers.TIMEOUT / 1000 &&
              end >= now
            ) {
              await admin
                .database()
                .ref(`sessions/${list[0]}/${session[0]}/status`)
                .set("in progress")
                .then(async (result) => {
                  const users = session[1].users;
                  Meeting.start(app, {
                    workspace: workspaces[list[0]],
                    users: users,
                    sessionId: session[0],
                  });
                });
            }
          }
        }
      });
  });
};

const userPresenceTracker = async (app) => {
  let workspaceList;
  //Fetch workspace data to get tokens
  await admin
    .database()
    .ref("installations")
    .once("value", async (data) => {
      workspaceList = data.val();
    });

  //Fetch all users
  await admin
    .database()
    .ref("users")
    .once("value", async (data) => {
      const users = data.val();
      for (const workspaceId in workspaceList) {
        const token = workspaceList[workspaceId].token;
        for (const userId in users[workspaceId]) {
          //fetch user presence per workspace
          const status = await app.client.users.getPresence({
            token: token,
            user: userId,
          });
          await admin
            .database()
            .ref(`users/${workspaceId}/${userId}/presence`)
            .set(status.presence);
        }
      }
    });
};

const oauth = async (request, response) => {
  console.log("Requested OAuth Flow...");

  if (request.method !== "GET") {
    console.error(`Got unsupported ${request.method} request. Expected GET.`);
    return response.send(405, "Only GET requests are accepted");
  }

  console.log("Checking params...");

  if (!request.query && !request.query.code) {
    return response.status(401).send("Missing query attribute 'code'");
  }

  console.log("Request is ok, initiating handshake...");

  const options = {
    uri: "https://slack.com/api/oauth.v2.access",
    method: "GET",
    json: true,
    qs: {
      code: request.query.code,
      client_id: functions.config().slack.client_id,
      client_secret: functions.config().slack.client_secret,
      redirect_uri: "https://us-central1-yappy-79985.cloudfunctions.net/oauth",
    },
  };

  const result = await rp(options);

  if (!result.ok) {
    console.error("The request was not ok: " + JSON.stringify(result));
    return response.header("Location", "https://yappy-79985.web.app").send(302);
  }

  console.log("OAuth Success!");
  console.log(JSON.stringify(result));

  console.log("Sending onboarding message");
  await onboarding.sendGroupMessage(result);

  await admin
    .database()
    .ref("installations")
    .child(result.team.id)
    .set({
      token: result.access_token,
      team: {
        id: result.team.id,
        name: result.team.name,
      },
      bot_user_id: result.bot_user_id,
      webhook: {
        url: result.incoming_webhook.url,
        channel: result.incoming_webhook.channel,
        channel_id: result.incoming_webhook.channel_id,
        bot_id: result.incoming_webhook.configuration_url.substr(
          result.incoming_webhook.configuration_url.lastIndexOf("/") + 1
        ),
      },
    });

  console.log("A new workspace installed Yappy!");
  response
    .header("Location", "https://yappy-79985.web.app/success.html")
    .send(302);
};

module.exports.CloudFunctions = { oauth, userPresenceTracker, sessionManager };
