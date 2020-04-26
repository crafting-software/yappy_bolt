module.exports.MessageHeadsup = (randomMessage, meeting_request_id) => [
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
                    "text": "Sure, I'll take a break"
                },
                "style": "primary",
                "value": meeting_request_id,
                "action_id": "accept_yappy_session"
            },
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "emoji": true,
                    "text": "Too busy working"
                },
                "style": "danger",
                "value": "click_me_123"
            }
        ]
    }
]
