const { InstantYapModal } = require('../view/instant_yap_modal')
const { getSubscribedUsers } = require('../yappy/users')
const { TIMEOUT, GROUP_SIZE } = require('../yappy/messaging')
const TIMEOUT_MIN = TIMEOUT/60000

const admin = require("firebase-admin");

const instantYapOptions = async (app,state) => {
    let workspace
    await admin.database().ref(`installations/${state.workspaceId}`)
    .once('value', async (data) => {workspace = data.val()})

    const selectValues = await getSubscribedUsers(app,workspace)
        .then(users => Object.entries(users)
        .filter(user => user[1].id != state.initiatorId)
        .map(user => {
            return {
                "text": {
                    "type": "plain_text",
                    "text": user[1].name
                  },
                "value": `user/${user[1].id}`
            }
        }))

    return selectValues
}

const openModal = async (app, {ack, context, body}) => {
    await ack()
    await app.client.views.open({
        token: context.botToken,
        trigger_id: body.trigger_id,
        view: await InstantYapModal()
      }
    )
    .then(async result => {
        const optionsList = await instantYapOptions(app, {
            workspaceId: body.user.team_id,
            initiatorId: body.user.id
        })

        const element = optionsList && optionsList.length 
            ? {
            "type": "input",
            "block_id": "instant_yap_input",
            "label": {
                "type": "plain_text",
                "text": `Can't wait for the next session? Invite your colleagues to a ${TIMEOUT_MIN}-minute instant break!`,
                "emoji": true
            },
            "element": {
              "action_id": "yappy_select_users",
              "type": "multi_static_select",
              "max_selected_items": GROUP_SIZE - 1,
              "placeholder": {
                "type": "plain_text",
                "text": "Select users..."
              },
              "options": await optionsList
            }
        }
        : {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*There are no other active users right now.*"
            },
        }

        // console.log(element)

        await app.client.views.update({
            token: context.botToken,
            view_id: result.view.id,
            view: await InstantYapModal(element)
        })
    })
}

const InstantYap = { openModal, instantYapOptions }

module.exports = { InstantYap }