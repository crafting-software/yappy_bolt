const moment = require("moment");
const admin = require("firebase-admin");
const { parseTime, joinValidator } = require("../utils");
const {
  sendMeetingLinksToWorkspace,
  sendMessagesToWorkspaces,
} = require("./messaging");
const { getSubscribedUsers } = require("./users");

const { SessionStatus, UserResponses } = require("./constants");
const { HomeView } = require("../view/app_home");
const { JoinMessage } = require("../view/join_message");
const { ScheduleMeetingModal } = require("../view/schedule_meeting_modal");
const { SessionListMessage } = require("../view/session_list");
const { MixpanelInstance } = require("./analytics");

const schedule = async (app, { ack, context, body }) => {
  await ack();
  await app.client.views.open({
    token: context.botToken,
    trigger_id: body.trigger_id,
    view: ScheduleMeetingModal(),
  });
};

const submit = async (app, { ack, body, view, context }) => {
  await ack();

  const userId = body.user.id;
  const workspaceId = body.team.id;

  const user = await app.client.users.info({
    token: context.botToken,
    user: userId,
  });

  const time = view.state.values.yappy_time_input_block.yappy_time_input.value;
  const tz = user.user.tz;
  const tz_offset = user.user.tz_offset;

  const [hour, min] = parseTime(time);
  if (typeof hour == "number" && typeof min == "number") {
    const utcTime = moment
      .utc()
      .hours(hour)
      .minutes(min)
      .subtract({ seconds: tz_offset })
      .format("HH:mm");
    const [initialHour, initialMin] =
      parseTime(view.blocks[0].element.initial_value) || [];
    let initialTime;
    if (typeof initialHour == "number" && typeof initialMin == "number") {
      initialTime = moment
        .utc()
        .hours(initialHour)
        .minutes(initialMin)
        .subtract({ seconds: tz_offset })
        .format("HH:mm");
    }

    console.log(view.blocks[0].element.initial_value);

    await admin
      .database()
      .ref(`scheduled_sessions/${body.team.id}/${initialTime}`)
      .remove();

    await admin
      .database()
      .ref(`scheduled_sessions/${body.team.id}/${utcTime}`)
      .set({
        utc_time: utcTime,
        scheduler_id: user.user.id,
        created_at: moment.utc().unix(),
      });
  }

  const result = await app.client.views.publish({
    token: context.botToken,
    user_id: userId,
    view: await HomeView(user.user),
  });
};

const edit = async (app, time, { body, context }) => {
  const workspaceId = body.team.id;
  const userId = body.user.id;

  const user = await app.client.users.info({
    token: context.botToken,
    user: userId,
  });

  const [h, m] = parseTime(time);
  const localTime = moment()
    .clone()
    .hours(h)
    .minutes(m)
    .add(user.user.tz_offset, "seconds")
    .format("HH:mm");

  await app.client.views.open({
    token: context.botToken,
    trigger_id: body.trigger_id,
    view: ScheduleMeetingModal({ value: localTime }),
  });

  const result = await app.client.views.publish({
    token: context.botToken,
    user_id: userId,
    view: await HomeView(user.user),
  });
};

const deleteScheduled = async (app, optionArg, { body, context }) => {
  const workspaceId = body.team.id;
  const userId = body.user.id;
  const token = context.botToken;

  await admin
    .database()
    .ref(`scheduled_sessions/${workspaceId}/${optionArg}`)
    .remove();
  console.log(`Deleted session at ${optionArg}`);

  const user = await app.client.users.info({
    token: token,
    user: userId,
  });

  const result = await app.client.views.publish({
    token: token,
    user_id: userId,
    view: await HomeView(user.user),
  });
};

const cancel = async (app, args) => {
  await admin
    .database()
    .ref(`sessions/${args.workspace.team.id}/${args.session[0]}`)
    .remove();
  for (const user of Object.entries(args.session[1].users)) {
    app.client.chat.delete({
      token: args.workspace.token,
      channel: user[1].channel,
      ts: user[1].headsup_ts,
    });
  }

  const mixpanel = MixpanelInstance({ workspace: args.workspace.team.id });
  if (mixpanel) {
    mixpanel.track("Session cancelled", {
      session: args.session[0],
      workspace: args.workspace.team.id,
      timestamp: moment.utc().unix(),
    });
  }
};

const end = async (app, { workspace, session }) => {
  await admin
    .database()
    .ref(`sessions/${workspace.team.id}/${session[0]}/status`)
    .set(SessionStatus.ENDED);
  let allUsers;
  await admin
    .database()
    .ref(`users/${workspace.team.id}`)
    .once("value", async (data) => {
      allUsers = data.val();
    });
  const sessionUsers = Object.entries(session[1].users || {});
  const mixpanel = MixpanelInstance({ workspace: workspace.team.id });

  if (mixpanel) {
    mixpanel.track("Session ended", {
      type: session[1].type,
      session: session[0],
      workspace: workspace.team.id,
    });
  }

  for (const user of sessionUsers) {
    //If user was in that conversation, remove message with join link.
    const recipients = Object.entries(allUsers)
      .filter((member) => session[1].users.hasOwnProperty(member[0]))
      .map((recipient) => recipient[1]);

    if (user[1].response == UserResponses.ACCEPTED) {
      await app.client.chat.update({
        token: workspace.token,
        channel: user[1].channel,
        ts: user[1].ts,
        text: "This session has ended.",
        blocks: JoinMessage(
          user[1].group.meeting_link,
          recipients.filter(
            (rec) =>
              session[1].users[rec.id].response == UserResponses.ACCEPTED &&
              session[1].users[rec.id].group &&
              session[1].users[rec.id].group.id ==
                (user[1].group && user[1].group.id)
          ),
          {
            message: "Don't hold back. Join others to start yapping.",
            expired: true,
          }
        ),
      });
    }

    //If user didn't respond, update the links to the available calls
    else if (user[1].response == UserResponses.MAYBE) {
      await admin
        .database()
        .ref(`sessions/${workspace.team.id}/${session[0]}`)
        .once("value", async (data) => {
          let userData;
          await admin
            .database()
            .ref(`users/${workspace.team.id}`)
            .once("value", async (data) => {
              userData = data.val();
            });

          const activeSessions = [session[0], data.val()];
          const inviteLinks = [
            ...new Set(
              Object.entries(activeSessions[1].users || {})
                .map((user) => user[1].group && user[1].group.id)
                .filter((group_id) => group_id || false)
            ),
          ].map((group_id) => {
            const userList = Object.entries(userData)
              .map((user) => user[1])
              .filter((user) => {
                const userFromSession = activeSessions[1].users[user.id];
                return (
                  userFromSession &&
                  userFromSession.group &&
                  userFromSession.group.id == group_id
                );
              });
            return {
              session_id: session[0],
              meeting_id: group_id,
              workspace: workspace.team.id,
              users: {
                accepted: userList.filter(
                  (user) =>
                    activeSessions[1].users[user.id].response ==
                    UserResponses.ACCEPTED
                ),
                joinedLater: userList.filter(
                  (user) =>
                    activeSessions[1].users[user.id].response ==
                      UserResponses.MAYBE &&
                    activeSessions[1].users[user.id].joined
                ),
              },
              expired: activeSessions[1].status == SessionStatus.ENDED,
            };
          });
          console.log("update message for user  @" + user[0]);
          await app.client.chat.update({
            token: workspace.token,
            channel: user[1].channel,
            ts: user[1].ts,
            text: " ",
            blocks: SessionListMessage(inviteLinks, user[0]),
          });
        });
    }
  }
};

const instant = async (app, { ack, body, context }) => {
  await ack();

  if (
    body.view.state.values.instant_yap_input.yappy_select_users.selected_options
      .value == "user/null"
  )
    return;

  const users = body.view.state.values.instant_yap_input.yappy_select_users.selected_options.map(
    (element) => element.value.split("/")[1]
  );

  const mixpanel = MixpanelInstance({ workspace: body.user.team_id });
  if (mixpanel) {
    mixpanel.track("Created instant yap", {
      distinct_id: `${body.user.team_id}/${body.user.id}`,
      workspace: body.user.team_id,
      users: [
        `${body.user.team_id}/${body.user.id}`,
        ...users.map((user) => `${body.user.team_id}/${body.user.id}`),
      ],
    });
  }

  sendMessagesToWorkspaces(app, body.team.id, {
    initiatorId: body.user.id,
    recipients: [...users, body.user.id],
  });
};

const start = async (app, { workspace, users, sessionId }) => {
  await admin
    .database()
    .ref(`sessions/${workspace.team.id}/${sessionId}/status`)
    .set(SessionStatus.IN_PROGRESS);
  for (const user in users) {
    await app.client.chat.delete({
      token: workspace.token,
      channel: users[user].channel,
      ts: users[user].headsup_ts,
    });
  }
  const idList = Object.keys(users);
  await getSubscribedUsers(app, workspace, false)
    .then((list) => list.filter((user) => idList.includes(user.id)))
    .then(async (list) => {
      sendMeetingLinksToWorkspace(app, {
        workspace: workspace,
        meetingId: sessionId,
        users: list,
      });
    });
};

module.exports.RSVP = {
  accept: async (app, { ack, say, context, body, respond }) => {
    await ack();
    await respond("Great, your session will start soon. I'll give you a ping.");
    console.log(`Yapp accepted by ${body.user.name}`);
    let user_id = body.user.id;
    let meeting_request_id = body.actions[0].value;
    let session;
    await admin
      .database()
      .ref(`sessions/${body.user.team_id}/${meeting_request_id}`)
      .once("value", async (data) => {
        session = data.val();
        if (session) {
          var usersRef = await admin
            .database()
            .ref(
              `sessions/${body.user.team_id}/${meeting_request_id}/users/${body.user.id}/response`
            )
            .set(UserResponses.ACCEPTED);

          const mixpanel = MixpanelInstance({ workspace: body.user.team_id });
          if (mixpanel) {
            mixpanel.track("Accepted session", {
              distinct_id: `${body.user.team_id}/${user_id}`,
              session: meeting_request_id,
              workspace: body.user.team_id,
            });
          }
        }
      });
  },

  decline: async (app, { ack, say, context, body, respond }) => {
    await ack();
    await respond("Okay, maybe next time.");
    console.log(`Yapp declined by ${body.user.name}`);
    let meeting_request_id = body.actions[0].value;

    const user_id = body.user.id;
    const team_id = body.user.team_id;
    const mixpanel = MixpanelInstance({ workspace: team_id });

    let session;
    await admin
      .database()
      .ref(`sessions/${body.user.team_id}/${meeting_request_id}`)
      .once("value", async (data) => {
        session = data.val();
      });

    if (session) {
      var usersRef = await admin
        .database()
        .ref(
          `sessions/${body.user.team_id}/${meeting_request_id}/users/${body.user.id}/response`
        )
        .set(UserResponses.DECLINED);
      if (mixpanel) {
        mixpanel.track("Declined session", {
          distinct_id: `${team_id}/${user_id}`,
          session: meeting_request_id,
          workspace: body.user.team_id,
        });
      }
    }
  },
};

module.exports.Meeting = {
  schedule,
  deleteScheduled,
  edit,
  instant,
  start,
  end,
  submit,
  cancel,
};
