var async = require('async');
var _ = require('underscore');
var extend = require('extend');
var snippets = require('apostrophe-snippets');
var util = require('util');
var geocoder = require('geocoder');

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
    webAssetDir: __dirname + '/public',
    menuName: 'aposMapMenu',
    locTypes: [
      { name: 'general', label: 'General' },
      { name: 'restaurant', label: 'Restaurant' },
      { name: 'hotel', label: 'Hotel' }
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

  var superDispatch = self.dispatch;

  function appendExtraFields(data, snippet, callback) {

    //shove the raw address into the snippet object on its way to mongo
    snippet.address = data.address;
    snippet.hours = data.hours;
    // Tolerant of alternate names, for the importer
    snippet.descr = data.descr || data.description;

    // Tolerant of alternate names, for the importer
    var dataLocType = data.locType || data.locationType;
    if (!dataLocType) {
      dataLocType = '';
    }

    // Be really tolerant of how they enter location types, for the importer
    var locType = _.find(self._locTypes, function(locType) {
      return ((locType.name.toLowerCase() === dataLocType.toLowerCase()) ||
        (locType.label.toLowerCase() === dataLocType.toLowerCase()));
    });
    if (!locType) {
      locType = self._locTypes[0];
    }
    snippet.locType = locType.name;

    // use geocoder to generate a lat/long for the address and shove that in the snippet too
    geocoder.geocode(data.address, function ( err, coords ) {
      if(!err) {
        snippet.coords = coords.results[0].geometry.location;
        return callback();
      } else {
        console.log(err);
        return callback(err);
      }
    });
  }

  self.beforeInsert = function(req, data, snippet, callback) {
    appendExtraFields(data, snippet, callback);
  };

  self.beforeUpdate = function(req, data, snippet, callback) {
    appendExtraFields(data, snippet, callback);
  };

  self.dispatch = function(req, callback) {
    superDispatch.call(this, req, callback);
  };

  self.getDefaultTitle = function() {
    return 'My Location';
  };

  process.nextTick(function() { return callback(null); });
};

