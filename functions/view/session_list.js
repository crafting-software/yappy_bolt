const { JoinMessage } = require("./join_message");
const { JoinMessageMaybe } = require("./components/join_message_small");

module.exports.SessionListMessage = (sessionList) => {
  const blocks = [];
  sessionList.forEach((session) => {
    blocks.push(
      ...JoinMessageMaybe(session.url, session.users, {
        expired: session.expired || false,
      })
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
