const { TIMEOUT } = require("../yappy/timers");
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

const sessionCard = (time, rows) => {
  return [...rows];
};

const Report = async (workspaceId) => {
  // console.log("time", now);
  const sessions = await prepareReport(workspaceId);
  const list = [];
  for (const session of sessions) {
    const groups = [];
    for (const group of session.groups) {
      groups.push(...row(group.users));
    }
    list.push(
      ...sessionCard(
        `${moment
          .unix(session.ts_start + TIMEOUT / 1000)
          .format("HH:mm")} - ${moment.unix(session.ts_end).format("HH:mm")}`,
        groups
      )
    );
    if (sessions.indexOf(session) < sessions.length - 1)
      list.push({ type: "divider" });
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Here's a list of all the sessions that happened today:*`,
      },
    },
    ...list,
  ];
};

module.exports = { Report };
