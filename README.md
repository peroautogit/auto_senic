# njuškalo-scraper

A simple node.js script that goes to njuskalo.hr every 30 minutes and get the last day(s) of listings and push it to a Telegram chat via the Telegram Bot API.

## How to use
Add a search URL with your filters to the array `urls` in the file `main.js` and `CHAT_ID` and `BOT_API` to your environment variables on github actions(settings-->security--> secrets--> actions/add new secret).

## License
MIT
ninichuuh

