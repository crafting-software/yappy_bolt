const admin = require("firebase-admin");

module.exports.getSubscribedUsers = async function (app, workspace) {

    let usersRef = await admin.database()
      .ref(`users/${workspace.team.id}`)
  
    const onlineUsers = await usersRef.once("value", async function(data){
      const snapshot = data.val()
  
      let promises = Object.entries(snapshot).map(async member => await app.client.users.info({
        token: workspace.token,
        user: member[0]
      }))
  
      let users = await Promise.all(promises)
        .then(users => users.map(async user => {
          user.status = await app.client.users.getPresence({
            token: workspace.token,
            user: user.user.id
          })
          return user
        }))
        .then(users => Promise.all(users))
  
        return users.filter(user => user.status.presence == "active")
    })
  
    console.log("Retrieved users list for:", workspace)
    console.log(onlineUsers.val())
  
    const usersArray = Object.entries(onlineUsers.val()).map(user => user[0])
  
    console.log(`Active users in ${workspace.team.name} : ${usersArray.length}`)
  
    return usersArray
  }