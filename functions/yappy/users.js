const admin = require("firebase-admin");

module.exports.getSubscribedUsers = async function (app, workspace) {

    let usersRef = await admin.database()
      .ref(`users/${workspace.team.id}`)

    const userPromises = await usersRef.once("value", async function(data){
      return data.val()
    })
    .then(users => Object.entries(users.val())
      .map(async user => await app.client.users.info({
        token: workspace.token,
        user: user[0]
      })))

    const onlineUsers = await Promise.all(userPromises)
      .then(async users => {
        for (let user of users) {
          const status = await app.client.users.getPresence({
            token: workspace.token,
            user: user.user.id
          })
          user.user.status = status.presence
        }
        return users
      })
      .then(users => users
        .map(user => user.user)
        .filter(user => user.status == 'active'))

    console.log("Retrieved users list for:", workspace)

    console.log(`Active users in ${workspace.team.name} : ${onlineUsers.length}`)

    return onlineUsers
  }