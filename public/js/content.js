// JavaScript which enables display of this module's content
// to logged-out users belongs here.

// Create Google Map that displays the specified items. Uf mapOptions.center is not
// set to an object with lat and lng properties, the center is
// determined from the items. If there are no items... welcome to Philadelphia!

// id is a separate parameter because it's tough to set a property of an object
// in a nunjucks template, and we generate the id there. You are responsible for
// supplying a div with that id and a suitable width and height

var AposGoogleMap = function(items, id, mapOptions) {

  var self = this;

  window.aposGoogleMapApiReady = function() {
    loadLibraries();
  };

  // Load dynamically but only if it wasn't already loaded in base.html
  if (window.google) {
    return window.aposGoogleMapApiReady();
  } else {
    // apos.log('maps: dynamically loading google maps API');
    addScript('https://maps.googleapis.com/maps/api/js?v=3.exp&' +
        'key=AIzaSyA4AeSmhph6FqLD7GKnjP5aQLiySYzmuQs&sensor=false&callback=aposGoogleMapApiReady');
  }

  function addScript(src) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    document.body.appendChild(script);
  }

  function loadLibraries() {
    // console.log('maps: google maps API ready, loading more libraries');
    // Dynamic loader for two scripts that don't normally
    // support that. So we wait until we see
    // that they have defined something. -Tom

    var load = [
      {
        src: 'http://google-maps-utility-library-v3.googlecode.com/svn/trunk/infobox/src/infobox.js',
        defines: 'InfoBox'
      },
      {
        src: 'http://google-maps-utility-library-v3.googlecode.com/svn/trunk/richmarker/src/richmarker-compiled.js',
        defines: 'RichMarker'
      }
    ];

    window.aposGoogleMapScriptsAdded = false;

    function wait() {
      var defined = 0;
      _.each(load, function(item) {
        if (window[item.defines]) {
          defined++;
        }
      });
      if (defined === load.length) {
        // apos.log('Maps: all libraries ready');
        return ready();
      }
      if (!window.aposGoogleMapScriptsAdded) {
        // apos.log('Maps: adding script tags');
        _.each(load, function(item) {
          addScript(item.src);
        });
        window.aposGoogleMapScriptsAdded = true;
      }
      setTimeout(wait, 50);
    }

    return wait();
  }

  function ready() {

    // For points not geocoded server side
    var geocoder = new google.maps.Geocoder();

    var mapZoom;
    var mapCenter;

    self.filterBy = mapOptions.filterBy || 'all';

    function filter(filterBy) {
      // console.log(filterBy);
      self.filterBy = filterBy;
      forEachItem(function(item) {
        ifMappable(item, function(item) {
          if (item.infoBox) {
            item.infoBox.close();
          }
          item.marker.setVisible(false);
        });
      });
      forEachItem(function(item) {
        ifFiltered(item, function(item) {
          item.marker.setVisible(true);
        });
      });
      if (filterBy == 'all') {
        resetZoom();
        resetCenter();
      } else {
        autoZoom();
        autoCenter();
      }
    }

    function forEachItem(iterator) {
      for (var i in self.items) {
        iterator(self.items[i]);
      }
    }

    function ifMappable(item, callback) {
      if (item.geo) {
        return callback(item);
      }
    }

    function ifFiltered(item, callback) {
      ifMappable(item, function(item) {
        if (self.filterBy === 'all') {
          return callback(item);
        } else {
          var filterBy = (_.isArray(self.filterBy)) ? self.filterBy : [self.filterBy];
          var marker = item.marker;
          if( _.intersection(self.filterBy, item.tags).length ) {
            return callback(item);
          }
        }
      });
    }

    function autoCenter() {
      var valid = 0;
      var lat = 0.0;
      var lng = 0.0;
      forEachItem(function(item) {
        ifMappable(item, function(item) {
          ifFiltered(item, function(item) {
            lat += item.geo.coordinates[1];
            lng += item.geo.coordinates[0];
            valid++;
          });
        });
      });
      var mapCenter;
      if (valid) {
        mapCenter = new google.maps.LatLng(lat / valid, lng / valid);
      } else {
        mapCenter = new google.maps.LatLng(39.952335, -75.163789);
      }
      self.map.setCenter(mapCenter);
    }

    function autoZoom() {
      var bounds;
      // Auto-zoom
      bounds = new google.maps.LatLngBounds();
      var count = 0;
      forEachItem(function(item) {
        ifMappable(item, function(item) {
          ifFiltered(item, function(item) {
            count++;
            bounds.extend(new google.maps.LatLng(item.geo.coordinates[1], item.geo.coordinates[0]));
          });
        });
      });
      if (count > 1) {
        self.map.fitBounds(bounds);
      } else if (count === 1) {
        self.map.setZoom(15);
      }
    }

    // Revert to whatever we had initially (for filtering by "all")
    function resetZoom() {
      if (mapZoom) {
        self.map.setZoom(mapZoom);
      } else {
        autoZoom();
      }
    }

    function resetCenter() {
      if (mapCenter) {
        self.map.setCenter(mapCenter);
      } else {
        autoCenter();
      }
    }

    self.items = items;
    self.mapOptions = mapOptions;

    // set up the actual map. This works asynchronously if needed to
    // geocode addresses browser-side

    self.googleMap = function() {

      // Geocode an item if needed
      function geocodeOne(i, callback) {
        var item = self.items[i];
        if ((!item.geo) && (item.address)) {
          geocoder.geocode( { 'address': self.items[i].address }, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
              item.geo = {
                type: 'Point',
                coordinates: [ results[0].geometry.location.lng(), results[0].geometry.location.lat() ]
              };
              return callback();
            } else {
              return callback();
            }
          });
        } else {
          return callback();
        }
      }

      // Simple async for loop to geocode them all, then invoke 'go'
      var i = 0;
      function geocodeNext() {
        if (i >= self.items.length) {
          return go();
        }
        return geocodeOne(i, function() {
          i++;
          return geocodeNext();
        });
      }

      geocodeNext();

      // Called once we're ready with all of our points
      function go() {
        var lat = 0.0;
        var lng = 0.0;
        if (self.mapOptions.center) {
          var center = self.mapOptions.center;
          mapCenter = new google.maps.LatLng(center.lat, center.lng);
        }

        mapZoom = self.mapOptions.zoom;
        var $mapEl = $('#' + id);
        // For easier targeting
        $mapEl.addClass('apos-map');
        var mapEl = $mapEl[0];

        // reasonable defaults for zoom and center until autoZoom or autoCenter can run
        var zoom = mapZoom || 12;

        var teaser = self.mapOptions.teaser;
        var map = new google.maps.Map(mapEl, {
          minZoom: teaser ? zoom : 0,
          maxZoom: teaser ? zoom : 100,
          zoom: zoom,
          panControl: !teaser,
          zoomControl: !teaser,
          scaleControl: !teaser,
          draggable: !teaser,
          streetViewControl: !teaser,
          center: mapCenter || new google.maps.LatLng(39.952335, -75.163789),
          mapTypeId: google.maps.MapTypeId.ROADMAP
        });

        if (self.mapOptions.teaser) {
          $(mapEl).css('cursor', 'pointer');
        }

        // teaser option: this display of the map is just a teaser to take
        // you to a more suitable page. Helps avoid overhead and scrolling
        // frustration when a map is full width on the homepage
        if (self.mapOptions.teaser) {
          google.maps.event.addListener(map, 'click', function() {
            // document.body.style.cursor = 'wait';
            window.location.href = self.mapOptions.teaser;
          });
        }

        self.map = map;

        var mapStyles = self.mapOptions.styles;

        if(mapStyles) map.setOptions({styles:mapStyles});

        map.setOptions({scrollwheel: false, mapTypeControl: false});

        // loop through the items getting passed in from our template
        // and create a marker / info box for each. To avoid convoluted
        // code just call a nested function in a loop and pass it 'i' so that
        // it's safe to write boring, simple event handlers there that use 'i'

        forEachItem(setUpItem);

        if (!mapZoom) {
          autoZoom();
        }
        if (!mapCenter) {
          autoCenter();
        }

        function setUpItem(item) {
          if (!item.geo) {
            // Ignore ungeocoded points
            return;
          }
          self.generateMarker(item, self.map);

          var selector = '.apos-location[data-location-id="' + item._id + '"]';
          $('.apos-location[data-location-id="' + item._id + '"]').click(function() {
            self.activateInfoBox(item);
            return false;
          });
          // attach a click listener to the marker that opens our info box
          if ((!mapOptions.teaser) && (!mapOptions.noBox)) {
            google.maps.event.addListener(item.marker, 'click', function() {
              self.activateInfoBox(item);
            });
          }
        }

        // Create a jQuery event that can be used to filter by
        // a particular tag or 'all'
        $(mapEl).on('filter', function(e) {
          // grab any arguments after the first (the event object),
          // which represent one or more tags to filter by.
          // we need to do this because calling .trigger('filter', Array)
          // passes the array items as arguments, instead of as an array.
          var filterBy = Array.prototype.slice.call(arguments, 1);
          // if the only argument supplied is the string "all",
          // pass it through as a string.
          if(filterBy.length == 1 && filterBy[0] == 'all') {
            filterBy = 'all';
          }
          return filter(filterBy);
        });
      }
    };

    self.activateInfoBox = function(item) {
      // for BC purposes, if an item has no `showInfoBox` property we'll fall
      // back on the old method of only showing an infoBox when there is no
      // body content.
      if ( ((item.showInfoBox === undefined || item.showInfoBox === null) && !item.descr) || item.showInfoBox === false) {
        // No info boxes for items without rich content, such as those
        // supplied for a plain street address associated with an event
        return;
      }
      forEachItem(function(item) {
        if (item.infoBox) {
          item.infoBox.close();
        }
        if (item.marker) {
          item.marker.content.firstChild.className = item.marker.content.firstChild.className.replace(' active', '');
        }
      });
      if (!item.infoBox) {
        self.generateInfoBox(item, self.map);
      }
      item.infoBox.open(self.map, item.marker);
      item.marker.content.firstChild.className += " active";
    };

    // Find the locType mentioned first in the tags of the item, otherwise
    // the first one defined, otherwise 'general'

    self.getLocType = function(item) {
      // This information was pushed into browserland with apos.pushGlobalData
      var locTypes = apos.data.aposMap.locTypes;
      var locTypeTag = _.find(item.tags || [], function(tag) {
        return _.find(locTypes, function(locType) {
          return locType.value === tag;
        });
      });
      var locType;
      if (locTypeTag) {
        locType = _.find(locTypes, function(locType) {
          return locType.value === locTypeTag;
        });
      }
      if (!locType) {
        locType = locTypes[0];
      }
      if (!locType) {
        locType = { value: 'general', label: 'General' };
      }
      return locType;
    };

    // Return a CSS-friendly version of the locType name

    self.getCssClass = function(item) {
      return apos.cssName(self.getLocType(item).value);
    };

    self.generateMarker = function(item, map)
    {
      var markerHTML = document.createElement('DIV');
          markerHTML.innerHTML = '<div class="apos-map-marker '+self.getCssClass(item)+'"></div>';

      var coords;
      // If the address is already a coordinate pair ignore any geocoding result and use it directly
      if (item.address.match(/^[\-\+0-9\.\,\ ]+$/)) {
        var rawCoords = item.address.split(/,\s*/);
        coords = new google.maps.LatLng(parseFloat(rawCoords[0]), parseFloat(rawCoords[1]));
      } else {
        coords = new google.maps.LatLng(item.geo.coordinates[1], item.geo.coordinates[0]);
      }

      var marker = new RichMarker({
        position: coords,
        draggable: false,
        visible: true,
        clickable: true,
        map: map,
        content: markerHTML
      });

      marker.locTypes = item.tags;
      item.marker = marker;
    };

    // IMPORTANT: if you want more properties to be visible here, make sure
    // you override the aposMapPruneLocations function to include them.
    // You can do that in your server-side extension of the map module.
    // See map/index.js for the original. Pruning is necessary to avoid
    // sending a zillion megabytes per page to the browser

    self.generateInfoBox = function(item, map) {
      var $box = apos.fromTemplate('.apos-map-location-info-box');

      var image = apos.getFirstImage(item, 'thumbnail');
      if (image) {
        var url = apos.filePath(image, { size: 'one-third' });
        $box.find('[data-image]').attr('src', url);
      } else {
        // Don't show a broken image
        $box.find('[data-image]').remove();
        $box.addClass('no-img');
      }
      $box.find('[data-loc-type]').text(item.locType);
      $box.find('[data-title]').text(item.title);
      // Do not show the "address" if it is actually a lat,long coordinate pair
      var $address = $box.find('[data-address]');
      if (!item.address.match(/^[\-\+0-9\.\,\ ]+$/)) {
        $address.text(item.address);
      } else {
        $address.hide();
      }
      $box.find('[data-descr]').text(item.descr);
      // $box.find('[data-hours]').text(item.hours);
      if (item.url) {
        $box.find('[data-url]').attr('href', item.url);
      }

      var boxOptions = {
        // Wants the actual DOM element, not jQuery
        content: $box[0],
        disableAutoPan: false,
        pixelOffset: new google.maps.Size(10,-137),
        boxStyle: {
          width: "280px"
         },
        closeBoxMargin: "0px 0px 0px 0px",
        closeBoxURL: "http://www.google.com/intl/en_us/mapfiles/close.gif",
        infoBoxClearance: new google.maps.Size(1, 1),
        pane: "floatPane",
        enableEventPropagation: false
      };

      item.infoBox = new InfoBox(boxOptions);
    };

    $(function() {
      self.googleMap();
    });
  }
};

