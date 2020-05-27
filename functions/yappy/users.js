const admin = require("firebase-admin");

const getSubscribedUsers = async function (app, workspace) {
  let usersRef = await admin.database().ref(`users/${workspace.team.id}`);
  let usersList = [];
  await usersRef.once("value", async function (data) {
    const list = Object.entries(data.val());
    usersList = list;
  });

  return usersList
    .filter((user) => user[1].presence == "active")
    .map((users) => users[1]);
};

const getInstantYapUsers = async (app, workspace, users) =>
  await getSubscribedUsers(app, workspace).then((list) => {
    return list.filter((user) => users.includes(user.id));
  });

module.exports = { getSubscribedUsers, getInstantYapUsers };
