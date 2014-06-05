apostrophe-map
==============

`apostrophe-map` adds interactive maps to the [Apostrophe](http://github.com/punkave/apostrophe) content management system. `apostrophe-map` provides both backend and frontend components, including a friendly UI built on Apostrophe's rich content editing features.

See the `apostrophe-sandbox` project for a demo of usage. Setup is similar to `apostrophe-blog` or `apostrophe-snippets`. The geocoder is automatically started.

If you are running in a multiple-process environment, like `cluster`, you should set the `startGeocoder` option to `false` and explicitly invoke the `startGeocoder` method from one and only one process to avoid hitting API rate limits.

## Update: GeoJSON, address search and a bc break

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

AWESOME NEW OPTIONS

The "get" method of the maps module now accepts these options, in addition to everything `snippets.get` and `pages.get` will accept:

`geo`: a GeoJSON point. When this option is passed, results are sorted by distance from this point.

`maxDistance`: results are restricted to points within this many meters of "geo".
`maxKm`: same for kilometers.
`maxMiles`: same for miles.

