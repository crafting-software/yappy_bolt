const moment = require("moment");
const admin = require("firebase-admin");
const { v4 } = require("uuid");

const { splitToChunks, joinValidator } = require("../utils");
const { getRandomMessage, instantYapMessage } = require("../strings");
const { getSubscribedUsers, getInstantYapUsers } = require("./users");
const { MixpanelInstance } = require("./analytics");
const {
  Timers,
  GROUP_SIZE,
  SessionStatus,
  SessionTypes,
  UserResponses,
} = require("./constants");

const { JoinMessage } = require("../view/join_message");
const { MessageHeadsup } = require("../view/message_heads_up");
const { SessionListMessage } = require("../view/session_list");
const mixpanel = require("mixpanel");

async function sendMeetingLinksToWorkspace(
  app,
  { workspace, meetingId, users }
) {
  const ref = admin
    .database()
    .ref(`sessions/${workspace.team.id}/${meetingId}/users`);
  ref.once("value", async function (data) {
    const responses = data.val() || [];
    console.log("User responses", responses);

    const userLists = {
      accepted: users.filter(
        (user) =>
          responses[user.id] &&
          responses[user.id].response == UserResponses.ACCEPTED
      ),
      declined: users.filter(
        (user) =>
          responses[user.id] &&
          responses[user.id].response == UserResponses.DECLINED
      ),
      maybe: users.filter((user) => !responses[user.id].response),
    };
    console.log(JSON.stringify(userLists));
    if (
      (userLists.accepted.length == 1 && userLists.maybe.length) ||
      userLists.accepted.length > 1
    ) {
      const groups = splitToChunks(userLists.accepted, GROUP_SIZE);
      console.log("Sending meeting links to groups...");
      const ongoingMeetings = [];
      const mixpanel = MixpanelInstance({ workspace: workspace.team.id });
      if (mixpanel) {
        mixpanel.track("Session started", {
          workspace: workspace.team.id,
          session: meetingId,
        });
      }

      for (let group of groups) {
        let meeting_group_id = v4().replace(/-/g, "");
        let meeting_url = encodeURI(
          `https://8x8.vc/${meeting_group_id}/${workspace.team.name}`
        );
        ongoingMeetings.push({
          meeting_id: meeting_group_id,
          session_id: meetingId,
          workspace: workspace.team.id,
          url: meeting_url,
          users: group,
          expired: false,
        });

        for (let user of group) {
          const url = joinValidator(
            user.id,
            workspace.team.id,
            meetingId,
            meeting_group_id
          );
          // `https://yappy-79985.web.app/${user.id}/join/${workspace.team.id}/${meetingId}/${meeting_group_id}`;
          const result = app.client.chat
            .postMessage({
              token: workspace.token,
              channel: user.id,
              text: "Time to join your yapping meeting.",
              blocks: JoinMessage(url, group, {
                message: "Don't hold back. Join others to start yapping.",
                expired: false,
              }),
            })
            .then(async (message) => {
              const channel = message.channel;
              const ts = message.message.ts;

              //Timestamps are attached only after message is sent, so the corresponding message can be retrieved via slack api
              await admin
                .database()
                .ref(
                  `sessions/${workspace.team.id}/${meetingId}/users/${user.id}/ts`
                )
                .set(ts);

              await admin
                .database()
                .ref(
                  `sessions/${workspace.team.id}/${meetingId}/users/${user.id}/channel`
                )
                .set(channel);

              await admin
                .database()
                .ref(
                  `sessions/${workspace.team.id}/${meetingId}/users/${user.id}/group`
                )
                .set({ id: meeting_group_id, meeting_link: meeting_url });
            });
        }
      }

      for (const user of userLists.maybe) {
        if (mixpanel)
          mixpanel.track("No response", {
            distinct_id: `${workspace.team.id}/${user.id}`,
            session: meetingId,
            workspace: workspace.team.id,
          });
        const result = app.client.chat
          .postMessage({
            token: workspace.token,
            text: `There are some sessions in progress you can join`,
            channel: user.id,
            blocks: await SessionListMessage(ongoingMeetings, user.id),
          })
          .then(async (res) => {
            await admin
              .database()
              .ref(
                `sessions/${workspace.team.id}/${meetingId}/users/${user.id}`
              )
              .set({
                response: "none",
                ts: res.ts,
                channel: res.channel,
              });
          });
      }
    } else {
      console.log("workspace", workspace.team.id, "meeting", meetingId);
      await admin
        .database()
        .ref(`sessions/${workspace.team.id}/${meetingId}`)
        .remove();
    }
  });
}

async function sendMessagesToWorkspaces(
  app,
  workspaceId = null,
  instantMeetingArgs = null
) {
  var db = admin.database();
  const recipients = instantMeetingArgs && instantMeetingArgs.recipients;
  const initiatorId = instantMeetingArgs && instantMeetingArgs.initiatorId;
  var ref = db.ref(`installations${workspaceId ? `/${workspaceId}` : ""}`);
  let snapshot = await ref.once("value", async function (data) {
    let workspaces = workspaceId ? { workspace: data.val() } : data.val();
    for (let [key, workspace] of Object.entries(workspaces)) {
      console.log("Getting users for ", workspace.team.name);
      let meeting_request_id = v4();

      const users = recipients
        ? await getInstantYapUsers(app, workspace, recipients)
        : await getSubscribedUsers(app, workspace);

      const ts_start = moment.utc().unix();
      const ts_end =
        ts_start + (Timers.TIMEOUT + Timers.SESSION_DURATION) / 1000;

      const sessionType = initiatorId
        ? SessionTypes.INSTANT
        : SessionTypes.SCHEDULED;

      let mixpanel;
      if (users.length) {
        db.ref(
          `sessions/${workspace.team.id}/${meeting_request_id}/status`
        ).set(SessionStatus.PENDING);

        await db
          .ref(`sessions/${workspace.team.id}/${meeting_request_id}/timestamps`)
          .set({
            ts_start: ts_start,
            ts_end: ts_end,
          });

        mixpanel = MixpanelInstance({ workspace: workspaceId });
        if (mixpanel)
          mixpanel.track("Session announced", {
            type: sessionType,
            initiator_id: initiatorId,
            workspace: workspaceId,
            recipients: Object.entries(users).map((user) => user[1].id),
            session: meeting_request_id,
          });
        db.ref(`sessions/${workspace.team.id}/${meeting_request_id}/type`).set(
          sessionType
        );
        if (sessionType == SessionTypes.INSTANT)
          db.ref(
            `sessions/${workspace.team.id}/${meeting_request_id}/initiator_id`
          ).set(initiatorId);
      }
      for (const user of users) {
        const isInitiator = user.id == initiatorId;

        if (isInitiator) {
            mixpanel.track("Accepted session", {
              distinct_id: `${workspace.team.id}/${initiatorId}`,
              session: meeting_request_id,
              workspace: workspace.team.id,
            });

          await app.client.chat
            .postMessage({
              token: workspace.token,
              channel: user.id,
              text: `Your instant meeting starts in ${
                Timers.TIMEOUT / 60000
              } minutes. Stay tuned!`,
            })
            .then((message) => {
              db.ref(
                `sessions/${workspace.team.id}/${meeting_request_id}/users/${user.id}`
              ).set({
                response: UserResponses.ACCEPTED,
                headsup_ts: message.ts,
                channel: message.channel,
              });
            });
        } else {
          const inviteMessage = instantMeetingArgs
            ? instantYapMessage(initiatorId)
            : getRandomMessage();
          await app.client.chat
            .postMessage({
              token: workspace.token,
              channel: user.id,
              text: inviteMessage,
              blocks: MessageHeadsup(inviteMessage, meeting_request_id),
            })
            .then(async (message) => {
              const userChannel = message.channel;
              await db
                .ref(`users/${workspace.team.id}/${user.id}/channel`)
                .set(userChannel);

              await db
                .ref(
                  `sessions/${workspace.team.id}/${meeting_request_id}/users/${user.id}`
                )
                .set({ headsup_ts: message.ts, channel: userChannel });
            });
        }
        if (mixpanel)
          mixpanel.track("User can participate to a session", {
            type: sessionType,
            initiator_id: initiatorId,
            workspace: workspaceId,
            distinct_id: `${workspace.team.id}/${user.id}`,
            session: meeting_request_id,
          });
      }
    }
  });
}

module.exports = {
  sendMeetingLinksToWorkspace,
  sendMessagesToWorkspaces,
};
