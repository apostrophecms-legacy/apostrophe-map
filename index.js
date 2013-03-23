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
    menuName: 'aposMapMenu'
  });

  options.dirs = (options.dirs || []).concat([ __dirname ]);
  snippets.Snippets.call(this, options, null);
  var superDispatch = self.dispatch;

  function appendExtraFields(req, snippet, callback) {
    //shove the raw address into the snippet object on its way to mongo
    var address = req.body.address;
    var type = req.body.locType;
    var hours = req.body.hours;
    var description = req.body.descr;

    snippet.address = address;

    // use geocoder to generate a lat/long for the address and shove that in the snippet too
    geocoder.geocode(address, function ( err, coords ) {
      if(!err) {
        snippet.coords = coords.results[0].geometry.location;
        callback();
      } else {
        console.log(err);
      }
    });
  }

  self.beforeInsert = function(req, snippet, callback) {
    appendExtraFields(req, snippet, callback);
  };

  self.beforeUpdate = function() {
    appendExtraFields(req, snippet, callback);
  }

  self.dispatch = function(req, callback) {
    superDispatch.call(this, req, callback);
  };

  self.getDefaultTitle = function() {
    return 'My Location';
  };

  process.nextTick(function() { return callback(null); });
}