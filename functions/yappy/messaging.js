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

const MINUTE = 60000
const TIMEOUT = MINUTE * 5
const SESSION_DURATION = MINUTE * 10
const GROUP_SIZE = 3

async function sendMeetingLinksToWorkspace(app, {workspace, meetingId, users}){
  const userData = users.map(user =>{
    return {
      name: user.profile.real_name,
      id: user.id,
      avatar: user.profile.image_48,
    }
  })
  const ref = admin.database().ref(`sessions/${workspace.team.id}/${meetingId}/users`)
  ref.once("value", async function(data){
    const userResponses = data.val() || []
    console.log('User responses', userResponses)

    const userLists = {
      accepted: userData.filter(user => userResponses[user.id] && userResponses[user.id].response == 'accepted'),
      declined: userData.filter(user => userResponses[user.id] && userResponses[user.id].response == 'declined'),
      maybe: userData.filter(user => !userResponses[user.id].response),
    }
    console.log(userLists)
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
            token: workspace.token,
            channel: user.id,
            text: "Time to join your yapping meeting.",
            blocks: JoinMessage(meeting_url, group, "Don't hold back. Join others to start yapping.")
          }).then(async message => {
            const channel = message.channel
            const ts = message.message.ts

            //Timestamps are attached only after message is sent, so the corresponding message can be retrieved via slack api
            await admin.database()
              .ref(`sessions/${workspace.team.id}/${meetingId}/users/${user.id}/ts`)
              .set(ts)

            await admin.database()
              .ref(`sessions/${workspace.team.id}/${meetingId}/users/${user.id}/channel`)
              .set(channel)

            await admin.database()
              .ref(`sessions/${workspace.team.id}/${meetingId}/users/${user.id}/group`)
              .set({id: meeting_group_id, meeting_link: meeting_url})
          });
        }

        for (const user of userLists.maybe) {

          const result = app.client.chat.postMessage({
            token: workspace.token,
            text: `There are some sessions in progress you can join`,
            channel: user.id,
            blocks: await SessionListMessage(ongoingMeetings) 
          }).then(async res => {
            await admin.database().ref(`sessions/${workspace.team.id}/${meetingId}/users/${user.id}`).set({
              response: 'none',
              ts: res.ts,
              channel: res.channel
            })
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
      const ts_start = moment.utc().unix()
      const ts_end = ts_start + (TIMEOUT + SESSION_DURATION)/1000

      if (users.length)
      db.ref(`sessions/${workspace.team.id}/${meeting_request_id}/status`)
        .set('pending')
      for (const user of users) {
        const isInitiator = instantMeetingArgs && user.id == instantMeetingArgs.initiatorId
        if (isInitiator){
          await app.client.chat.postMessage({
            token: workspace.token,
            channel: user.id,
            text: `Your instant meeting starts in ${TIMEOUT/60000} minutes. Stay tuned!`
          }).then(message => {
            db.ref(`sessions/${workspace.team.id}/${meeting_request_id}/users/${user.id}`)
            .set({response: 'accepted', headsup_ts: message.ts, channel: message.channel})
          })
          
        }
        else {
          const inviteMessage = getRandomMessage()
          await app.client.chat.postMessage({
            token: workspace.token,
            channel: user.id,
            text: inviteMessage,
            blocks: MessageHeadsup(inviteMessage, meeting_request_id)
          }).then(async message => {
            const userChannel = message.channel
            await db.ref(`users/${workspace.team.id}/${user.id}/channel`).set(userChannel)

            await db.ref(`sessions/${workspace.team.id}/${meeting_request_id}/users/${user.id}`)
            .set({headsup_ts: message.ts, channel: userChannel})
          })
        }
      }

      await db.ref(`sessions/${workspace.team.id}/${meeting_request_id}/timestamps`).set({
        ts_start: ts_start,
        ts_end: ts_end
      })
    }
  })
}

async function requestUserFeedback(app, {body, context}){
  const channel = body.event.channel
  const [userFeedback,feedbackRequest] = await app.client.conversations.history({
    token: context.botToken,
    channel: channel,
    limit: 2
  }).then(resp => resp.messages)

  if (feedbackRequest.bot_profile 
    && feedbackRequest.text == FeedbackRequestMessage.text){
    const feedbackRef = await admin.database().ref("feedback").push(userFeedback.text)
    console.log("Feedback sent")

    await app.client.chat.postMessage({
      token: context.botToken,
      channel: channel,
      thread_ts: userFeedback.ts,
      text: "Feedback sent!"
    })
  }
}
module.exports = {sendMeetingLinksToWorkspace, sendMessagesToWorkspaces, requestUserFeedback, TIMEOUT}