'use strict'

const Provider = require('butter-provider')

const getGDocsData = require('./gdocs')
const PicoTube = require('picotube').default

const defaultConfig = {
  name: 'gdocs',
  uniqueId: 'id',
  tabName: 'Google Docs',
  argTypes: {
    gdocsSpreadSheetId: Provider.ArgType.STRING,
    gdocsHeaderStart: Provider.ArgType.NUMBER,
    youtubeApiKey: Provider.ArgType.STRING,
    youtubeBaseUrl: Provider.ArgType.STRING
  },
  defaults: {
    gdocsSpreadSheetId: '1cR-jUrhPNA-tJfMyilDvvwvXkWYFMHlld81CWMXkFdg',
    gdocsHeaderStart: 2,
    youtubeApiKey: 'AIzaSyARQAHCYNuS7qi3mUxu0pgc4FjEBkOrx3U',
    youtubeBaseUrl: 'https://media.youtube.de/public'
  }
}

const translateData = (data) => {
  const translate = {
    'título': 'title',
    'gênero': 'genre',
    'ano': 'year',
    'sinopse': 'synopsis',
    'tempo': 'runtime'
  }

  Object.keys(translate).map(k => {
    const K = k.toLocaleUpperCase()

    data[translate[k]] = data[K]
    delete (data[K])
  })

  return data
}

const formatItemForButter = ({
  CAPA,
  statistics, thumbnails, synopsis, description, genre, ...item
}) => {
  const linkYoutube = item['Link youtube']
  delete item['Link youtube']

  return ({
    ...item,
    type: Provider.ItemType.MOVIE,
    // XXX(xaiki): should calculate something usefull here
    rating: (statistics.likeCount - statistics.dislikeCount*0.8)/(statistics.viewCount/50),
    genres: [genre],
    backdrop: thumbnails.high.url,
    cover: thumbnails.high.url,
    poster: thumbnails.high.url,
    trailer: linkYoutube,
    synopsis: synopsis || description || 'no synopsis provided',
    // HACK
    subtitle: [],
    sources: {
      '720p': {
        url: linkYoutube,
        size: 0
      }
    }
  })
}

const formatForButter = (items) => ({
  results: items.map(formatItemForButter),
  hasMore: true
})

const yt2ID = (link) => {
  let match = [
    /youtu.be\/([-\w]+)/,
    /watch\?v=([-\w]+)/
  ].map(r => link.match(r))
    .filter(r => r)

  return match[0][1]
}

module.exports = class GDocs extends Provider {
  constructor (args, config = defaultConfig) {
    super(args, config)

    this.youtubeApiKey = this.args.youtubeApiKey
    this.youtubeBaseUrl = this.args.youtubeBaseUrl
    this.spreadsheetId = this.args.gdocsSpreadSheetId
    this.headerStart = this.args.gdocsHeaderStart

    this.pico = new PicoTube(this.youtubeApiKey)
  }

  querySources (filters = {}) {
    var params = {}
    //        var genres = '';
    params.sort = 'seeds'

    if (filters.genre) {
      /* filters.genres.forEach(function(g) {
               genres += '&genre[]='+g;
               });
               genres = genres.substring(0, genres.length - 1);
               win.info('genres', genres); */
      params.genre = filters.genre
    }

    if (filters.order) {
      params.order = filters.order
    }

    if (filters.sorter && filters.sorter !== 'popularity') {
      params.sort = filters.sorter
    }

    return getGDocsData(this.spreadsheetId, filters.page, filters.limit)
  }

  translateData (items) {
    return items.map(translateData)
  }

  getVideoInfo (items) {
    const ids = items.map(item => (yt2ID(item['Link youtube']))).join(',')

    return this.pico.videos({
      id: ids
    }).then(({data}) => data.items)
      .then(info => (items.map((item, i) => ({
        ...item,
        id: info[i].id,
        thumbnails: info[i].snippet.thumbnails,
        statistics: info[i].statistics,
        description: info[i].snippet.description
      }))))
  }

  fetch (filters = {}) {
    return this.querySources(filters)
      .then(this.translateData)
      .then(this.getVideoInfo.bind(this))
      .then(formatForButter)
  }
  /*
     detail (id, old_data) {
     return this.pico.captions({
     id: id
     }).then(({data}) => data.items)
     .then(captions => Object.assign({}, old_data, {
     subtitle: captions.reduce((acc, cur) => Object.assign(acc, {
     [cur.language]: cur
     }), {})
     }))
     }
   */
}
