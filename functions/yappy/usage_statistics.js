const admin = require("firebase-admin");
const moment = require("moment");
const { WeeklyReportingTime } = require("./constants");
const { parseTime } = require("../utils");
const { UserResponses, SessionTypes } = require("./constants");
const dev_workspaces = require("../dev_workspaces.json");

const prepareEntry = async (app) => {
  const now = moment.utc().unix();
  const lastWeek = moment.utc().subtract(1, "week").unix();

  const sessions = await getSessionsData({ start: lastWeek, end: now });
  const feedback = await getFeedbackData({ start: lastWeek, end: now });
  const scheduled = getScheduledSessionData(sessions);
  const workspaces = await getWorkspacesData(app);

  return {
    sessions: sessions,
    feedback: feedback,
    scheduledSessions: scheduled,
    workspacesData: workspaces,
    activeWorkspaces: Object.entries(workspaces).length,
  };
};

async function getFeedbackData({ start, end }) {
  const feedback = {};
  await admin
    .database()
    .ref("feedback")
    .once("value", async (data) => {
      const snapshot = data.val();
      for (const workspaceId in snapshot) {
        if (
          !dev_workspaces[workspaceId] ||
          dev_workspaces[workspaceId].statistics
        ) {
          const entries = Object.entries(snapshot[workspaceId]).filter(
            (entry) => entry[1].ts > start && entry[1].ts <= end
          );
          if (entries.length) feedback[workspaceId] = [];

          for (const entry of entries) {
            feedback[workspaceId].push({
              ts: entry[1].ts,
              message: entry[1].message,
            });
          }
        }
      }
    });

  return feedback;
}

async function getSessionsData({ start, end }) {
  const sessions = {
    list: {},
    total: { scheduled: 0, instantYaps: 0, sessions: 0 },
  };
  await admin
    .database()
    .ref("sessions")
    .once("value", async (data) => {
      const snapshot = data.val();
      for (const workspaceId in snapshot) {
        if (
          !dev_workspaces[workspaceId] ||
          dev_workspaces[workspaceId].statistics
        ) {
          sessions.list[workspaceId] = [];
          const entries = Object.entries(snapshot[workspaceId])
            .filter(
              (entry) =>
                entry[1].timestamps &&
                entry[1].timestamps.ts_start > start &&
                entry[1].timestamps.ts_start <= end
            )
            .map((session) => {
              sessions.total.sessions++;

              const users = Object.entries(session[1].users || {});
              const accepted = users.filter(
                (user) => user[1].response == UserResponses.ACCEPTED
              );

              const noResponse = users.filter(
                (user) => user[1].response == UserResponses.MAYBE
              );

              const joined = {
                accepted: accepted.filter((user) => user[1].joined == true),
                noResponse: noResponse.filter((user) => user[1].joined == true),
              };

              const declined = users.filter(
                (user) => user[1].response == UserResponses.DECLINED
              );

              switch (session[1].type) {
                case SessionTypes.INSTANT: {
                  sessions.total.instantYaps++;
                  break;
                }
                case SessionTypes.SCHEDULED: {
                  sessions.total.scheduled++;
                  break;
                }
              }

              return {
                id: session[0],
                ts: session[1].timestamps && session[1].timestamps.ts_start,
                userStatistics: {
                  accepted: {
                    total: accepted.length,
                    joined: joined.accepted.length,
                    ratio: joined.accepted.length / (accepted.length || 1),
                  },

                  noResponse: {
                    total: noResponse.length,
                    joined: joined.noResponse.length,
                    ratio: joined.noResponse.length / (noResponse.length || 1),
                  },

                  declined: declined.length,
                },
                participationRatio:
                  (joined.accepted.length + joined.noResponse.length) /
                    users.length || 0,
                noResponseRatio: noResponse.length / users.length || 0,
                acceptRatio: accepted.length / users.length || 0,
                declineRatio: declined.length / users.length || 0,
                type: session[1].type,
              };
            });
          sessions.list[workspaceId] = entries;
        }
      }
    });

  return sessions;
}

const getScheduledSessionData = (sessions) => {
  const scheduledSessions = {};
  for (const workspaceId in sessions.list) {
    const scheduled = sessions.list[workspaceId].filter(
      (session) => session.type == SessionTypes.SCHEDULED
    );
    scheduledSessions[workspaceId] = {};
    for (const session of scheduled) {
      const time = moment.unix(session.ts).utc().format("HH:mm");
      if (!scheduledSessions[workspaceId][time]) {
        scheduledSessions[workspaceId][time] = [];
      }
      scheduledSessions[workspaceId][time].push({
        avgParticipationRatio: session.participationRatio,
        avgAcceptRatio: session.acceptRatio,
        avgDeclineRatio: session.declineRatio,
        avgNoResponseRatio: session.noResponseRatio,
      });
    }
    for (const time in scheduledSessions[workspaceId]) {
      const statistics = {
        avgParticipationRatio: 0,
        avgAcceptRatio: 0,
        avgDeclineRatio: 0,
        avgNoResponseRatio: 0,
      };
      const occurences = scheduledSessions[workspaceId][time].length;
      scheduledSessions[workspaceId][time].forEach((session) => {
        for (const key in statistics) {
          statistics[key] += session[key] / occurences;
        }
        statistics.occurences = occurences;
      });

      scheduledSessions[workspaceId][time] = statistics;
    }
  }

  return scheduledSessions;
};

const getWorkspacesData = async (app) => {
  const workspaces = {};
  let workspacesList;
  await admin
    .database()
    .ref(`installations`)
    .once("value", async (data) => {
      workspacesList = data.val();
    });

  let usersList;
  await admin
    .database()
    .ref("users")
    .once("value", async (data) => {
      usersList = data.val();
    });

  for (const ws in workspacesList) {
    if (!dev_workspaces[ws] || dev_workspaces[ws].statistics) {
      const allChannelUsers = await app.client.conversations
        .members({
          token: workspacesList[ws].token,
          channel: workspacesList[ws].webhook.channel_id,
        })
        .then((result) => result.members);

      const joinedChannelUsers = allChannelUsers.filter(
        (userId) => usersList[ws][userId]
      );
      const allUsers = Object.entries(usersList[ws]);
      const independentUsers = allUsers.filter(
        (user) => !allChannelUsers.includes(user[0])
      );

      workspaces[ws] = {
        users: {
          allUsers: allUsers.length,
          independentUsers: independentUsers.length,
          allChannelUsers: allChannelUsers.length,
          joinedChannelUsers: joinedChannelUsers.length,
          channelOptInRatio: joinedChannelUsers.length / allChannelUsers.length,
        },
      };
    }
  }
  return workspaces;
};

module.exports.UsageStatistics = { prepareEntry };
