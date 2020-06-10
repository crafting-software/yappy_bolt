const moment = require("moment");
const admin = require("firebase-admin");

const prepareReport = async (workspaceId) => {
  const startOfDay = moment.utc().startOf("D").unix();
  const endOfDay = moment.utc().endOf("D").unix();
  let sessionsSnapshot, usersSnapshot;
  await admin
    .database()
    .ref(`sessions/${workspaceId}`)
    .once("value", async (data) => {
      sessionsSnapshot = Object.entries(data.val() || {});
    });

  await admin
    .database()
    .ref(`users/${workspaceId}`)
    .once("value", async (data) => {
      usersSnapshot = Object.entries(data.val() || {});
    });
  return sessionsSnapshot
    .filter(
      (session) =>
        session[1].type == "scheduled session" &&
        session[1].timestamps &&
        session[1].timestamps.ts_start >= startOfDay &&
        session[1].timestamps.ts_end <= endOfDay
    )
    .sort(
      (s1, s2) =>
        s1[1].timestamps &&
        s1[1].timestamps.ts_start > s2[1].timestamps &&
        s2[1].timestamps.ts_start
    )
    .map((session) => {
      const groupIds = [
        ...new Set(
          Object.entries(session[1].users)
            .filter((user) => user[1].group || false)
            .map((user) => user[1].group.id)
        ),
      ];

      return {
        ts_start: session[1].timestamps && session[1].timestamps.ts_start,
        ts_end: session[1].timestamps && session[1].timestamps.ts_end,
        sessionId: session[0],
        groups: groupIds.map((group) => {
          return {
            id: group,
            users: usersSnapshot
              .filter(
                (user) =>
                  session[1].users[user[0]] &&
                  session[1].users[user[0]].group &&
                  session[1].users[user[0]].group.id == group
              )
              .map((user) => user[1]),
          };
        }),
      };
    });
};

module.exports = { prepareReport };
