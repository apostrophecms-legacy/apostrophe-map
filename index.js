var async = require('async');
var _ = require('lodash');
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
    label: options.label || 'Map',
    instanceLabel: options.instanceLabel || 'Location',
    pluralLabel: options.pluralLabel || 'Locations',
    icon: options.icon || 'map',
    menuName: 'aposMapMenu',
    // locTypes are just tags that get called out for special treatment, map icons,
    // etc. if present. This is the list of such privileged tags.

    // The first loctype can be used as a default icon.
    locTypes: [
      { value: 'general', label: 'General' }
    ],
    // Effectively shut off pagination.
    //
    // Beyond this number we'd hit issues with google maps in any case
    perPage: 1000,
    startGeocoder: true
  });

  // You must be careful to concatenate with fields passed in by
  // those subclassing yours, if any! _.defaults is not good enough
  // for addFields
  options.addFields = [
    {
      name: 'address',
      label: 'Address',
      type: 'string'
    },
    {
      name: 'hours',
      label: 'Hours',
      type: 'string'
    },
    {
      name: 'lat',
      label: 'Latitude',
      type: 'float',
      def: null,
      help: 'Optional. Determined automatically from address if not supplied.'
    },
    {
      name: 'lng',
      label: 'Longitude',
      type: 'float',
      def: null,
      help: 'Optional. Determined automatically from address if not supplied.'
    },
    {
      name: 'showInfoBox',
      label: 'Show Info Box on Map',
      type: 'boolean',
      def: true,
      help: 'Show extended info for this item when it is clicked on within a Google Map.'
    }
  ].concat(options.addFields || []);

  options.removeFields = [
    'hideTitle'
  ].concat(options.removeFields);

  // If somebody REALLY doesn't want to group their fields,
  // take the hint, otherwise supply a default behavior
  if (options.groupFields !== false) {
    options.groupFields = options.groupFields ||
      // We don't list the title field so it stays on top
      [
        {
          name: 'location',
          label: 'Location',
          icon: 'map',
          fields: [
            'address', 'hours', 'lat', 'lng'
          ]
        },
        {
          name: 'description',
          label: 'Description',
          icon: 'metadata',
          fields: [
            'thumbnail', 'body'
          ]
        },
        {
          name: 'admin',
          label: 'admin',
          icon: 'metadata',
          fields: [
            'tags', 'published'
          ]
        }
      ];
  }

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
    if (self.geocoder) {
      // Gracefully ignore redundant starts for bc
      return;
    }
    if (!options) {
      options = {};
    }
    self.geocoder = geocoder(_.defaults(options, { instance: self._instance, apos: self._apos }));
    return self.geocoder;
  };

  self.beforePutOne = function(req, slug, options, snippet, callback) {
    // descr is a denormalized copy of the plaintext part of the body area,
    // for lightweight display in map boxes
    snippet.descr = self._apos.getAreaPlaintext({ area: snippet.body });
    self.geocoder.geocodeSnippet(snippet, false, function() {
      return callback(null);
    });
  };

  // Default dispatcher is good for our needs, don't reinvent the wheel

  // Prunes map locations for use in the actual map. Sending all the data
  // produces a huge HTML document
  self._apos.addLocal('aposPruneMapLocations', function(locations) {
    return _.map(locations, function(location) {
      return _.pick(location, '_id', 'slug', 'thumbnail', 'title', 'tags', 'address', 'hours', 'url', 'geo', 'descr', 'showInfoBox');
    });
  });

  if (options.startGeocoder !== false) {
    process.nextTick(function() {
      // Start the geocoder on next tick, so that it can be
      // overridden in subclasses
      self.startGeocoder();
    });
  }

  self._apos.addMigration('addMapGeo', function(callback) {
    // Don't say type: 'mapLocation' because we want this to work for
    // subclasses with different instance types too. Instead check the
    // coords object really carefully

    var needed;

    return self._apos.forEachPage({ coords: { $exists: 1 }, geo: { $exists: 0 } }, function(page, callback) {
      if ((!page.coords) || (typeof(page.coords) !== 'object')) {
        return callback(null);
      }
      // Sorry, Gulf of Guinea
      if ((!page.coords.lat) || (!page.coords.lng)) {
        return callback(null);
      }
      if (!needed) {
        needed = true;
      }
      return self._apos.pages.update({ _id: page._id }, {
        $set: {
          geo: {
            type: 'Point',
            coordinates: [ page.coords.lng, page.coords.lat ]
          }
        }
      }, callback);
    }, callback);
  });

  var superGet = self.get;

  // The map module's get method supports the following special options:
  //
  // options.address: sort by distance from the given address.

  // options.geo: sort by distance from a geoJSON point.
  // Example: { type: 'Point', coordinates: [ longitude, latitude ] }

  // options.maxMiles, options.maxKm, options.maxDistance:
  // maximum distance in miles, kilometers or meters respectively.

  self.get = function(req, userCriteria, options, callback) {
    if (options.address) {
      if (!options.sort) {
        options.sort = false;
      }
      return self.geocoder.geocode(options.address, function(err, geo) {
        if (err) {
          return callback(err);
        }
        var _options = _.cloneDeep(options);
        delete _options.address;
        _options.geo = geo;
        return self.get(req, userCriteria, _options, callback);
      });
    }
    if (options.geo) {
      var near = {
        $geometry: options.geo
      };
      if (options.maxDistance) {
        near.$maxDistance = options.maxDistance;
      } else if (options.maxKm) {
        near.$maxDistance = options.maxKm * 1000;
      } else if (options.maxMiles) {
        near.$maxDistance = options.maxMiles * 1609.34;
      }
      // Make it safe to modify
      options = _.cloneDeep(options);
      var criteria = {
        geo: { $near: near }
      };
      // Use lateCriteria because of this error:
      // exception: assertion src/mongo/db/query/planner_ixselect.cpp:323
      options.lateCriteria = criteria;
    }
    return superGet(req, userCriteria, options, callback);
  };

  if (callback) {
    process.nextTick(function() {
      return callback(null);
    });
  }

};

