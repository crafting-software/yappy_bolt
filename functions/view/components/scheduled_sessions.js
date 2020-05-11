const moment = require('moment')
const { parseTime } = require('../../utils')

module.exports.ScheduledSessions = (user,sessions) => {

    const userIsAdmin = user ? user.is_admin : false
    let template = [{
        "type": "section",
        "text": {
            "type": "plain_text",
            "text": " ",
            "emoji": true
        }
    }]

    if (user) {
        if (!sessions.length) {
            template[0]['text'] = {
                "type": "mrkdwn",
                "text": "*No sessions have been set up yet*"
            }
        }
        else {
            template = sessions.map(session => {
                const [h, m] = parseTime(session.utc_time)
                const localTime = moment().hours(h).minutes(m).add(session.tz_offset, 'seconds').format('HH:mm')
                const sessionItem = {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `:alarm_clock: *${localTime}*`
                    }
                }

                if (userIsAdmin){ 
                    sessionItem['accessory'] = {
                        "type": "overflow",
                        "action_id": "yappy_admin_menu",

                        "options": [
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "Edit",
                                    "emoji": true
                                },
                                "value": `edit_meeting/${session.utc_time}`
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "Delete",
                                    "emoji": true
                                },
                                "value": `delete_meeting/${session.utc_time}`
                            }
                        ]
                    }
                }

                return sessionItem
            })
        }
    }
    return template
}