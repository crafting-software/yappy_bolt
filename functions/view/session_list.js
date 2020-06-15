const { JoinMessage } = require("./join_message");

module.exports.SessionListMessage = (sessionList) => {
  const blocks = [];
  sessionList.forEach((session) => {
    return blocks.push(
      ...JoinMessage(session.url, session.users, {
        expired: session.expired || false,
      })
    );
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
