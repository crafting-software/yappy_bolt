const admin = require("firebase-admin");
const rp = require("request-promise");

const getSubscribedUsers = async function (
  app,
  workspace,
  onlyActiveUsers = true
) {
  let usersRef = await admin.database().ref(`users/${workspace.team.id}`);
  let usersList = [];
  await usersRef.once("value", async function (data) {
    const list = Object.entries(data.val());
    usersList = list;
  });

  usersList = onlyActiveUsers
    ? usersList.filter((user) => user[1].presence == "active")
    : usersList;

  return usersList.map((users) => users[1]);
};

const getInstantYapUsers = async (app, workspace, users) =>
  await getSubscribedUsers(app, workspace, false).then((list) => {
    return list.filter((user) => users.includes(user.id));
  });

const updateUserData = async (app, args) => {
  const user = args.event.user;
  await admin
    .database()
    .ref(`users/${user.team_id}/${user.id}`)
    .once("value", async (data) => {
      const snapshot = data.val();
      if (snapshot) {
        const userData = {
          name: user.name,
          avatar: user.profile.image_48,
          tz_offset: user.tz_offset,
        };

        for (const key in userData) {
          if (userData[key] != snapshot[key]) {
            admin
              .database()
              .ref(`users/${user.team_id}/${user.id}/${key}`)
              .set(userData[key]);
          }
        }
      }
    });
};

const getIntegratedChannelMembers = async (workspaceInfo) => {
  const token = workspaceInfo.token;
  const channel = workspaceInfo.channel;

  const getChannelUsersRequest = {
    uri: "https://slack.com/api/conversations.members",
    method: "GET",
    json: true,
    qs: {
      token: token,
      channel: channel,
    },
  };
  let actualUsers = [];
  await rp(getChannelUsersRequest).then(async (result) => {
    for (const member of await result.members) {
      const userRequest = {
        uri: "https://slack.com/api/users.info",
        method: "GET",
        json: true,
        qs: {
          token: token,
          user: member,
        },
      };
      actualUsers.push(await rp(userRequest));
    }
    actualUsers = await Promise.all(actualUsers).then((result) => {
      return result.filter((user) => !user.user.is_bot && !user.user.deleted);
    });
  });

  return actualUsers;
};

module.exports = {
  getSubscribedUsers,
  getIntegratedChannelMembers,
  updateUserData,
  getInstantYapUsers,
};
