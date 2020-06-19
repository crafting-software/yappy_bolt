const { joinValidator } = require("../utils");
const { JoinMessageMaybe } = require("./components/join_message_small");

module.exports.SessionListMessage = (sessionList, userId) => {
  const blocks = [];
  sessionList.forEach((session) => {
    console.log("session !", JSON.stringify(session));
    blocks.push(
      ...JoinMessageMaybe(
        joinValidator(
          userId,
          session.workspace,
          session.session_id,
          session.meeting_id
        ),
        session.users,
        {
          expired: session.expired || false,
        }
      )
    );
    if (sessionList.indexOf(session) < sessionList.length - 1) {
      blocks.push({
        type: "divider",
      });
    }
  });

  return blocks && blocks.length
    ? [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "*Take a break and join some of your colleagues that are already having their virtual coffees: *",
          },
        },
        ...blocks,
      ]
    : [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*There are no sessions in progress right now.*",
          },
        },
      ];
};
