function parseUsers(users) {
    console.log(users)
    const activeUsers = []
    console.log( users)
    for (const user of users){
        console.log('sdadasdasdadasd')
        console.log(user)
        // activeUsers.push({
        //     "type": "image",
        //     "image_url": user.user.profile.image_24,
        //     "alt_text": user.user.profile.real_name
        // })
    }
    return activeUsers
}

 module.exports.JoinMessage = //(users) => parseUsers(users)

(users) => {

    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Your 10 minutes yappin time starts now. Don’t hold back!*"
            }
        },
        {
            "type": "divider"
        },
        {
            "type": "context",
            "elements": [
                parseUsers(users),
                {
                    "type": "plain_text",
                    "emoji": true,
                    "text": "happening now"
                }
            ]
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "emoji": true,
                        "text": "Join and start yappin"
                    },
                    "style": "primary",
                    "value": "click_me_123"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "emoji": true,
                        "text": "Can't join this time"
                    },
                    "value": "click_me_123"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "emoji": true,
                        "text": "I hate this, unsubscribe"
                    },
                    "style": "danger",
                    "value": "click_me_123"
                }
            ]
        }
    ]
}
