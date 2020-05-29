const admin = require("firebase-admin");

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

module.exports = { getSubscribedUsers, getInstantYapUsers };
