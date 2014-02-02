apostrophe-map
==============

`apostrophe-map` adds interactive maps to the [Apostrophe](http://github.com/punkave/apostrophe) content management system. `apostrophe-map` provides both backend and frontend components, including a friendly UI built on Apostrophe's rich content editing features.

See the `apostrophe-sandbox` project for a demo of usage. Setup is similar to `apostrophe-blog` or `apostrophe-snippets`. The geocoder is automatically started.

If you are running in a multiple-process environment, like `cluster`, you should set the `startGeocoder` option to `false` and explicitly invoke the `startGeocoder` method from one and only one process to avoid hitting API rate limits.

### Code Stability

0.4.x releases receive bug fixes only. For active development, follow 0.5.x releases and/or the master branch in github.
