var nodeGeocoder = require('node-geocoder');
var RateLimiter = require('limiter').RateLimiter;
var async = require('async');

module.exports = function(options) {
  return new Geocoder(options);
};

function Geocoder(options) {
  var self = this;
  self._nodeGeocoder = nodeGeocoder(options || {});
  // Google's standard free limits
  self._dailyLimit = options.dailyLimit || 2500;
  self._rateLimit = options.rateLimit || 10;
  self._instance = options.instance;
  self._apos = options.apos;
  self.cacheLifetime = options.cacheLifetime || 86400;
  self.cache = self._apos.getCache('apostrophe-map-geocoder');

  var dayLimiter = new RateLimiter(self._dailyLimit, 'day');
  var secondLimiter = new RateLimiter(self._rateLimit, 'second');

  // Strategy: wake up once a second, look for ungeocoded addresses, pull
  // as many as the rate limit allows per second and then use RateLimiter
  // to ensure we don't go faster than the daily and per-second rate limits
  // of Google's API permit.

  self.geocodePass = function() {
    // Make sure an address exists, otherwise the geocode module will complain in a way
    // that sticks us in a loop trying again with that bad location forever
    self._apos.pages.find({ type: self._instance, address: { $exists: true, $ne: '' }, geoInvalidAddress: { $ne: true }, $or: [{ geo: { $exists: false }}, { geo: null } ] },
      { title: 1, address: 1 }).limit(self._rateLimit).toArray(function(err, snippets) {
      // Use eachSeries to avoid parallelism, the rate limiter below should in theory
      // make this not a problem but I've seen Google get grumpy.
      async.eachSeries(snippets || [], geocodeSnippet, function(err) {
        // Don't invoke passes so ferociously often, and
        // introduce randomness to deal more gracefully
        // with situations where many Apostrophe instances
        // are talking to MongoDB
        setTimeout(self.geocodePass, 10000 + Math.random() * 5000);
      });

      function geocodeSnippet(snippet, callback) {
        // Use rate limiter to avoid getting shut down by Google during large imports.
        // This still won't help you if you hit the per-day limit (2,000+), we would
        // have to resolve that with something in the background
        dayLimiter.removeTokens(1, function() {
          secondLimiter.removeTokens(1, function() {
            return self.geocodeSnippet(snippet, true, callback);
          });
        });
      }
    });
  };

  // Geocode an address now. Callback receives an error if
  // any and a geoJSON point:
  //
  // { type: 'point', coordinates: [ longitude, latitude ] }
  //
  // Check the cache first

  self.geocode = function(address, callback) {

    var location;

    return self.cache.get(address, function(err, value) {
      if (err) {
        return callback(err);
      }
      if (value) {
        return callback(null, value);
      }
      return fetch();
    });
    
    function fetch() {
      return self._nodeGeocoder.geocode(address, function(err, geo) {
        if (err) {
          console.error('geocoding error: ', err);
          return callback(err);
        }
        if (!geo) {
          console.error('geocoding problem: invalid response');
          return callback(new Error('Invalid response'));
        }
        if (!geo.length) {
          // No location was found (?)
          return callback(null, null);
        }
        var googlePoint = geo[0];
        location = {
          type: 'Point',
          coordinates: [ googlePoint.longitude, googlePoint.latitude ]
        };
        return insert();
      });
    }
    
    function insert() {
      return self.cache.set(address, location, self.cacheLifetime, function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, location);
      });
    }
  };

  // Available to be called individually, for instance for manual edits where
  // it is unlikely the rate limit will be reached
  self.geocodeSnippet = function(snippet, saveNow, callback) {
    snippet.geo = null;
    return async.series({
      geocode: function(callback) {
        // If a manually entered location is present, let it win
        if ((typeof(snippet.lat) === 'number') && (typeof(snippet.lng) === 'number')) {
          snippet.geoInvalidAddress = false;
          snippet.geo = {
            type: 'Point',
            coordinates: [ snippet.lng, snippet.lat ]
          };
          return callback(null);
        }
        return self.geocode(snippet.address, function(err, geo) {
          if (err) {
            // Who knows? Usually rate limiting. Hard to tell with an API that makes it
            // hard to catch things with any nuance. Try again later
            snippet.geo = null;
            return callback(null);
          }
          if (!geo) {
            snippet.geoInvalidAddress = true;
          } else {
            snippet.geoInvalidAddress = false;
            snippet.geo = geo;
          }
          return callback(null);
        });
      },
      save: function(callback) {
        if (saveNow) {
          self._apos.pages.update({ _id: snippet._id }, { $set: { geo: snippet.geo, geoInvalidAddress: snippet.geoInvalidAddress } }, function(err) {
            // If it didn't work, it'll come up in the next query,
            // no need to report the error now
            return callback(null);
          });
        } else {
          return callback(null);
        }
      }
    }, callback);
  };

  self.geocodePass();
}
