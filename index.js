var async = require('async');
var _ = require('underscore');
var extend = require('extend');
var snippets = require('apostrophe-snippets');
var util = require('util');
var geocoder = require('./geocoder.js');

module.exports = map;

function map(options, callback) {
  return new map.Map(options, callback);
}

map.Map = function(options, callback) {
  var self = this;

  _.defaults(options, {
    instance: 'mapLocation',
    name: options.name || 'map',
    label: options.name || 'Map',
    icon: options.icon || 'map',
    webAssetDir: __dirname,
    menuName: 'aposMapMenu',
    // locTypes are just tags that get called out for special treatment, map icons,
    // etc. if present. This is the list of such privileged tags.

    // The first loctype can be used as a default icon.
    locTypes: [
      { name: 'general', label: 'General' }
    ]
  });

  options.dirs = (options.dirs || []).concat([ __dirname ]);

  self._locTypes = options.locTypes;

  if (!options.rendererGlobals) {
    options.rendererGlobals = {};
  }

  _.defaults(options.rendererGlobals, {
    locTypes: self._locTypes
  });

  snippets.Snippets.call(this, options, null);

  // Becomes available in browser as apos.aposMap.locTypes
  self._apos.pushGlobalData({
    aposMap: {
      locTypes: self._locTypes
    }
  });

  self.pushAsset('template', 'infoBox');

  var superDispatch = self.dispatch;

  function appendExtraFields(data, snippet, callback) {

    //shove the raw address into the snippet object on its way to mongo
    snippet.address = self._apos.sanitizeString(data.address);
    snippet.hours = self._apos.sanitizeString(data.hours);
    // Tolerant of alternate names, for the importer
    snippet.descr = self._apos.sanitizeString(data.descr || data.description);

    // geocoding now occurs in background as google's rate limit permits.
    return callback(null);
  }

  // Invoke from only ONE process if you are using cluster, multiple
  // servers, etc. The idea is to avoid smacking into Google's rate limit.

  self.geocoder = function(options) {
    if (!options) {
      options = {};
    }
    return geocoder(_.defaults(options, { instance: self._instance, apos: self._apos }));
  };

  self.beforeInsert = function(req, data, snippet, callback) {
    appendExtraFields(data, snippet, callback);
  };

  self.beforeUpdate = function(req, data, snippet, callback) {
    appendExtraFields(data, snippet, callback);
  };

  self.dispatch = function(req, callback) {
    self._apos.pages.distinct("tags", {"type":"mapLocation"}, function(err, tags){
      req.extras.allTags = tags;
      superDispatch.call(this, req, callback);
    });
  };

  self.getDefaultTitle = function() {
    return 'My Location';
  };

  if (callback) {
    process.nextTick(function() {
      return callback(null);
    });
  }
};

