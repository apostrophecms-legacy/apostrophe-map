var geocoder = require('geocoder');
var RateLimiter = require('limiter').RateLimiter;
var async = require('async');

module.exports = function(options) {
  return new Geocoder(options);
};

function Geocoder(options) {
  var self = this;
  // Google's standard free limits
  self._dailyLimit = options.dailyLimit || 2500;
  self._rateLimit = options.rateLimit || 10;
  self._instance = options.instance;
  self._apos = options.apos;

  var dayLimiter = new RateLimiter(self._dailyLimit, 'day');
  var secondLimiter = new RateLimiter(self._rateLimit, 'second');

  // Strategy: wake up once a second, look for ungeocoded addresses, pull
  // as many as the rate limit allows per second and then use RateLimiter
  // to ensure we don't go faster than the daily and per-second rate limits
  // of Google's API permit.

  self.geocodePass = function() {
    // Make sure an address exists, otherwise the geocode module will complain in a way
    // that sticks us in a loop trying again with that bad location forever
    self._apos.pages.find({ type: self._instance, address: { $exists: true, $ne: '' }, $or: [{ geo: { $exists: false }}, { geo: null } ] },
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

  self.geocode = function(address, callback) {
    return geocoder.geocode(address, function(err, geo) {
      if (err) {
        return callback(err);
      }
      if (geo.status === 'OVER_QUERY_LIMIT') {
        return callback(new Error(geo.status));
      } else if (geo.status === 'ZERO_RESULTS') {
        return callback(new Error(geo.status));
      } else {
        if (!(geo.results && geo.results[0])) {
          return callback(new Error('ZERO_RESULTS'));
        }
        var location = geo.results[0].geometry.location;
        return callback(null, {
          type: 'Point',
          coordinates: [ location.lng, location.lat ]
        });
      }
    });
  };

  // Available to be called individually, for instance for manual edits where
  // it is unlikely the rate limit will be reached
  self.geocodeSnippet = function(snippet, saveNow, callback) {
    return async.series({
      geocode: function(callback) {
        // If a manually entered location is present, let it win
        if ((typeof(snippet.lat) === 'number') && (typeof(snippet.lng) === 'number')) {
          snippet.geo = {
            type: 'Point',
            coordinates: [ snippet.lng, snippet.lat ]
          };
          return callback(null);
        }
        return geocoder.geocode(snippet.address, function ( err, geo ) {
          if (!err) {
            if (geo.status === 'OVER_QUERY_LIMIT') {
              // Try again later
              snippet.geo = null;
              return callback();
            } else if (geo.status === 'ZERO_RESULTS') {
              // Explicitly false so we know it's not a geolocatable address
              snippet.geo = false;
            } else {
              if (geo.results && geo.results[0]) {
                var location = geo.results[0].geometry.location;
                snippet.geo = {
                  type: 'Point',
                  coordinates: [ location.lng, location.lat ]
                };
              } else {
                // What the heck Google
                snippet.geo = null;
              }
            }
          } else {
            // This is an error at the http or node level. Try again later
            snippet.geo = null;
          }
          return callback(null);
        });
      },
      save: function(callback) {
        if (saveNow) {
          self._apos.pages.update({ _id: snippet._id }, { $set: { geo: snippet.geo } }, function(err) {
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
