overview-word-cloud
===================

Shows the most common words in a document set. Larger words are more common
than smaller words.

This is a plugin for Overview. You can see it live on
https://www.overviewdocs.com, or in the video below:

<a href="https://www.youtube.com/watch?v=Et6F9Zerr44"><img src="http://ethanresnick.com/misc/wordcloud-poster.png" /></a><a href="https://www.youtube.com/watch?v=Et6F9Zerr44">https://www.youtube.com/watch?v=Et6F9Zerr44</a>

Developing
==========

Setup
-----

1. Download and run [Overview](https://github.com/overview/overview-server.git)'s
   `./dev`. This creates the `overviewserver_default` Docker network that this
   plugin depends on in development mode.
1. In a separate console, `git clone https://github.com/overview/overview-word-cloud.git`
1. `cd overview-word-cloud`
1. `./dev` starts a server that listens on http://localhost:3334
1. Test it within Overview:
    1. Browse to http://localhost:9000
    1. Create a document set by uploading files
    1. In the resulting Document Set, click "Add View" ... "Custom"
    1. Set `Name`: `Word Cloud`, `App URL`: `http://localhost:3334`, and
       `Overview’s URL from App server`: `http://overview-web`

Development Loop
----------------

1. Run `./integration-tests/run` to make sure integration tests work. (You must
   be running Overview's `./dev` _and_ this project's `./dev` for integration
   tests to pass.
1. Write a new test; write accompanying code; make sure tests pass.

Deploying
---------

Run `./release 1.0.1`. This will:

* Modify `package.json` to have the new version number
* Tag and push `v1.0.1` to GitHub
* `docker build . -t overview/overview-file-browser:1.0.1` and push the change

TODO: deploy automatically, via Jenkins

Now update your deployed cluster (e.g., ECS) to use the new version.

License
=======

This project is copyright Overview Services Inc. and released under the
AGPL-3.0 open source license. See LICENSE for legal prose.
