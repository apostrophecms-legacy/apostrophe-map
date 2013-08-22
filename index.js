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
    menuName: 'aposMapMenu',
    addFields: [
      {
        name: 'address',
        type: 'string'
      },
      {
        name: 'hours',
        type: 'string'
      }
    ],
    // locTypes are just tags that get called out for special treatment, map icons,
    // etc. if present. This is the list of such privileged tags.

    // The first loctype can be used as a default icon.
    locTypes: [
      { value: 'general', label: 'General' }
    ],
    // Effectively shut off pagination.
    //
    // Beyond this number we'd hit issues with google maps in any case
    perPage: 1000
  });

  options.modules = (options.modules || []).concat([ { dir: __dirname, name: 'map' } ]);

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

  self.pushAsset('template', 'infoBox', { when: 'always' });

  var superAddDiffLines = self.addDiffLines;

  // Make sure our custom fields are included in version diffs
  self.addDiffLines = function(snippet, lines) {
    superAddDiffLines(snippet, lines);
    if (snippet.address) {
      lines.push('address: ' + snippet.address);
    }
    if (snippet.hours) {
      lines.push('hours: ' + snippet.hours);
    }
    if (snippet.descr) {
      lines.push('description: ' + snippet.descr);
    }
  };

  var superAddSearchTexts = self.addSearchTexts;

  self.addSearchTexts = function(snippet, texts) {
    texts.push({ weight: 20, text: snippet.descr });
  };

  self.geocoder = null;

  // Invoke from only ONE process if you are using cluster, multiple
  // servers, etc. The idea is to avoid smacking into Google's rate limit.

  self.startGeocoder = function(options) {
    if (!options) {
      options = {};
    }
    self.geocoder = geocoder(_.defaults(options, { instance: self._instance, apos: self._apos }));
    return self.geocoder;
  };

  self.beforeSave = function(req, data, snippet, callback) {
    // descr is a denormalized copy of the plaintext part of the body area,
    // for legacy template support and for lightweight display in map boxes
    snippet.descr = self._apos.getAreaPlaintext({ area: snippet.areas.body });
    self.geocoder.geocodeSnippet(snippet, false, function() {
      return callback(null);
    });
  };

  // Default dispatcher is good for our needs, don't reinvent the wheel

  self.getDefaultTitle = function() {
    return 'My Location';
  };

  // Prunes map locations for use in the actual map. Sending all the data
  // produces a huge HTML document
  self._apos.addLocal('aposPruneMapLocations', function(locations) {
    return _.map(locations, function(location) {
      location = _.pick(location, '_id', 'slug', 'areas', 'title', 'tags', 'address', 'hours', 'url', 'coords', 'descr');
      if (location.areas) {
        location.areas = { thumbnail: location.areas.thumbnail };
      }
      return location;
    });
  });

  if (callback) {
    process.nextTick(function() {
      return callback(null);
    });
  }
};

