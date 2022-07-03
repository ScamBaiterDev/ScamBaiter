[![Add To Discord](https://img.shields.io/badge/-Add%20To%20Discord-7289DA?logo=discord&logoColor=fff&style=for-the-badge)](https://l.chrischro.me/sbinvite) [![Discord](https://img.shields.io/discord/932392800471879740?color=7289DA%20&label=Join%20our%20Discord&logo=discord&logoColor=fff&style=for-the-badge)](https://l.chrischro.me/sbdiscord) ![GitHub](https://img.shields.io/github/license/ScamBaiterDev/ScamBaiter?style=for-the-badge) 
# ScamBaiter
A simple "add it and forget it" bot to automatically delete known scam links!

If you don't want to self-host the bot, you can add it [here](https://l.chrischro.me/sbinvite)

Support for the bot, both self-hosted or not, can be found on our [Discord](https://l.chrischro.me/sbinvite)

## Setup Instructions
This is fairly simple, make sure you have the following software installed

[Node](https://nodejs.org)

First clone and install dependencies
```
git clone https://github.com/ScamBaiterDev/ScamBaiter.git
cd ScamBaiter
npm i
```

Copy/rename `config.json.default` to `config.json`, then head to the [Discord Developer Portal](https://discord.com/developers/applications) to create a bot user, open `config.json` in your preferred text editor, and fill in the details like bot token and owner user IDs.

Run the bot with `node .`