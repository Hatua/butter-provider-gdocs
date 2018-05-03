const axios = require('axios');

const getYoutubeData = (ids, key, part='snippet,contentDetails,statistics') => (
    axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
            id: ids,
            part: part,
            key: key
        }
    })
)

module.exports = getYoutubeData
