const moment = require('moment')
const admin = require("firebase-admin");
const { v4 } = require('uuid');

const { splitToChunks } = require('../utils')
const { getRandomMessage } = require('../strings')
const { getSubscribedUsers } = require('./users')

const { HomeView } = require('../view/app_home')
const { JoinMessage } = require('../view/join_message')
const { MessageHeadsup } = require('../view/message_heads_up')
const { SessionListMessage } = require('../view/session_list')

const TIMEOUT = 60000 * 5
const GROUP_SIZE = 2

async function sendMeetingLinksToWorkspace(app, broadcastArgs){
  const userData = broadcastArgs.users.map(user =>{
    return {
      name: user.profile.real_name,
      id: user.id,
      avatar: user.profile.image_48,
      status: user.status
    }
  })
  const ref = admin.database().ref(`sessions/${broadcastArgs.workspace.team.id}/${broadcastArgs.meetingId}`)
  ref.once("value", async function(data){
    const userResponses = data.val() || []
    console.log('User responses', userResponses)

    const userLists = {
      accepted: userData.filter(user => userResponses[user.id] == 'accepted'),
      declined: userData.filter(user => userResponses[user.id] == 'declined'),
      maybe: userData.filter(user => !userResponses[user.id]),
    }
    
    if (userLists.accepted.length) {
      const groups = splitToChunks(userLists.accepted, GROUP_SIZE)
      console.log("Sending meeting links to groups...")
      const ongoingMeetings = []

      for (let group of groups) {
        let meeting_group_id = v4().replace(/-/g,"");
        let meeting_url = `https://8x8.vc/440607796/${meeting_group_id}`
        ongoingMeetings.push({url : meeting_url, users : group})

        for(let user of group) {
          const result = app.client.chat.postMessage({
            token: broadcastArgs.workspace.token,
            channel: user.id,
            text: "Time to join your yapping meeting.",
            blocks: JoinMessage(meeting_url, group, "Don't hold back. Join others to start yapping.")
          });
        }

        for (const user of userLists.maybe) {
          const result = app.client.chat.postMessage({
            token: broadcastArgs.workspace.token,
            text: `There are some sessions in progress you can join`,
            channel: user.id,
            blocks: await SessionListMessage(ongoingMeetings) 
          })
        }
      }
    }
    else console.log('Nobody')
  })
}

async function sendMessagesToWorkspaces(app,workspaceId = null, instantMeetingArgs = null){
  var db = admin.database();
  var ref = db.ref(`installations${workspaceId? `/${workspaceId}` : ""}`);
  let snapshot = await ref.once("value", async function(data){
    let workspaces = workspaceId ? {workspace : data.val() } : data.val();
    for (let [key, workspace] of Object.entries(workspaces)) {
      console.log("Getting users for ", workspace.team.name)
      let meeting_request_id = v4();

      const users = await getSubscribedUsers(app, workspace)
      const usersExceptInitiator = users.filter(user => {
        const isInitiator = instantMeetingArgs && user.id == instantMeetingArgs.initiatorId
        if (isInitiator)
          db.ref(`sessions/${workspace.team.id}/${meeting_request_id}/${user.id}`)
            .set('accepted')
        return !isInitiator
      })

      for(let user of usersExceptInitiator){
        let inviteMessage = getRandomMessage();
        const result = app.client.chat.postMessage({
          token: workspace.token,
          channel: user.id,
          text: inviteMessage,
          blocks: MessageHeadsup(inviteMessage, meeting_request_id)
        });
      }

      setTimeout(function(){
        sendMeetingLinksToWorkspace(app, {
          workspace: workspace,
          meetingId: meeting_request_id,
          users: users
        });
      }, TIMEOUT)
    }
  })
}

module.exports = {sendMeetingLinksToWorkspace, sendMessagesToWorkspaces, TIMEOUT}