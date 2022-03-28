[![Add To Discord](https://img.shields.io/badge/-Add%20To%20Discord-7289DA?logo=discord&logoColor=fff&style=for-the-badge)](https://discord.com/api/oauth2/authorize?client_id=932391527601287178&permissions=75797&scope=bot) [![Discord](https://img.shields.io/discord/932392800471879740?color=7289DA%20&label=Join%20our%20Discord&logo=discord&logoColor=fff&style=for-the-badge)](https://discord.gg/D29TwNNm4g)
# ScamBaiter
A simple "add it and forget it" bot to automatically delete known scam links!

If you don't want to self-host the bot, you can add it [here](https://discord.com/api/oauth2/authorize?client_id=932391527601287178&permissions=75797&scope=bot)

Support for the bot, both self-hosted or not, can be found on our [Discord](https://discord.gg/D29TwNNm4g)

## Setup Instructions
This is fairly simple, make sure you have the following software installed

[Node](https://nodejs.org)

First clone and install dependencies
```
git clone https://github.com/ChrisChrome/ScamBaiter.git
cd ScamBaiter
npm i
```

Copy/rename `config.json.default` to `config.json`, then head to the [Discord Developer Portal](https://discord.com/developers/applications) to create a bot user, open `config.json` in your preferred text editor, and fill in the details like bot token and owner user IDs.

Run the bot with `node .`