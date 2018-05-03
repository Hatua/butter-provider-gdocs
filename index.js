'use strict'

const Provider = require('butter-provider')
// const API = require('node-youtubeapi-simplifier');
// const debug = require('debug')('butter-provider-gdocs')

const getGDocsData = require('./gdocs')
const getYoutubeData = require('./youtube')

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

const formatItemForButter = (item) => ({
  ...item,
  type: Provider.ItemType.MOVIE,
  // XXX(xaiki): should calculate something usefull here
  rating: item.statistics.likeCount,
  genres: [item.genre],
  backdrop: item.thumbnails.high.url,
  poster: item.thumbnails.high.url,
  trailer: item.linkYoutube,
  synopsis: item.synopsis || item.description || 'no synopsis provided',
  // HACK
  subtitle: [],
  subtitles: [],
  torrents: [{
    '720p': {
      url: null,
      size: 0
    }
  }],
})

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

    //        this.API = API
    //        this.API.setup(this.youtubeApiKey)
  }

  queryTorrents (filters = {}) {
    var params = {}
    //        var genres = '';
    params.sort = 'seeds'
    params.limit = '50'

    if (filters.genre) {
      /* filters.genres.forEach(function(g) {
               genres += '&genre[]='+g;
               });
               genres = genres.substring(0, genres.length - 1);
               win.info('genres', genres); */
      params.genre = filters.genres[0]
    }

    if (filters.order) {
      params.order = filters.order
    }

    if (filters.sorter && filters.sorter !== 'popularity') {
      params.sort = filters.sorter
    }

    return getGDocsData(this.spreadsheetId)
  }

  translateData (items) {
    return items.map(translateData)
  }

  getVideoInfo (items) {
    const ids = items.map(item => (yt2ID(item['Link youtube']))).join(',')

    return getYoutubeData(ids, this.youtubeApiKey)
      .then(({data}) => data.items)
      .then(info => (items.map((item, i) => ({
        ...item,
        id: info[i].id,
        thumbnails: info[i].snippet.thumbnails,
        statistics: info[i].statistics,
        description: info[i].snippet.description
      }))))
  }

  fetch (filters = {}) {
    return this.queryTorrents(filters)
      .then(this.translateData)
      .then(this.getVideoInfo.bind(this))
      .then(formatForButter)
  }
}
