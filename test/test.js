var assert = require('assert');
var geocoder;

describe('geocoder', function() {
  it('initializes geocoder', function() {
    geocoder = require('../geocoder.js')({
      instance: 'location',
      // mock up just enough of apos for geocodePass to not crash
      apos: {
        pages: {
          find: function(criteria, projection) {
            var cursor = {
              limit: function() {
                return cursor;
              },
              toArray: function(callback) {
                return callback(null, []);
              }
            };
            return cursor;
          }
        }
      }
    });
    assert(geocoder);
  });
  it('can look up our office', function(done) {
    geocoder.geocode('1168 E Passyunk Ave Philadelphia, PA 19147', function(err, location) {
      assert(!err);
      assert(location);
      done();
    });
  });
  it('handles a busted address reasonably', function(done) {
    geocoder.geocode('23987423 skullduggery byway, pringlingtown, impossible 755757575', function(err, location) {
      assert(!err);
      assert(!location);
      done();
    });
  });

});


