/**
 * Created by GalenWeber on 4/18/16.
 */
/*
 These environment variables are not hardcoded so as not to put
 production information in a repo. They should be set in your
 heroku (or whatever VPS used) configuration to be set in the
 applications environment, along with NODE_ENV=production

 */

module.exports = {
    "FRED": {
        "apiKey": process.env.FRED_API_KEY
    },
    "MESSENGER": {
        token: process.env.MESSENGER_TOKEN
    }
};
