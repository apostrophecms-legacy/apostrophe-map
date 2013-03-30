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
    self._apos.pages.find({ type: self._instance, coords: { $exists: false } },
      { address: 1 }).limit(self._rateLimit).toArray(function(err, snippets) {
      // Use eachSeries to avoid parallelism, the rate limiter below should in theory
      // make this not a problem but I've seen Google get grumpy
      async.eachSeries(snippets, geocodeSnippet, function(err) {
        setTimeout(self.geocodePass, 1000.0);
      });

      function geocodeSnippet(snippet, callback) {
        // Use rate limiter to avoid getting shut down by Google during large imports.
        // This still won't help you if you hit the per-day limit (2,000+), we would
        // have to resolve that with something in the background
        dayLimiter.removeTokens(1, function() {
          secondLimiter.removeTokens(1, function() {
            geocoder.geocode(snippet.address, function ( err, coords ) {
              self._geocoding = false;
              if (!err) {
                if (coords.status === 'OVER_QUERY_LIMIT') {
                  // Try again later
                  return callback();
                } else {
                  snippet.coords = coords.results[0].geometry.location;
                }
              } else {
                // Explicitly false so we know it's not a geocodable address
                snippet.coords = false;
              }
              self._apos.pages.update({ _id: snippet._id }, { $set: { coords: snippet.coords } }, function(err) {
                // If it didn't work, it'll come up in the next query
                return callback();
              });
            });
          });
        });
      }
    });
  };

  self.geocodePass();
}
