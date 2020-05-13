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

async function sendMeetingLinksToWorkspace(app, workspace, meeting_request_id) {
    console.log("Users who accepted the call from team ", workspace.team.name)

    var db = admin.database();
    var ref = db.ref(`sessions/${workspace.team.id}/${meeting_request_id}`);
    const allUsersRef = db.ref(`users/${workspace.team.id}`)
    let allUsers
    await allUsersRef.once('value', async data => {allUsers = data.val()})

    let snapshot = await ref.once("value", async function(data){

      const users = await Promise.all(
        Object.entries(allUsers)
        .map(async user => await app.client.users.info({
              token: workspace.token,
              user: user[0]
            }).then(async user => {
              return {
                name: user.user.profile.real_name,
                id: user.user.id,
                avatar: user.user.profile.image_48,
                status: await app.client.users.getPresence({
                  token: workspace.token,
                  user: user.user.id
                }).then(status => status.presence)
              }
            }))
      ).then(async users => {
        const responses = data.val() || {}

        return {
          accepted: users.filter(user => responses[user.id] == 'accepted'),
          maybe: users.filter(user => !responses[user.id] && user.status == 'active'),
          declined: users.filter(user => responses[user.id] == 'declined'),
        }
      })
      console.log('users', users)
      if (users.accepted.length){
        let groups = splitToChunks(users.accepted, 2);

        console.log("Sending meeting links to groups...")
        const ongoingMeetings = []

        for (let group of groups) {
          let meeting_group_id = v4().replace(/-/g,"");
          let meeting_url = `https://8x8.vc/440607796/${meeting_group_id}`
          ongoingMeetings.push({url : meeting_url, users : group})

          for(let user of group) {
            const result = app.client.chat.postMessage({
              token: workspace.token,
              channel: user.id,
              text: "Time to join your yapping meeting.",
              blocks: JoinMessage(meeting_url, group, "Don't hold back. Join others to start yapping.")
            });
          }

          for (const user of users.maybe) {
            const result = app.client.chat.postMessage({
              token: workspace.token,
              text: `There are some sessions in progress you can join`,
              channel: user.id,
              blocks: await SessionListMessage(ongoingMeetings) 
            })
          }
        }
      }
      else console.log("Nobody")
    })
  }

async function sendMessagesToWorkspaces(app,workspaceId = null){
    var db = admin.database();
    var ref = db.ref(`installations${workspaceId? `/${workspaceId}` : ""}`);
    let snapshot = await ref.once("value", async function(data){
      let workspaces = workspaceId ? {workspace : data.val() } : data.val();
      for (let [key, workspace] of Object.entries(workspaces)) {
        console.log("Getting users for ", workspace.team.name)
        let meeting_request_id = v4();
        let users = await getSubscribedUsers(app, workspace);
        console.log(workspaces)
        for(let user of users){
          let inviteMessage = getRandomMessage();
          const result = app.client.chat.postMessage({
            token: workspace.token,
            channel: user.id,
            text: inviteMessage,
            blocks: MessageHeadsup(inviteMessage, meeting_request_id)
          });
        }

        setTimeout(function(){
          sendMeetingLinksToWorkspace(app, workspace, meeting_request_id);
        }, TIMEOUT)
      }
    })
  }

module.exports = {sendMeetingLinksToWorkspace, sendMessagesToWorkspaces}