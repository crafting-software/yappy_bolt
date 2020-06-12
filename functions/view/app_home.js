const admin = require("firebase-admin");
const { NewSessionControls } = require("./components/new_sessions");
const { ScheduledSessions } = require("./components/scheduled_sessions");
const { FeedbackSection } = require("./components/feedback_section");

exports.HomeView = async (user) => {
  let userIsRegistered = await admin
    .database()
    .ref(`users/${user.team_id}/${user.id}`)
    .once("value", async (data) => data)
    .then((user) => (user.val() ? true : false));

  const state = userIsRegistered
    ? {
        text:
          "If you don't want to receive any more notifications from me, you can opt out.",
        color: "danger",
        button: "Opt out",
        actionId: "yappy_opt_out",
      }
    : {
        text: "You can sign up by pressing the button below",
        color: "primary",
        button: "Opt in",
        actionId: "yappy_opt_in",
      };

  let scheduledSessions;
  let loggedUser;

  if (userIsRegistered) {
    const scheduledSessionsRef = await admin
      .database()
      .ref(`scheduled_sessions/${user.team_id}`);
    const snapshot = await scheduledSessionsRef.once(
      "value",
      async (data) => data
    );
    loggedUser = user;

    scheduledSessions = Object.entries(snapshot.val() || {}).map(
      (session) => session[1]
    );
  }

  return {
    type: "home",
    callback_id: "home_view",

    /* body of the view */
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Scheduled sessions*",
        },
      },

      ...ScheduledSessions(loggedUser, (await scheduledSessions) || []),
      ...NewSessionControls(loggedUser),
      ...FeedbackSection(user),

      //Opt in / out controls
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: state.text,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: state.button,
            },
            style: state.color,
            action_id: state.actionId,
          },
        ],
      },
    ],
  };
};
