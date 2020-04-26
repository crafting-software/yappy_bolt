module.exports.MessageHeadsup = (randomMessage) => [
    {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": randomMessage
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
                    "text": "Approve"
                },
                "style": "primary",
                "action_id": "accept_yappy_session"
            },
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "emoji": true,
                    "text": "Deny"
                },
                "style": "danger",
                "value": "click_me_123"
            }
        ]
    }
]
