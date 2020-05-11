module.exports.NewSessionControls = (user) => {
    let template = [{
        "type": "section",
        "text": {
            "type": "plain_text",
            "text": " ",
            "emoji": true
        }
    }]

    if (user) {
        template = {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "emoji": true,
                        "text": "Instant yap"
                    },
                    "style": "primary",
                    "action_id": "yappy_new_instant_meeting"
                }
            ]
        }

        if (user.is_admin) {
            template['elements'].push({
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "emoji": true,
                    "text": "Schedule meeting"
                },
                "style": "primary",
                "action_id": "yappy_admin_schedule_meeting"
              })
        }

        template = [{"type":"divider"}, template, {"type": "divider"}]
    }

    return template
  }