const { Timers } = require("../yappy/constants");
const { prepareReport } = require("../yappy/report");

const moment = require("moment");

const row = (users) => {
  const list = [];
  for (const user of users) {
    list.push(
      {
        type: "image",
        image_url: user.avatar,
        alt_text: user.name,
      },
      {
        type: "plain_text",
        text:
          users.indexOf(user) < users.length - 1 ? `${user.name},` : user.name,
        emoji: true,
      }
    );
  }
  return [
    {
      type: "context",
      elements: list,
    },
    {
      type: "section",
      text: {
        type: "plain_text",
        text: " ",
      },
    },
  ];
};

const sessionCard = (rows) => {
  return [...rows];
};

const Report = async (workspaceId) => {
  const sessions = await prepareReport(workspaceId);
  const list = [];
  for (const session of sessions) {
    const groups = [];
    for (const group of session.groups) {
      const groupRow = row(group.users.accepted);
      const joinedLater = group.users.joinedLater.length;
      if (joinedLater) {
        groupRow[0].elements.push({
          type: "plain_text",
          text: `+ ${joinedLater} more ${joinedLater == 1 ? "user" : "users"}`,
        });
      }
      groups.push(...groupRow);
    }
    list.push(...sessionCard(groups));
    if (sessions.indexOf(session) < sessions.length - 1)
      list.push({ type: "divider" });
  }

  return sessions && sessions.length
    ? [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Your colleagues had so much fun today!*`,
          },
        },
        ...list,
      ]
    : null;
};

module.exports = { Report };
