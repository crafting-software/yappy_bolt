const moment = require('moment')
const admin = require("firebase-admin");
const { parseTime } = require('../utils')
const { TIMEOUT, sendMessagesToWorkspaces } = require('./messaging')

const { HomeView } = require('../view/app_home')
const { ScheduleMeetingModal } = require('../view/schedule_meeting_modal')

module.exports.scheduleMeeting = async (app, {ack, context, body}) => {
  await ack()
  await app.client.views.open({
    token: context.botToken,
    trigger_id: body.trigger_id,
    view: ScheduleMeetingModal()
  })
}

module.exports.submitMeeting = async (app, {ack, body, view, context}) => {
    await ack()

    const userId = body.user.id
    const workspaceId = body.team.id
  
    const user = await app.client.users.info({
      token: context.botToken,
      user: userId
    })
  
    const time = view.state.values.yappy_time_input_block.yappy_time_input.value
    const tz = user.user.tz
    const tz_offset = user.user.tz_offset
  
    const [hour, min] = parseTime(time)
    if (typeof hour == 'number' && typeof min == 'number'){
  
      const utcTime = moment.utc().hours(hour).minutes(min).subtract({seconds: tz_offset}).format('HH:mm')
      const [initialHour, initialMin] = parseTime(view.blocks[0].element.initial_value) || []
      let initialTime
      if(typeof initialHour == 'number' && typeof initialMin == 'number') {
        initialTime = moment.utc().hours(initialHour).minutes(initialMin).subtract({seconds: tz_offset}).format('HH:mm')
      }
  
      console.log(view.blocks[0].element.initial_value)
  
      await admin.database()
        .ref(`scheduled_sessions/${body.team.id}/${initialTime}`)
        .remove()
  
      await admin.database()
      .ref(`scheduled_sessions/${body.team.id}/${utcTime}`)
      .set({
          tz: tz,
          utc_time: utcTime,
          tz_offset: tz_offset
        })
    }
    
    const result = await app.client.views.publish({
      token: context.botToken,
      user_id: userId,
      view: await HomeView(user.user)
    });
}

module.exports.editMeeting = async (app,time, {body, context}) => {
  const workspaceId = body.team.id
  const userId = body.user.id

  const user = await app.client.users.info({
    token: context.botToken,
    user: userId
})

const [h, m] = parseTime(time)
const localTime = moment()
  .clone()
  .hours(h)
  .minutes(m)
  .add(user.user.tz_offset, 'seconds').format('HH:mm')

await app.client.views.open({
  token: context.botToken,
  trigger_id: body.trigger_id,
  view: ScheduleMeetingModal({ value : localTime })
})

const result = await app.client.views.publish({
  token: context.botToken,
  user_id: userId,
  view: await HomeView(user.user)
})
}

module.exports.deleteMeeting = async (app, optionArg, {body, context}) => {
  const workspaceId = body.team.id
  const userId = body.user.id

  await admin.database()
    .ref(`scheduled_sessions/${workspaceId}/${optionArg}`)
    .remove()
  console.log(`Deleted session at ${optionArg}`)


  const user = await app.client.users.info({
    token: context.botToken,
    user: userId
  })

  const result = await app.client.views.publish({
    token: context.botToken,
    user_id: userId,
    view: await HomeView(user.user)
  })
}

module.exports.newInstantMeeting = async (app, {ack,body, context}) => {
  await ack()
  await app.client.chat.postMessage({
    token: context.botToken,
    channel: body.user.id,
    text: `Your instant meeting starts in ${TIMEOUT/60000} minutes. Stay tuned!`
  }).then(async message => {
    const userChannel = message.channel
    await admin.database().ref(`users/${body.user.team_id}/${body.user.id}/channel`).set(userChannel)
  })
  sendMessagesToWorkspaces(app, body.team.id, {initiatorId: body.user.id})
}

module.exports.RSVP = {
  accept : async (app, {ack, say, context, body, respond }) => {
    await ack();
    await respond("Great, your session will start soon. I'll give you a ping.");
    console.log(`Yapp accepted by ${body.user.name}`);
    let user_id = body.user.id;
    let meeting_request_id = body.actions[0].value;
    var usersRef = await admin.database()
      .ref(`sessions/${body.user.team_id}/${meeting_request_id}/users/${body.user.id}`)
      .set({response: 'accepted'});
  },

  decline: async (app, {ack, say, context, body, respond }) => {
    await ack();
    await respond('Okay, maybe next time.');
    console.log(`Yapp declined by ${body.user.name}`);
    let meeting_request_id = body.actions[0].value;
    var usersRef = await admin.database()
      .ref(`sessions/${body.user.team_id}/${meeting_request_id}/users/${body.user.id}`)
      .set('declined');
    }
}