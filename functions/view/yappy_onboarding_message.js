const { yappyOnboardingMessageText } = require('../strings')

module.exports.YappyOnboardingMessage = [
    {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": yappyOnboardingMessageText()
        }
    },
    {
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "emoji": true,
                    "text": "Opt out"
                },
                "style": "danger",
                "value": "yappy_message_opt_out",
                "action_id": "yappy_message_opt_out",
            }
        ]
    }
]