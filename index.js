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

  self.beforeInsert = function(req, snippet, callback) {
    // console.log('SNUPPPPPPP');
    // console.log(snippet);
    console.log('******* BODY *********');
    console.log(req.body);



    //middleware for geolocation happens here....

    callback();
  };

  /*self.beforeUpdate = function() {

  }*/

  self.dispatch = function(req, callback) {
    superDispatch.call(this, req, callback);
  };


  self.getDefaultTitle = function() {
    return 'My Location';
  };

  process.nextTick(function() { return callback(null); });
}