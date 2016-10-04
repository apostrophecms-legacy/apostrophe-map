## Deprecated for new sites

This module was for A2 0.5.x. For new projects, use the [apostrophe-places module](http://npmjs.org/package/apostrophe-places).

# apostrophe-map

`apostrophe-map` adds interactive maps to the [Apostrophe](http://github.com/punkave/apostrophe) content management system. `apostrophe-map` provides both backend and frontend components, including a friendly UI built on Apostrophe's rich content editing features.

See the `apostrophe-sandbox` project for a demo of usage. Setup is similar to `apostrophe-blog` or `apostrophe-snippets`. The geocoder is automatically started.

## Special map-related options to the `get` method

The "get" method of the maps module accepts these options, in addition to everything `snippets.get` and `pages.get` will accept:

`geo`: a GeoJSON point. When this option is passed, results are sorted by distance from this point.

`maxDistance`: results are restricted to points within this many meters of "geo".
`maxKm`: same for kilometers.
`maxMiles`: same for miles.

## Subclassing the map

The map module's browser-side JavaScript can now be easily subclassed and extended.

Prior to 3/12/15 this was very difficult due to the timing of the way the map object was constructed.

Here is an example of code that overrides the method that generates an info box:

```javascript
// This code lives at your project level, in
// lib/modules/apostrophe-map/public/js/content.js

var superAposGoogleMap = AposGoogleMap;

AposGoogleMap = function(item, id, mapOptions) {
  var self = this;
  superAposGoogleMap.call(self, item, id, mapOptions);
  self.activateInfoBox = function(item) {
    alert('Do this instead of displaying the info box');
  };
};
```

Note the use of the "super pattern," much as we do on the server side when extending methods of Apostrophe modules.

You'll find that the browser-side code in `content.js` has been broken down into many individual methods, all of which can be easily overridden in this way.

## bc break, June 5th, 2014: GeoJSON, map locations and your JavaScript

We've made a change to the way the map module stores coordinates. This change enables the use of a 2dsphere index for fast searches for addresses and other locations. And we've introduced cool options that leverage that. But, there's a bc break required.

Previously there was a "coords" property which contained "lat" and "lng" properties.

Now, we're storing a GeoJSON point in a "geo" property.

It looks like:

```javascript
location.geo = { type: 'Point', coordinates: [ longitude, latitude ] };
```

IMPORTANT: LONGITUDE COMES FIRST.

(MongoDB's choice, not ours, but it does fit with the newer convention that X always comes before Y, even if you're talking about maps.)

FOR OLD SITES, YOU SHOULD RUN "node app apostrophe:migrate", otherwise the map module will have to geocode your coordinates again based on their address field. Which is not the end of the world, but it's nice to skip it especially if you have a lot of them.

IF YOU OVERRODE OUR BROWSER-SIDE JAVASCRIPT, YOU WILL NEED TO FIX YOUR CODE to use the new .geo property instead of the old .coords property.

Example:

```javascript
coords = new google.maps.LatLng(item.geo.coordinates[1], item.geo.coordinates[0]);
```

The `.coords` property in old sites will hang around, because it's not hurting anyone and migrations should be as gentle as possible. But it won't be updated anymore, so don't be fooled.

## Dynamic loading

You no longer need to add script tags for the Google Maps API to your `base.html` file. Instead, these dynamically load on their own, and only when they are actually needed.

Older `base.html` files that do load these scripts the hard way will still work, but you are slowing your users down on every page, so stop doing that.

## Configuring the geocoder

You may pass configuration to the `node-geocoder` npm module used to look up addresses via the `geocoder` option to the `apostrophe-maps` module. The default geocoding provider is Google. You will need to configure the `apiKey` property for domains that have not used the Google Maps API before.

In addition, the `dailyLimit` and `rateLimit` properties of the `geocoder` option can be used to limit the queries per day and per second, respectively. These default to `2500` and `10` to stay on the good side of Google's free API limits.
