const { MessageHeadsup } = require('./view/message_heads_up')

class GroupManager {

  constructor(app, workspace){
    this.workspace = workspace;
    console.log(`workspace data: `, this.workspace)
  }

  // async function getSubscribedUsers() {
  //   let usersList = await app.client.conversations.members({
  //     token: this.workspace.token,
  //     channel: this.workspace.webhook.channel_id
  //   })
  //
  //   let users = await usersList.members.map(async member => await app.client.users.info({
  //     token: this.workspace.token,
  //     user: member
  //   }))
  //
  //   let list = []
  //
  //   for (let userId of usersList.members){
  //     let user = await app.client.users.info({
  //       token: this.workspace.token,
  //       user: userId
  //     })
  //     list.push(user)
  //   }
  //
  //   return list
  // }
  //
  // async function prepareSession(users, workspace){
  //   const TIMER = 30000 //30s
  //
  //   const randomMsg = getRandomMessage()
  //   broadcastMessage(usersList, randomMsg, MessageHeadsup(randomMsg))
  //
  //   await setTimeout( (usersList) => {
  //     console.log('test len', usersList)
  //
  //     const groups = performGrouping(usersList)
  //     for (let i = 0; i < groups.length; i++) {
  //       let message = "Your 10 minutes yappin time starts now. Don’t hold back!";
  //       broadcastMessage(groups[i], message, JoinMessage(usersList))
  //     }
  //   }, TIMER, usersList)
  // }
  //
  // function broadcastMessage(usersList, message, view, workspace) {
  //   usersList.members.map(mb => {
  //     try {
  //       console.log(mb)
  //       const result = app.client.chat.postEphemeral({
  //         token: workspace.token,
  //         channel: workspace.webhook.channel_id,
  //         user: mb.user.id || mb.id || mb,
  //         text: getRandomMessage(),
  //         blocks: view
  //       });
  //     }
  //     catch (error) {
  //       console.error(error);
  //     }
  //   })
  // }

}

module.exports.GroupManager = GroupManager
