apostrophe-map
==============

`apostrophe-map` adds interactive maps to the [Apostrophe](http://github.com/punkave/apostrophe) content management system. `apostrophe-map` provides both backend and frontend components, including a friendly UI built on Apostrophe's rich content editing features.

See the `apostrophe-sandbox` project for a demo of usage. Setup is similar to `apostrophe-blog` or `apostrophe-snippets`, but you must also call `map.geocode()`, from one and only one process to respect rate limits. (If you don't know what that means you probably have only one process.)

