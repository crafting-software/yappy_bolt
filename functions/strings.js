const messages = [
    'Get ready to yap. Sit up, stretch your legs, arms and your jaw.',
    'Your colleagues need you for a yap task.',
    'Grab a cofee and see ya in 5 minutes.',
    '5 minutes till your next yappin session. This is plenty of time to get out of those stained pijamas. C’mon, show some respect!',
    'Maybe put on a nice shirt today? I know you can do it.',
    'Taking a break can lead to breakthroughs',
    'Almost everything will work again if you unplug it for a few minutes...including you.',
    'When in doubt, chill out.',
    'Relax. Refresh. Recharge.',
    'Take a break. Have a KitKat.',
    'Have a break from taking breaks.',
    'Take a break, you have earned it.'
]

module.exports.getRandomMessage = () => messages[Math.floor(Math.random()*messages.length)]
